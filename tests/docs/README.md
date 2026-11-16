# Documentation tests

- `docs-links.test.mjs` checks that relative Markdown links and anchors resolve, and that the docs index and roadmap reach every doc they should.
- `docs-sync.test.mjs` checks the front matter parser and that the generated milestone and plan charts match their source. Fix a failure with `npm run docs:sync`.
