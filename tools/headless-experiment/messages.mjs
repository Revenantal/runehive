/** Reads a game message payload as the client does: text up to the first newline. */
export function gameMessage(payload) {
  if (!(payload instanceof Uint8Array)) throw new Error('INVALID_MESSAGE_PACKET');
  const end = payload.indexOf(10);
  return Buffer.from(payload.subarray(0, end === -1 ? payload.length : end)).toString('latin1');
}
