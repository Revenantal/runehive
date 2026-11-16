# Live gameplay checks

Placeholder for checks that run against the private Revision 274 world. They are not part of `npm test`: they need a running LostCity world and may need model credentials.

Name these files `*.live.mjs` so the default suite skips them, and document each one's starting character state, available observations, expected result, and in-game evidence, as described in the [testing guide](../../docs/standards/testing-and-verification.md). First real use is expected in M1.
