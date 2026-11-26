import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { Isaac } from './isaac.mjs';
import { PacketStream } from './packets.mjs';

// Public parameters from the pinned browser client's bundled login implementation.
const EXPONENT = 58778699976184461502525193738213253649000149147835990136706041084440742975821n;
const MODULUS =
  7162900525229798032761816791230527296329313291232324290237849263501208207972894053929065636522363163621000728841182238772712427862772219676577293600221789n;

/** Encodes a player name using the protocol's base-37 login routing. */
function loginRoute(name) {
  let value = 0n;
  for (const c of name.trim().toLowerCase().slice(0, 12)) {
    value *= 37n;
    if (c >= 'a' && c <= 'z') value += BigInt(c.charCodeAt(0) - 96);
    else if (c >= '0' && c <= '9') value += BigInt(c.charCodeAt(0) - 21);
  }
  while (value !== 0n && value % 37n === 0n) value /= 37n;
  return Number((value >> 16n) & 31n);
}

/** Encrypts the login block with the public browser-client key. */
function encrypt(bytes) {
  let base = BigInt(`0x${bytes.toString('hex')}`);
  let exp = EXPONENT;
  let result = 1n;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % MODULUS;
    base = (base * base) % MODULUS;
    exp >>= 1n;
  }
  let hex = result.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let encrypted = Buffer.from(hex, 'hex');
  if (encrypted[0] & 0x80) encrypted = Buffer.concat([Buffer.from([0]), encrypted]);
  return Buffer.concat([Buffer.from([encrypted.length]), encrypted]);
}

/** Buffers a socket stream and resolves reads without losing fragmented bytes. */
function makeReader(socket) {
  let buffer = Buffer.alloc(0);
  let failure;
  let waiter;
  const wake = () => {
    if (waiter) {
      const current = waiter;
      waiter = undefined;
      current();
    }
  };
  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);
    wake();
  });
  socket.on('error', () => {
    failure = true;
    wake();
  });
  socket.on('close', () => {
    failure = true;
    wake();
  });
  socket.on('timeout', () => {
    failure = true;
    socket.destroy();
    wake();
  });
  return {
    /** Waits for a fixed number of bytes or a bounded socket failure. */
    async read(count) {
      while (buffer.length < count) {
        if (failure) throw new Error('TRANSPORT_FAILURE');
        await new Promise((resolve) => {
          waiter = resolve;
        });
      }
      const value = buffer.subarray(0, count);
      buffer = buffer.subarray(count);
      return value;
    },
    /** Hands every later chunk, including any already buffered, to the handler. */
    stream(onChunk) {
      socket.removeAllListeners('data');
      const pending = buffer;
      buffer = Buffer.alloc(0);
      socket.on('data', onChunk);
      if (pending.length) onChunk(pending);
      socket.resume();
    },
  };
}

