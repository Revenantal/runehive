/** Requests a round trip and stops immediately if either move is unconfirmed. */
export async function main({ state, moveTo }) {
  const start = state.position();
  if (!start) return { outcome: 'unknown', reason: 'position-unknown', completedLegs: 0 };
  const outbound = await moveTo({ x: 3222, z: 3219, level: 0 });
  if (outbound.outcome !== 'completed') return { ...outbound, completedLegs: 0 };
  const inbound = await moveTo(start);
  if (inbound.outcome !== 'completed') return { ...inbound, completedLegs: 1 };
  return { outcome: 'completed', completedLegs: 2, position: inbound.position };
}
