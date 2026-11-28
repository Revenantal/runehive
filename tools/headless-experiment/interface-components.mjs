/** Button types the client defines; only continue is used by the dialogue experiment. */
export const BUTTON_CONTINUE = 6;

/** Decodes the structural fields of the client's interface archive, skipping graphics and styling. */
export function decodeInterfaces(data) {
  if (!(data instanceof Uint8Array) || data.length < 2) throw new Error('INVALID_INTERFACE_DATA');
  let cursor = 0;
  /** Takes bounded bytes or fails on truncation. */
  function take(n) {
    if (cursor + n > data.length) throw new Error('TRUNCATED_INTERFACE_DATA');
    const start = cursor;
    cursor += n;
    return start;
  }
  /** Reads one unsigned byte. */
  const g1 = () => data[take(1)];
  /** Reads one unsigned big-endian 16-bit value. */
  const g2 = () => (data[take(2)] << 8) | data[cursor - 1];
  /** Skips a newline-terminated client string and returns its text. */
  function string() {
    const start = cursor;
    while (g1() !== 10) {
      // Scan to the terminator.
    }
    return Buffer.from(data.subarray(start, cursor - 1)).toString('latin1');
  }
  const count = g2();
  const components = new Map();
  let layer = -1;
  while (cursor < data.length) {
    let id = g2();
    if (id === 65535) {
      layer = g2();
      id = g2();
    }
    const type = g1();
    const component = {
      id,
      layerId: layer,
      type,
      buttonType: g1(),
      children: [],
      text: null,
      objectOptions: false,
      objectUse: false,
      options: [],
    };
    take(2); // client code
    component.width = g2();
    component.height = g2();
    take(1); // transparency
    if (g1() !== 0) g1(); // over-layer
    for (let i = g1(); i > 0; i--) take(3); // script comparators
    for (let i = g1(); i > 0; i--) take(g2() * 2); // scripts
    if (type === 0) {
      take(2 + 1); // scroll height, hidden flag
      for (let i = g2(); i > 0; i--) {
        component.children.push(g2());
        take(4); // child x and y
      }
    }
    if (type === 1) take(3);
    if (type === 2) {
      take(1); // swap
      component.objectOptions = g1() === 1;
      component.objectUse = g1() === 1;
      take(1 + 2); // replace flag and margins
      for (let i = 0; i < 20; i++) {
        if (g1() === 1) {
          take(4);
          string();
        }
      }
      component.options = Array.from({ length: 5 }, string).map((text) => text || null);
    }
    if (type === 3) take(1);
    if (type === 4 || type === 1) take(3);
    if (type === 4) {
      component.text = string();
      string();
    }
    if (type === 1 || type === 3 || type === 4) take(4);
    if (type === 3 || type === 4) take(12);
    if (type === 5) {
      string();
      string();
    }
    if (type === 6) {
      if (g1() !== 0) g1();
      if (g1() !== 0) g1();
      if (g1() !== 0) g1();
      if (g1() !== 0) g1();
      take(6);
    }
    if (type === 7) {
      take(3 + 4 + 4 + 1);
      for (let i = 0; i < 5; i++) string();
    }
    if (component.buttonType === 2 || type === 2) {
      string();
      string();
      take(2);
    }
    if ([1, 4, 5, 6].includes(component.buttonType)) component.buttonText = string();
    components.set(id, component);
  }
  if (components.size === 0 || count <= Math.max(...components.keys()))
    throw new Error('INVALID_INTERFACE_DATA');
  return components;
}

/** Lists every continue button in an interface, including those nested inside child layers. */
export function findContinueButtons(components, rootId) {
  const found = [];
  const seen = new Set();
  /** Walks one component's descendants without revisiting any. */
  function visit(id) {
    if (seen.has(id)) return;
    seen.add(id);
    const component = components.get(id);
    if (!component) return;
    if (component.buttonType === BUTTON_CONTINUE) found.push(id);
    component.children.forEach(visit);
  }
  visit(rootId);
  return found;
}

/** Lists the selectable text buttons (button type 1) below an interface, in component order. */
export function findChoiceButtons(components, rootId) {
  const found = [];
  const seen = new Set();
  /** Walks one component's descendants without revisiting any. */
  function visit(id) {
    if (seen.has(id)) return;
    seen.add(id);
    const component = components.get(id);
    if (!component) return;
    if (component.buttonType === 1 && component.type === 4) found.push(id);
    component.children.forEach(visit);
  }
  visit(rootId);
  return found.sort((a, b) => a - b);
}
