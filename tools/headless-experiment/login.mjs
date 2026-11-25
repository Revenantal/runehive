import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { Isaac } from './isaac.mjs';

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
    /** Discards subsequent packets until packet decoding is implemented. */
    discard(onBytes) {
      socket.removeAllListeners('data');
      if (buffer.length) onBytes(buffer.length);
      buffer = Buffer.alloc(0);
      socket.on('data', (data) => onBytes(data.length));
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
  fetcher = fetch,
  connect = net.createConnection,
  random = randomBytes,
  onBytes = () => {},
}) {
  if (
    typeof account !== 'string' ||
    !/^[\x20-\x7e]{1,12}$/.test(account) ||
    typeof password !== 'string' ||
    !/^[\x20-\x7e]{1,20}$/.test(password)
  )
    throw new Error('INVALID_CREDENTIAL_FORMAT');
  let response;
  try {
    response = await fetcher(`http://${host}:${webPort}/crc`, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('CACHE_UNAVAILABLE');
  }
  if (!response.ok) throw new Error('CACHE_UNAVAILABLE');
  const crcs = Buffer.from(await response.arrayBuffer());
  if (crcs.length !== 40) throw new Error('INVALID_CACHE_RESPONSE');
  const socket = connect({ host, port });
  socket.setTimeout(15_000);
  const reader = makeReader(socket);
  try {
    socket.write(Buffer.from([14, loginRoute(account)]));
    const hello = await reader.read(9);
    if (hello[8] !== 0) return { kind: 'rejected', code: hello[8], socket };
    const seed = await reader.read(8);
    const uid = Buffer.from([0, 0, 5, 57]);
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
    reader.discard(onBytes);
    socket.setTimeout(0);
    const cipher = new Isaac([
      clientSeed.readInt32BE(0),
      clientSeed.readInt32BE(4),
      seed.readInt32BE(0),
      seed.readInt32BE(4),
    ]);
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
