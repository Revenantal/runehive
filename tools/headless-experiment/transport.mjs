import { EventEmitter } from 'node:events';

/**
 * Opens a WebSocket to the world's web port and wraps it in the small socket interface that the
 * login code uses (write, destroy, setTimeout, and data/error/close/timeout events). This is the
 * route the browser client takes; the default transport is a raw TCP connection to the game port.
 */
export function connectWebSocket({
  host = '127.0.0.1',
  port = 8888,
  WebSocketImpl = WebSocket,
} = {}) {
  const ws = new WebSocketImpl(`ws://${host}:${port}`, 'binary');
  ws.binaryType = 'arraybuffer';
  const socket = new EventEmitter();
  const queued = [];
  let idleTimer = null;
  let idleMs = 0;
  socket.destroyed = false;

  const restartIdle = () => {
    clearTimeout(idleTimer);
    if (idleMs > 0 && !socket.destroyed)
      idleTimer = setTimeout(() => socket.emit('timeout'), idleMs);
  };

  socket.write = (data) => {
    const bytes = Buffer.from(data);
    if (ws.readyState === 1) ws.send(bytes);
    else queued.push(bytes);
    return true;
  };
  socket.setTimeout = (ms) => {
    idleMs = ms;
    restartIdle();
  };
  socket.resume = () => {};
  socket.destroy = () => {
    if (socket.destroyed) return;
    socket.destroyed = true;
    clearTimeout(idleTimer);
    try {
      ws.close();
    } catch {
      // Already closing.
    }
    queueMicrotask(() => socket.emit('close'));
  };

  ws.onopen = () => {
    for (const bytes of queued.splice(0)) ws.send(bytes);
  };
  ws.onmessage = (event) => {
    restartIdle();
    socket.emit('data', Buffer.from(event.data));
  };
  ws.onerror = () => socket.emit('error', new Error('WEBSOCKET_ERROR'));
  ws.onclose = () => {
    if (socket.destroyed) return;
    socket.destroyed = true;
    clearTimeout(idleTimer);
    socket.emit('close');
  };
  return socket;
}
