import { findChoiceButtons, findContinueButtons } from './interface-components.mjs';

/** Tracks the chat interface the server opens, its text, and whether one continue button exists. */
export function createDialogueObserver(components) {
  let chat = null;
  const recent = new Map();
  /** Reads the component's descendants so text updates outside the open interface are ignored. */
  function members(rootId) {
    const found = new Set();
    /** Adds one component and its children. */
    function visit(id) {
      if (found.has(id) || !components.has(id)) return;
      found.add(id);
      components.get(id).children.forEach(visit);
    }
    visit(rootId);
    return found;
  }
  return {
    /** Applies one framed server packet and returns a dialogue event, or null for other packets. */
    apply(packet) {
      const payload = packet.payload;
      if (packet.name === 'IF_OPENCHAT') {
        if (payload?.length !== 2) throw new Error('INVALID_CHAT_PACKET');
        const id = (payload[0] << 8) | payload[1];
        if (!components.has(id)) {
          chat = null;
          return { type: 'opened', id, known: false };
        }
        chat = {
          id,
          members: members(id),
          texts: new Map(),
          continueButtons: findContinueButtons(components, id),
        };
        // The server sends a page's text before it opens the interface.
        for (const [component, text] of recent)
          if (chat.members.has(component)) {
            chat.texts.set(component, text);
            recent.delete(component);
          }
        const buttons = findChoiceButtons(components, id);
        const choices = buttons.map((component) => ({
          component,
          text: chat.texts.get(component),
        }));
        // A menu is reported only if every button received text from the server.
        const complete = buttons.length > 0 && choices.every((c) => c.text);
        return {
          type: 'opened',
          id,
          known: true,
          continueButtons: [...chat.continueButtons],
          texts: [...chat.texts.values()],
          choices: complete ? choices : buttons.length ? 'incomplete' : [],
        };
      }
      if (packet.name === 'IF_SETTEXT') {
        if (!(payload?.length >= 2)) throw new Error('INVALID_TEXT_PACKET');
        const component = (payload[0] << 8) | payload[1];
        const end = payload.indexOf(10, 2);
        const text = Buffer.from(payload.subarray(2, end === -1 ? payload.length : end)).toString(
          'latin1',
        );
        if (!chat?.members.has(component)) {
          recent.set(component, text);
          if (recent.size > 200) recent.delete(recent.keys().next().value);
          return { type: 'buffered-text', component };
        }
        chat.texts.set(component, text);
        return { type: 'text', component, text };
      }
      if (packet.name === 'IF_CLOSE') {
        const had = chat;
        chat = null;
        recent.clear();
        return { type: 'closed', hadChat: Boolean(had) };
      }
      return null;
    },
    /** Returns the currently open chat interface or null. */
    current() {
      return chat
        ? {
            id: chat.id,
            continueButtons: [...chat.continueButtons],
            texts: [...chat.texts.values()],
          }
        : null;
    },
  };
}