/** Opens one bounded login attempt, returning only protocol-visible status. */
export async function login({
  account,
  password = account,
  host = '127.0.0.1',
  port = 43594,
  webPort = 8888,
  crcs: knownCrcs = null,
  fetcher = fetch,
  connect = net.createConnection,
  random = randomBytes,
  onBytes = () => {},
  deviceId = 1337,
  onPacket = null,
}) {
  if (
    typeof account !== 'string' ||
    !/^[\x20-\x7e]{1,12}$/.test(account) ||
    typeof password !== 'string' ||
    !/^[\x20-\x7e]{1,20}$/.test(password)
  )
    throw new Error('INVALID_CREDENTIAL_FORMAT');
  if (!Number.isInteger(deviceId) || deviceId < 0 || deviceId > 0x7fffffff)
    throw new Error('INVALID_DEVICE_ID');
  let crcs = knownCrcs;
  if (crcs === null) {
    let response;
    try {
      response = await fetcher(`http://${host}:${webPort}/crc`, {
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Error('CACHE_UNAVAILABLE');
    }
    if (!response.ok) throw new Error('CACHE_UNAVAILABLE');
    crcs = Buffer.from(await response.arrayBuffer());
  }
  if (crcs.length !== 40) throw new Error('INVALID_CACHE_RESPONSE');
  const socket = connect({ host, port });
  socket.setTimeout(15_000);
  const reader = makeReader(socket);
  try {
    socket.write(Buffer.from([14, loginRoute(account)]));
    const hello = await reader.read(9);
    if (hello[8] !== 0) return { kind: 'rejected', code: hello[8], socket };
    const seed = await reader.read(8);
    const uid = Buffer.alloc(4);
    uid.writeInt32BE(deviceId);
    const clientSeed = random(8);
    const credentials = Buffer.concat([
      Buffer.from([10]),
      clientSeed,
      seed,
      uid,
      Buffer.from(`${account}\n${password}\n`, 'ascii'),
    ]);
    const encrypted = encrypt(credentials);
    const body = Buffer.concat([Buffer.from([255, 1, 18, 0]), crcs.subarray(0, 36), encrypted]);
    socket.write(Buffer.concat([Buffer.from([16, body.length]), body]));
    const code = (await reader.read(1))[0];
    if (code !== 2) return { kind: 'rejected', code, socket };
    const flags = await reader.read(2);
    socket.setTimeout(0);
    const seeds = [
      clientSeed.readInt32BE(0),
      clientSeed.readInt32BE(4),
      seed.readInt32BE(0),
      seed.readInt32BE(4),
    ];
    const cipher = new Isaac(seeds);
    // The server-to-client direction uses the same seeds plus 50, as the pinned client does.
    const packets = onPacket ? new PacketStream(new Isaac(seeds.map((s) => (s + 50) | 0))) : null;
    reader.stream((chunk) => {
      onBytes(chunk.length);
      if (!packets) return;
      for (const packet of packets.push(chunk)) onPacket(packet);
      if (packets.broken) onPacket({ broken: packets.broken });
    });
    return {
      kind: 'accepted',
      staffLevel: flags[0],
      socket,
      /** Sends one ISAAC-encoded interface button click for the given component id. */
      sendButton(component) {
        if (!Number.isInteger(component) || component < 0 || component > 0xffff)
          throw new Error('INVALID_COMPONENT');
        socket.write(Buffer.from([(9 + cipher.nextInt) & 255, component >> 8, component & 255]));
      },
      /** Sends one ISAAC-encoded character-design packet: gender, seven body parts, five colours. */
      sendDesign({ gender, parts, colors }) {
        const valid =
          (gender === 0 || gender === 1) &&
          Array.isArray(parts) &&
          parts.length === 7 &&
          parts.every((n) => Number.isInteger(n) && n >= -1 && n <= 254) &&
          Array.isArray(colors) &&
          colors.length === 5 &&
          colors.every((n) => Number.isInteger(n) && n >= 0 && n <= 254);
        if (!valid) throw new Error('INVALID_DESIGN');
        const body = [gender, ...parts.map((n) => (n === -1 ? 255 : n)), ...colors];
        socket.write(Buffer.from([(125 + cipher.nextInt) & 255, ...body]));
      },
      /** Sends one ISAAC-encoded walk request: a start tile and up to 24 waypoint offsets from it. */
      sendWalk({ startX, startZ, steps, run = false }) {
        const valid =
          Number.isInteger(startX) &&
          startX >= 0 &&
          startX <= 0xffff &&
          Number.isInteger(startZ) &&
          startZ >= 0 &&
          startZ <= 0xffff &&
          Array.isArray(steps) &&
          steps.length >= 1 &&
          steps.length <= 24 &&
          steps.every(
            ([dx, dz]) =>
              Number.isInteger(dx) &&
              Number.isInteger(dz) &&
              dx >= -128 &&
              dx <= 127 &&
              dz >= -128 &&
              dz <= 127,
          );
        if (!valid) throw new Error('INVALID_WALK');
        const payload = [
          run ? 1 : 0,
          startX >> 8,
          startX & 255,
          startZ >> 8,
          startZ & 255,
          ...steps.flatMap(([dx, dz]) => [dx & 255, dz & 255]),
        ];
        socket.write(Buffer.from([(207 + cipher.nextInt) & 255, payload.length, ...payload]));
      },
      /** Sends the protocol's ISAAC-encoded no-timeout opcode. */
      sendKeepalive() {
        socket.write(Buffer.from([(120 + cipher.nextInt) & 255]));
      },
    };
  } catch (error) {
    socket.destroy();
    throw error;
  }
}
