const DURATION_MS = 75_000;
const INTERVAL_MS = 1_000;
const REPORT_MS = 15_000;

/** Observes a bounded session without interpreting or storing raw game packets. */
export function observeSession({
  socket,
  sendKeepalive,
  keepalive,
  counts,
  report,
  finish,
  scheduler = globalThis,
  now = () => performance.now(),
}) {
  const started = now();
  let sent = 0;
  let ended = false;
  const snapshot = () => ({
    elapsedMs: Math.max(0, Math.floor(now() - started)),
    bytes: counts.bytes,
    keepalives: sent,
  });
  const end = (reason) => {
    if (ended) return;
    ended = true;
    scheduler.clearTimeout(deadline);
    scheduler.clearInterval(progress);
    if (heartbeat) scheduler.clearInterval(heartbeat);
    socket.removeListener('close', onClose);
    finish(reason, snapshot());
  };
  const onClose = () => end('closed');
  const progress = scheduler.setInterval(() => report(snapshot()), REPORT_MS);
  const deadline = scheduler.setTimeout(() => end('deadline'), DURATION_MS);
  const heartbeat = keepalive
    ? scheduler.setInterval(() => {
        try {
          sendKeepalive();
          sent++;
        } catch {
          end('send-error');
        }
      }, INTERVAL_MS)
    : null;
  socket.once('close', onClose);
  if (socket.destroyed) end('closed');
  return { stop: () => end('interrupted') };
}
