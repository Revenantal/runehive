// Experiment-only shortcut: the id of the logout tab's button (`logout:try_logout`) taken from the
// pinned content's interface pack. A production client must learn interface layout from the client
// protocol and cache instead of hard-coding it.
export const LOGOUT_BUTTON_COMPONENT = 2458;

// The engine allows 5 login attempts per 15 s for one device id, so later attempts are 16 s apart.
export const CLEAN_RELOGIN_DELAYS_MS = [1_000, 16_000, 16_000];
export const ABRUPT_RELOGIN_DELAYS_MS = [1_000, 16_000, 16_000, 16_000, 16_000, 16_000, 16_000];

/** Logs in once and reports protocol-visible acceptance, rejection or transport failure. */
async function attemptLogin(loginFn, account, onBytes) {
  try {
    const result = await loginFn({ account, onBytes });
    if (result.kind === 'rejected') {
      result.socket?.destroy();
      return { outcome: 'rejected', code: result.code };
    }
    return { outcome: 'accepted', result };
  } catch {
    return { outcome: 'failed' };
  }
}

/**
 * Logs in, then either clicks the logout button (clean) or drops the socket (abrupt), and measures
 * how long a new login takes to be accepted. Returns a summary and never throws for game outcomes.
 */
export async function runLogoutExperiment({
  account,
  mode,
  loginFn,
  log,
  sleep,
  now,
  signal,
  dwellMs = 5_000,
  closeTimeoutMs = 15_000,
  reloginDelaysMs = mode === 'clean' ? CLEAN_RELOGIN_DELAYS_MS : ABRUPT_RELOGIN_DELAYS_MS,
}) {
  const summary = { mode, relogins: [] };
  const first = await attemptLogin(loginFn, account, () => {});
  if (first.outcome !== 'accepted') return { ...summary, stage: 'login', ...first };
  const { result } = first;
  log.loginAccepted(result.staffLevel);
  if (result.staffLevel !== 0) {
    result.socket.destroy();
    return { ...summary, stage: 'login', outcome: 'not-ordinary' };
  }

  const socket = result.socket;
  let closed = socket.destroyed;
  const closedSignal = new Promise((resolve) => {
    if (closed) resolve();
    else socket.once('close', resolve);
  });
  closedSignal.then(() => {
    closed = true;
  });
  /** Resolves true if the socket closes before the delay elapses, cancelling the unused timer. */
  const waitForClose = async (ms) => {
    const cancel = new AbortController();
    try {
      return await Promise.race([
        closedSignal.then(() => true),
        sleep(ms, cancel.signal).then(() => false),
      ]);
    } finally {
      cancel.abort();
    }
  };

  if (await waitForClose(dwellMs)) {
    log.logoutObserved('closed-before-request', 0);
    return { ...summary, stage: 'dwell', outcome: 'closed-before-request' };
  }
  if (signal?.aborted) {
    socket.destroy();
    return { ...summary, stage: 'dwell', outcome: 'cancelled' };
  }

  const requestedAt = now();
  log.logoutRequested(mode);
  let closeReason;
  if (mode === 'clean') {
    try {
      result.sendButton(LOGOUT_BUTTON_COMPONENT);
    } catch {
      socket.destroy();
      log.logoutObserved('send-failed', 0);
      return { ...summary, stage: 'logout', outcome: 'send-failed' };
    }
    closeReason = (await waitForClose(closeTimeoutMs)) ? 'closed' : 'no-close';
  } else {
    socket.destroy();
    closeReason = 'closed';
  }
  const closeElapsedMs = Math.max(0, Math.floor(now() - requestedAt));
  log.logoutObserved(closeReason, closeElapsedMs);
  summary.close = { reason: closeReason, elapsedMs: closeElapsedMs };
  if (closeReason === 'no-close') socket.destroy();

  for (const [index, delay] of reloginDelaysMs.entries()) {
    await sleep(delay);
    if (signal?.aborted) return { ...summary, stage: 'relogin', outcome: 'cancelled' };
    const attempt = await attemptLogin(loginFn, account, () => {});
    const elapsedMs = Math.max(0, Math.floor(now() - requestedAt));
    const code = attempt.outcome === 'rejected' ? attempt.code : null;
    log.reloginAttempted(index + 1, attempt.outcome, code, elapsedMs);
    summary.relogins.push({ attempt: index + 1, outcome: attempt.outcome, code, elapsedMs });
    if (attempt.outcome === 'accepted') {
      attempt.result.socket.destroy();
      if (attempt.result.staffLevel !== 0)
        return { ...summary, stage: 'relogin', outcome: 'not-ordinary' };
      return {
        ...summary,
        stage: 'relogin',
        outcome: 'relogin-accepted',
        reloginAfterMs: elapsedMs,
      };
    }
    // Only "already logged in" (5) is worth retrying; anything else is a different failure.
    if (attempt.outcome !== 'rejected' || attempt.code !== 5) break;
  }
  return { ...summary, stage: 'relogin', outcome: 'relogin-not-accepted' };
}
