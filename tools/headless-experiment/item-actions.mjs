/** Returns the text the client shows when an object, NPC or item is examined; no server request is sent. */
export function examineText({ name, description, count = 1 }) {
  if (count >= 100000) return `${count} x ${name}`;
  return description ? description : `It's a ${name}.`;
}

/**
 * Lists every action the client would offer for an item in a given inventory component, numbered
 * as the protocol numbers them. Labels come from definitions and are never assumed to be standard.
 */
export function listItemActions({ definition, component }) {
  const actions = [];
  if (component.objectOptions) {
    for (let op = 0; op < 5; op++) {
      const label = definition.inventoryOptions[op];
      if (label) actions.push({ label, kind: 'held', option: op + 1, source: 'item' });
      // The client supplies Drop as option five when the item defines no fifth option.
      else if (op === 4) actions.push({ label: 'Drop', kind: 'held', option: 5, source: 'client' });
    }
    if (component.objectUse)
      actions.push({ label: 'Use', kind: 'use', option: null, source: 'client', supported: false });
  } else {
    component.options.forEach((label, op) => {
      if (label) actions.push({ label, kind: 'button', option: op + 1, source: 'component' });
    });
  }
  actions.push({ label: 'Examine', kind: 'examine', option: null, source: 'client', local: true });
  return actions;
}

/** Numbers NPC or object option labels as the protocol numbers them, skipping empty slots. */
export function numberOptions(labels) {
  return labels.flatMap((label, index) => (label ? [{ label, option: index + 1 }] : []));
}
