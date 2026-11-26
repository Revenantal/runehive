import { SERVER_PACKETS, PLAYER_INFO } from './server-packets.mjs';

/** Reassembles ISAAC-encoded server packets from arbitrary stream chunks, one opcode per packet. */
export class PacketStream {
  /** Takes the incoming-direction cipher, whose state must advance exactly once per packet. */
  constructor(cipher) {
    this.cipher = cipher;
    this.buffer = Buffer.alloc(0);
    this.opcode = null;
    this.length = null;
    this.broken = null;
  }

  /** Adds bytes and returns every packet now complete; stops permanently on an unknown opcode. */
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const packets = [];
    while (!this.broken) {
      if (this.opcode === null) {
        if (this.buffer.length < 1) break;
        this.opcode = (this.buffer[0] - this.cipher.nextInt) & 0xff;
        this.buffer = this.buffer.subarray(1);
        this.length = null;
        if (!SERVER_PACKETS.has(this.opcode)) {
          this.broken = { reason: 'unknown-opcode', opcode: this.opcode };
          break;
        }
      }
      const info = SERVER_PACKETS.get(this.opcode);
      if (this.length === null) {
        const prefix = info.length === -1 ? 1 : info.length === -2 ? 2 : 0;
        if (this.buffer.length < prefix) break;
        this.length =
          prefix === 0 ? info.length : prefix === 1 ? this.buffer[0] : this.buffer.readUInt16BE(0);
        this.buffer = this.buffer.subarray(prefix);
      }
      if (this.buffer.length < this.length) break;
      packets.push({
        opcode: this.opcode,
        name: info.name,
        payload: this.buffer.subarray(0, this.length),
      });
      this.buffer = this.buffer.subarray(this.length);
      this.opcode = null;
      this.length = null;
    }
    return packets;
  }
}

/** Reads big-endian bit fields, most significant bit first, as the engine writes them. */
export class BitReader {
  /** Starts at the first bit of the buffer. */
  constructor(buffer) {
    this.buffer = buffer;
    this.bit = 0;
  }

  /** Number of unread bits. */
  get remaining() {
    return this.buffer.length * 8 - this.bit;
  }

  /** Reads an unsigned value of the given width, or throws if the packet is too short. */
  read(width) {
    if (width > this.remaining) throw new Error('PACKET_TRUNCATED');
    let value = 0;
    for (let i = 0; i < width; i++) {
      const byte = this.buffer[this.bit >> 3];
      value = (value << 1) | ((byte >> (7 - (this.bit & 7))) & 1);
      this.bit++;
    }
    return value;
  }
}

/** Reads one entry of the local or existing-player section; returns its kind. */
function readMovement(reader, { local }) {
  if (!reader.read(1)) return 'idle';
  const type = reader.read(2);
  if (type === 3) {
    if (!local) return 'removed';
    reader.read(2 + 7 + 7 + 1); // level, x, z, jump
    reader.read(1);
    return 'teleport';
  }
  if (type === 1) reader.read(3);
  if (type === 2) reader.read(3 + 3);
  if (type === 1 || type === 2) reader.read(1);
  return ['extend', 'walk', 'run'][type];
}

/** Sign-extends a 5-bit offset. */
function signed5(value) {
  return value > 15 ? value - 32 : value;
}

/**
 * Decodes the bit section of a player-update packet: the view size before this update, how many
 * players were dropped, and which were added with their offsets from the viewer. Appearance and
 * other extended data follow the bit section and are not decoded.
 */
export function parsePlayerInfo(payload) {
  const reader = new BitReader(payload);
  const local = readMovement(reader, { local: true });
  const before = reader.read(8);
  let removed = 0;
  for (let i = 0; i < before; i++)
    if (readMovement(reader, { local: false }) === 'removed') removed++;
  const added = [];
  while (reader.remaining >= 11) {
    const pid = reader.read(11);
    if (pid === 2047) break;
    const dx = signed5(reader.read(5));
    const dz = signed5(reader.read(5));
    reader.read(1); // jump
    reader.read(1); // extended data follows
    added.push({ pid, dx, dz });
  }
  return { local, before, removed, added, viewSize: before - removed + added.length };
}

export { PLAYER_INFO };
