import { createInitialState } from './initial-state.mjs';
import { LOGOUT_BUTTON_COMPONENT } from './logout.mjs';
import { PLAYER_INFO, parsePlayerInfo } from './packets.mjs';

const REPORT_EVERY_MS = 10_000;

// Experiment-only shortcuts taken from the pinned content: the accept button of the character
// designer (`player_kit:accept`) and the default look the engine gives a new character.
export const DESIGN_ACCEPT_COMPONENT = 3651;
export const DEFAULT_DESIGN = {
  gender: 0,
  parts: [0, 10, 18, 26, 33, 36, 42],
  colors: [0, 0, 0, 0, 0],
};
const DESIGN_DELAY_MS = 2000;

// Experiment-only shortcut: the tile every new character starts on (read from the pinned content),
// used as the start of a walk because this client does not yet decode its own position.
export const START_TILE = { x: 3094, z: 3106 };
export const WALK_STEPS = [[0, 2]];

/** Tallies what the server's player-update packets say about other players near this client. */
function createTally(now) {
  const startedAt = now();
  const initial = createInitialState();
  const tally = {
    state: initial.state,
    stateErrors: 0,
    packets: 0,
    updates: 0,
    malformed: 0,
    viewSize: 0,
    maxViewSize: 0,
    added: 0,
    removed: 0,
    broken: null,
    sightings: new Map(),
    local: {},
    names: {},
    ownSlot: null,
  };
  return {
    tally,
    /** Consumes one decoded packet or a framing failure. */
    onPacket(packet) {
      if (packet.broken) {
        initial.state.position = null;
        tally.broken = packet.broken;
        return;
      }
      tally.packets++;
      try {
        initial.apply(packet);
      } catch {
        tally.stateErrors++;
        if (packet.name === 'PLAYER_INFO' || packet.name === 'REBUILD_NORMAL')
          initial.state.position = null;
      }
      tally.names[packet.name] = (tally.names[packet.name] ?? 0) + 1;
      if (packet.name === 'UPDATE_PID' && packet.payload.length >= 2)
        tally.ownSlot = packet.payload.readUInt16BE(0);
      if (packet.opcode !== PLAYER_INFO) return;
      try {
        const update = parsePlayerInfo(packet.payload);
        tally.updates++;
        tally.local[update.local] = (tally.local[update.local] ?? 0) + 1;
        tally.viewSize = update.viewSize;
        tally.maxViewSize = Math.max(tally.maxViewSize, update.viewSize);
        tally.added += update.added.length;
        tally.removed += update.removed;
        for (const { pid, dx, dz } of update.added)
          if (!tally.sightings.has(pid))
            tally.sightings.set(pid, { dx, dz, atMs: Math.floor(now() - startedAt) });
      } catch {
        tally.malformed++;
      }
    },
  };
}

/**
 * Logs in, keeps the session alive for a bounded time, and reports which other players the server
 * says are in view, then logs out with the logout button. Never throws for game outcomes.
 */
export async function observeView({
  account,
  loginFn,
  log,
  sleep,
  now,
  signal,
  durationMs = 30_000,
  design = false,
  walk = false,
  walkSteps = WALK_STEPS,
}) {
  const { tally, onPacket: tallyPacket } = createTally(now);
  let movement = null;
  const processing = { packets: 0, totalMs: 0, maxMs: 0, arrivalDecisionMs: null };
  const onPacket = (packet) => {
    const processingStarted = performance.now();
    const previous = tally.state.position ? { ...tally.state.position } : null;
    tallyPacket(packet);
    const position = tally.state.position;
    if (
      movement &&
      packet.name === 'PLAYER_INFO' &&
      position &&
      previous &&
      (position.x !== previous.x || position.z !== previous.z || position.level !== previous.level)
    ) {
      if (movement.trace.length < 128)
        movement.trace.push({
          elapsedMs: Math.max(0, Math.floor(now() - movement.requestedAt)),
          ...position,
        });
      else movement.traceTruncated = true;
    }
    if (
      movement &&
      packet.name === 'PLAYER_INFO' &&
      position &&
      position.level === movement.target.level &&
      position.x === movement.target.x &&
      position.z === movement.target.z
    ) {
      movement.arrived = true;
      if (processing.arrivalDecisionMs === null)
        processing.arrivalDecisionMs = performance.now() - processingStarted;
    }
    const elapsed = performance.now() - processingStarted;
    processing.packets++;
    processing.totalMs += elapsed;
    processing.maxMs = Math.max(processing.maxMs, elapsed);
  };
  let result;
  try {
    result = await loginFn({ account, onPacket });
  } catch {
    return { stage: 'login', outcome: 'failed' };
  }
  if (result.kind === 'rejected') {
    result.socket?.destroy();
    return { stage: 'login', outcome: 'rejected', code: result.code };
  }
  log.loginAccepted(result.staffLevel);
  if (result.staffLevel !== 0) {
    result.socket.destroy();
    return { stage: 'login', outcome: 'not-ordinary' };
  }

  const socket = result.socket;
  let closed = socket.destroyed;
  socket.once('close', () => {
    closed = true;
  });
  const startedAt = now();
  let nextReport = REPORT_EVERY_MS;
  const report = () =>
    log.viewObserved(
      Math.floor(now() - startedAt),
      tally.packets,
      tally.viewSize,
      tally.added,
      tally.removed,
    );

  let designed = false;
  let walked = false;
  while (now() - startedAt < durationMs && !closed && !signal?.aborted) {
    await sleep(1000);
    if (closed || signal?.aborted) break;
    result.sendKeepalive();
    if (walk && !walked && now() - startedAt >= DESIGN_DELAY_MS) {
      walked = true;
      const start = tally.state.position ? { ...tally.state.position } : null;
      movement = {
        start,
        target: {
          level: start?.level ?? null,
          x: START_TILE.x + walkSteps.at(-1)[0],
          z: START_TILE.z + walkSteps.at(-1)[1],
        },
        arrived: false,
        requestedAt: now(),
        trace: [],
        traceTruncated: false,
      };
      result.sendWalk({ startX: START_TILE.x, startZ: START_TILE.z, steps: walkSteps });
      log.walkRequested();
    }
    if (design && !designed && now() - startedAt >= DESIGN_DELAY_MS) {
      designed = true;
      result.sendDesign(DEFAULT_DESIGN);
      result.sendButton(DESIGN_ACCEPT_COMPONENT);
      log.designSubmitted();
    }
    if (now() - startedAt >= nextReport) {
      report();
      nextReport += REPORT_EVERY_MS;
    }
  }
  report();

  const endedBy = closed ? 'closed' : signal?.aborted ? 'cancelled' : 'deadline';
  if (!closed) {
    const cancel = new AbortController();
    const closing = new Promise((resolve) => socket.once('close', () => resolve(true)));
    result.sendButton(LOGOUT_BUTTON_COMPONENT);
    const confirmed = await Promise.race([closing, sleep(5000, cancel.signal).then(() => false)]);
    cancel.abort();
    if (!confirmed) socket.destroy();
  }
  return {
    stage: 'observe',
    outcome: endedBy,
    elapsedMs: Math.floor(now() - startedAt),
    designed,
    walked,
    movement: movement && {
      start: movement.start,
      target: movement.target,
      arrived: movement.arrived,
      trace: movement.trace,
      traceTruncated: movement.traceTruncated,
      outcome: movement.arrived ? 'completed' : 'unknown',
    },
    processing,
    ...tally,
    sightings: [...tally.sightings].map(([pid, v]) => ({ pid, ...v })),
  };
}
