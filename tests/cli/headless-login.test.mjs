import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { login } from '../../tools/headless-experiment/login.mjs';

class FakeSocket extends EventEmitter {
  constructor(reply) {
    super();
    this.reply = reply;
    this.writes = [];
    this.destroyed = false;
  }
  setTimeout() {}
  resume() {}
  destroy() {
    this.destroyed = true;
  }
  write(data) {
    this.writes.push(Buffer.from(data));
    if (this.writes.length === 1) {
      queueMicrotask(() => {
        this.emit('data', Buffer.alloc(5));
        this.emit('data', Buffer.alloc(12));
      });
    } else if (this.writes.length === 2) {
      queueMicrotask(() => this.emit('data', Buffer.from(this.reply)));
    }
  }
}
const fetcher = async () => ({ ok: true, arrayBuffer: async () => Buffer.alloc(40) });
const account = ['HX', '9999'].join(''); // Synthetic fixture, never used against a world.

test('login handles fragmented handshake and accepts ordinary-player reply', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  const result = await login({
    account,
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  assert.equal(result.kind, 'accepted');
  assert.equal(result.staffLevel, 0);
  assert.equal(socket.writes[0][0], 14);
  assert.equal(socket.writes[1][0], 16);
  assert.equal(socket.writes[1][1], socket.writes[1].length - 2);
  assert.equal(socket.writes[1].includes(Buffer.from(account)), false);
});

test('login returns a rejection without inventing its cause', async () => {
  const socket = new FakeSocket([3]);
  const result = await login({
    account: 'player test',
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  assert.equal(result.kind, 'rejected');
  assert.equal(result.code, 3);
});

test('login fails safely when cache is unavailable or malformed', async () => {
  await assert.rejects(
    login({
      account,
      fetcher: async () => {
        throw new Error('sensitive fixture');
      },
    }),
    /CACHE_UNAVAILABLE/,
  );
  await assert.rejects(
    login({
      account,
      fetcher: async () => ({ ok: true, arrayBuffer: async () => Buffer.alloc(3) }),
    }),
    /INVALID_CACHE_RESPONSE/,
  );
  await assert.rejects(login({ account: 'bad\nname', fetcher }), /INVALID_CREDENTIAL_FORMAT/);
});

test('login cleans up a socket that closes during the handshake', async () => {
  const socket = new FakeSocket([]);
  socket.write = () => queueMicrotask(() => socket.emit('close'));
  await assert.rejects(login({ account, fetcher, connect: () => socket }), /TRANSPORT_FAILURE/);
  assert.equal(socket.destroyed, true);
});
