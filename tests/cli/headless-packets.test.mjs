import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Isaac } from '../../tools/headless-experiment/isaac.mjs';
import { PacketStream, parsePlayerInfo } from '../../tools/headless-experiment/packets.mjs';
import { SERVER_PACKETS } from '../../tools/headless-experiment/server-packets.mjs';

// Synthetic fixtures: built here to mirror the engine's encoder layout, not captured from a server.
const SEEDS = [11, 22, 33, 44];

/** Writes big-endian bit fields, most significant bit first. */
class BitWriter {
  bits = [];
  write(width, value) {
    for (let i = width - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
    return this;
  }
  toBuffer() {
    const bytes = Buffer.alloc(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => {
      if (bit) bytes[i >> 3] |= 1 << (7 - (i & 7));
    });
    return bytes;
  }
}

/** Encodes packets the way the server does: opcode plus the next cipher value, then any length prefix. */
function encode(cipher, opcode, payload) {
  const info = SERVER_PACKETS.get(opcode);
  const prefix =
    info.length === -1
      ? Buffer.from([payload.length])
      : info.length === -2
        ? Buffer.from([payload.length >> 8, payload.length & 255])
        : Buffer.alloc(0);
  return Buffer.concat([Buffer.from([(opcode + cipher.nextInt) & 255]), prefix, payload]);
}

const opcodeNamed = (name) => [...SERVER_PACKETS].find(([, v]) => v.name === name)[0];

test('the packet table has the player-update packet as a two-byte-length packet', () => {
  assert.deepEqual(SERVER_PACKETS.get(167), { name: 'PLAYER_INFO', length: -2 });
});

test('packets are reassembled from one-byte chunks and the cipher advances once per packet', () => {
  const server = new Isaac(SEEDS);
  const closeUi = opcodeNamed('IF_CLOSE');
  const setTab = opcodeNamed('IF_SETTAB');
  const message = opcodeNamed('MESSAGE_GAME');
  const info = opcodeNamed('PLAYER_INFO');
  const wire = Buffer.concat([
    encode(server, closeUi, Buffer.alloc(0)),
    encode(server, setTab, Buffer.from([1, 2, 3])),
    encode(server, message, Buffer.from('hello')),
    encode(server, info, Buffer.alloc(300, 7)),
  ]);
  const stream = new PacketStream(new Isaac(SEEDS));
  const seen = [];
  for (const byte of wire) seen.push(...stream.push(Buffer.from([byte])));
  assert.deepEqual(
    seen.map((p) => [p.name, p.payload.length]),
    [
      ['IF_CLOSE', 0],
      ['IF_SETTAB', 3],
      ['MESSAGE_GAME', 5],
      ['PLAYER_INFO', 300],
    ],
  );
  assert.deepEqual([...seen[1].payload], [1, 2, 3]);
  assert.equal(stream.broken, null);
  assert.equal(
    stream.cipher.nextInt,
    server.nextInt,
    'one cipher step per packet, none wasted while waiting',
  );
});

test('an unknown opcode stops the stream permanently instead of guessing', () => {
  const known = new Set(SERVER_PACKETS.keys());
  const unknown = [...Array(256).keys()].find((n) => !known.has(n));
  const server = new Isaac(SEEDS);
  const bytes = Buffer.from([(unknown + server.nextInt) & 255, 1, 2, 3]);
  const stream = new PacketStream(new Isaac(SEEDS));
  assert.deepEqual(stream.push(bytes), []);
  assert.deepEqual(stream.broken, { reason: 'unknown-opcode', opcode: unknown });
  assert.deepEqual(stream.push(Buffer.from([9, 9, 9])), []);
  assert.equal(stream.broken.opcode, unknown);
});

test('a player update lists the dropped and added players with signed offsets', () => {
  const w = new BitWriter();
  w.write(1, 1).write(2, 3).write(2, 0).write(7, 5).write(7, 6).write(1, 0).write(1, 1); // local teleport + extended
  w.write(8, 3); // three players already in view
  w.write(1, 0); // idle
  w.write(1, 1).write(2, 3); // removed
  w.write(1, 1).write(2, 1).write(3, 4).write(1, 0); // walking
  w.write(11, 7).write(5, 2).write(5, 30).write(1, 0).write(1, 1); // pid 7 at (+2, -2)
  w.write(11, 9).write(5, 16).write(5, 15).write(1, 1).write(1, 1); // pid 9 at (-16, +15)
  w.write(11, 2047);
  const result = parsePlayerInfo(Buffer.concat([w.toBuffer(), Buffer.from([0xaa, 0xbb])]));
  assert.equal(result.local, 'teleport');
  assert.equal(result.before, 3);
  assert.equal(result.removed, 1);
  assert.deepEqual(result.added, [
    { pid: 7, dx: 2, dz: -2 },
    { pid: 9, dx: -16, dz: 15 },
  ]);
  assert.equal(result.viewSize, 4);
});

test('an update with no extended data has no terminator and still decodes', () => {
  const w = new BitWriter();
  w.write(1, 0); // local idle
  w.write(8, 1).write(1, 0); // one player in view, idle
  const result = parsePlayerInfo(w.toBuffer());
  assert.deepEqual(
    [result.local, result.before, result.removed, result.added.length, result.viewSize],
    ['idle', 1, 0, 0, 1],
  );
});

test('running movement and extended-only entries are skipped correctly before new players', () => {
  const w = new BitWriter();
  w.write(1, 1).write(2, 2).write(3, 1).write(3, 2).write(1, 0); // local run
  w.write(8, 2);
  w.write(1, 1).write(2, 2).write(3, 3).write(3, 4).write(1, 1); // run with extended
  w.write(1, 1).write(2, 0); // extended only
  w.write(11, 12).write(5, 0).write(5, 1).write(1, 0).write(1, 1);
  w.write(11, 2047);
  const result = parsePlayerInfo(Buffer.concat([w.toBuffer(), Buffer.from([1])]));
  assert.equal(result.local, 'run');
  assert.deepEqual(result.added, [{ pid: 12, dx: 0, dz: 1 }]);
  assert.equal(result.viewSize, 3);
});

test('a truncated update is reported, not silently misread', () => {
  assert.throws(() => parsePlayerInfo(Buffer.alloc(0)), /PACKET_TRUNCATED/);
  const w = new BitWriter();
  w.write(1, 0).write(8, 200); // claims 200 players in view but has no entries
  assert.throws(() => parsePlayerInfo(w.toBuffer()), /PACKET_TRUNCATED/);
});
