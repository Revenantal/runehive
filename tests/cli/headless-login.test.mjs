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
  result.sendKeepalive();
  result.sendKeepalive();
  assert.deepEqual([...socket.writes[2], ...socket.writes[3]], [107, 5]);
});

test('button clicks use the next cipher byte and a big-endian component id', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  const result = await login({
    account: ['HX', '9999'].join(''),
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  result.sendButton(2458);
  assert.deepEqual([...socket.writes[2]], [252, 9, 154]);
  assert.throws(() => result.sendButton(-1), /INVALID_COMPONENT/);
  assert.throws(() => result.sendButton(65536), /INVALID_COMPONENT/);
  assert.throws(() => result.sendButton(1.5), /INVALID_COMPONENT/);
  assert.equal(socket.writes.length, 3);
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

test('a design packet carries gender, seven parts and five colours, and rejects bad input', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  const result = await login({
    account: ['HX', '9999'].join(''),
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  const design = { gender: 0, parts: [0, 10, 18, 26, 33, 36, -1], colors: [1, 2, 3, 4, 5] };
  result.sendDesign(design);
  const sent = [...socket.writes[2]];
  assert.equal(sent.length, 14, 'one opcode byte plus thirteen bytes');
  assert.deepEqual(sent.slice(1), [0, 0, 10, 18, 26, 33, 36, 255, 1, 2, 3, 4, 5]);
  for (const bad of [
    { ...design, gender: 2 },
    { ...design, parts: [0, 1] },
    { ...design, parts: [0, 1, 2, 3, 4, 5, 300] },
    { ...design, colors: [1, 2, 3, 4] },
    { ...design, colors: [1, 2, 3, 4, -1] },
  ])
    assert.throws(() => result.sendDesign(bad), /INVALID_DESIGN/);
  assert.equal(socket.writes.length, 3, 'nothing is sent for an invalid design');
});

test('a walk request carries a start tile and signed waypoint offsets, and rejects bad paths', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  const result = await login({
    account: ['HX', '9999'].join(''),
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  result.sendWalk({
    startX: 3094,
    startZ: 3106,
    steps: [
      [0, 2],
      [-3, 1],
    ],
  });
  const sent = [...socket.writes[2]];
  assert.equal(sent[1], 5 + 2 * 2, 'length byte counts the payload only');
  assert.deepEqual(sent.slice(2), [0, 12, 22, 12, 34, 0, 2, 253, 1]);
  const base = { startX: 1, startZ: 1, steps: [[0, 1]] };
  for (const bad of [
    { ...base, startX: -1 },
    { ...base, startZ: 70000 },
    { ...base, steps: [] },
    { ...base, steps: Array(25).fill([0, 1]) },
    { ...base, steps: [[200, 0]] },
    { ...base, steps: [[0.5, 0]] },
  ])
    assert.throws(() => result.sendWalk(bad), /INVALID_WALK/);
  assert.equal(socket.writes.length, 3, 'nothing is sent for an invalid walk');
});

test('login rejects an out-of-range device id before touching the network', async () => {
  let touched = false;
  const watchFetch = async () => {
    touched = true;
    throw new Error('should not be called');
  };
  for (const deviceId of [-1, 1.5, 2 ** 31, '1337', NaN])
    await assert.rejects(login({ account, fetcher: watchFetch, deviceId }), /INVALID_DEVICE_ID/);
  assert.equal(touched, false);
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

test('login uses supplied checksums and a custom host without fetching over HTTP', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  let connectedTo = null;
  const result = await login({
    account,
    host: 'fixture-host',
    crcs: Buffer.alloc(40, 7),
    fetcher: async () => {
      throw new Error('must not fetch');
    },
    connect: (target) => {
      connectedTo = target;
      return socket;
    },
    random: () => Buffer.alloc(8),
  });
  assert.equal(result.kind, 'accepted');
  assert.equal(connectedTo.host, 'fixture-host');
  assert.equal(
    socket.writes[1].subarray(6, 42).every((b) => b === 7),
    true,
  );
});

test('login rejects supplied checksums of the wrong size', async () => {
  await assert.rejects(
    login({ account, crcs: Buffer.alloc(39), connect: () => new FakeSocket([2, 0, 1]) }),
    /INVALID_CACHE_RESPONSE/,
  );
});

test('location interaction sends option one and validates coordinates and id', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  const result = await login({
    account,
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  result.sendLocationOption1({ x: 3226, z: 3214, id: 1530 });
  assert.deepEqual([...socket.writes[2]].slice(1), [12, 154, 12, 142, 5, 250]);
  for (const bad of [
    { x: -1, z: 1, id: 1 },
    { x: 1, z: 65536, id: 1 },
    { x: 1, z: 1, id: 0.5 },
  ])
    assert.throws(() => result.sendLocationOption1(bad), /INVALID_LOCATION_INTERACTION/);
  assert.equal(socket.writes.length, 3);
});

test('NPC options and dialogue continue use their own opcodes and validate input', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  const result = await login({
    account,
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  result.sendNpcOption({ index: 300, option: 2 });
  assert.deepEqual([...socket.writes[2]].slice(1), [1, 44]);
  assert.equal(socket.writes[2][0], (233 + 243) & 255);
  result.sendContinue(2000);
  assert.deepEqual([...socket.writes[3]].slice(1), [7, 208]);
  for (const bad of [
    { index: -1, option: 1 },
    { index: 1, option: 0 },
    { index: 1, option: 6 },
    { index: 0.5, option: 1 },
  ])
    assert.throws(() => result.sendNpcOption(bad), /INVALID_NPC_INTERACTION/);
  assert.throws(() => result.sendContinue(65536), /INVALID_COMPONENT/);
  assert.equal(socket.writes.length, 4);
});

test('location interaction selects the requested protocol option', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  const result = await login({
    account,
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  result.sendLocationOption({ x: 3229, z: 3213, id: 1748, option: 3 });
  assert.equal(socket.writes[2][0], 174);
  assert.deepEqual([...socket.writes[2]].slice(1), [12, 157, 12, 141, 6, 212]);
  for (const option of [0, 6, 1.5, undefined])
    assert.throws(
      () => result.sendLocationOption({ x: 1, z: 1, id: 1, option }),
      /INVALID_LOCATION_INTERACTION/,
    );
});

test('held-item options and inventory buttons carry item, slot and component', async () => {
  const socket = new FakeSocket([2, 0, 1]);
  const result = await login({
    account,
    fetcher,
    connect: () => socket,
    random: () => Buffer.alloc(8),
  });
  result.sendHeldOption({ item: 1205, slot: 3, component: 3214, option: 1 });
  assert.equal(socket.writes[2][0], (185 + 243) & 255);
  assert.deepEqual([...socket.writes[2]].slice(1), [4, 181, 0, 3, 12, 142]);
  result.sendInventoryButton({ item: 1205, slot: 0, component: 1688, option: 1 });
  assert.deepEqual([...socket.writes[3]].slice(1), [4, 181, 0, 0, 6, 152]);
  for (const bad of [
    { item: -1, slot: 0, component: 1, option: 1 },
    { item: 1, slot: 65536, component: 1, option: 1 },
    { item: 1, slot: 0, component: 1, option: 0 },
    { item: 1, slot: 0, component: 1, option: 6 },
  ]) {
    assert.throws(() => result.sendHeldOption(bad), /INVALID_ITEM_ACTION/);
    assert.throws(() => result.sendInventoryButton(bad), /INVALID_ITEM_ACTION/);
  }
  assert.equal(socket.writes.length, 4);
});
