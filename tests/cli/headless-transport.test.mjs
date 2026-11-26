import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectWebSocket } from '../../tools/headless-experiment/transport.mjs';

/** A stand-in for the platform WebSocket that records what the adapter does with it. */
class FakeWebSocket {
  static last = null;
  readyState = 0;
  sent = [];
  closed = false;
  constructor(url, protocol) {
    this.url = url;
    this.protocol = protocol;
    FakeWebSocket.last = this;
  }
  send(data) {
    this.sent.push(Buffer.from(data));
  }
  close() {
    this.closed = true;
  }
  open() {
    this.readyState = 1;
    this.onopen();
  }
}

const connect = (options = {}) =>
  connectWebSocket({ host: '10.0.0.1', port: 9999, WebSocketImpl: FakeWebSocket, ...options });

test('it connects to the web port with the binary subprotocol the browser uses', () => {
  connect();
  assert.equal(FakeWebSocket.last.url, 'ws://10.0.0.1:9999');
  assert.equal(FakeWebSocket.last.protocol, 'binary');
  assert.equal(FakeWebSocket.last.binaryType, 'arraybuffer');
});

test('writes made before the connection opens are sent in order once it does', () => {
  const socket = connect();
  const ws = FakeWebSocket.last;
  socket.write(Buffer.from([14, 1]));
  socket.write(Buffer.from([2, 3]));
  assert.equal(ws.sent.length, 0);
  ws.open();
  assert.deepEqual(
    ws.sent.map((b) => [...b]),
    [
      [14, 1],
      [2, 3],
    ],
  );
  socket.write(Buffer.from([9]));
  assert.deepEqual([...ws.sent[2]], [9]);
});

test('incoming messages become data events and closing is reported once', () => {
  const socket = connect();
  const ws = FakeWebSocket.last;
  const seen = [];
  let closes = 0;
  socket.on('data', (chunk) => seen.push([...chunk]));
  socket.on('close', () => closes++);
  ws.onmessage({ data: Uint8Array.from([1, 2, 3]).buffer });
  assert.deepEqual(seen, [[1, 2, 3]]);
  ws.onclose();
  ws.onclose();
  assert.equal(closes, 1);
  assert.equal(socket.destroyed, true);
});

test('destroy closes the WebSocket and emits close exactly once', async () => {
  const socket = connect();
  let closes = 0;
  socket.on('close', () => closes++);
  socket.destroy();
  socket.destroy();
  await Promise.resolve();
  FakeWebSocket.last.onclose();
  assert.equal(FakeWebSocket.last.closed, true);
  assert.equal(closes, 1);
});

test('an idle timeout is reported and can be switched off', async () => {
  const socket = connect();
  let timeouts = 0;
  socket.on('timeout', () => timeouts++);
  socket.setTimeout(20);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(timeouts, 1);
  const quiet = connect();
  quiet.on('timeout', () => timeouts++);
  quiet.setTimeout(20);
  quiet.setTimeout(0);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(timeouts, 1, 'a disabled timeout never fires');
  socket.destroy();
  quiet.destroy();
});

test('a transport error is surfaced without any address or payload', () => {
  const socket = connect();
  const errors = [];
  socket.on('error', (error) => errors.push(error.message));
  FakeWebSocket.last.onerror({ message: 'ws://10.0.0.1:9999 refused' });
  assert.deepEqual(errors, ['WEBSOCKET_ERROR']);
});
