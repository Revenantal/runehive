# 0009. Each headless client sends its own device id

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

The server counts login attempts per device id and address. The fifth attempt is refused until 15 seconds pass with no attempt, refused attempts included ([09](../research/headless-client/09-supervisor.md)). The pinned browser client sends the same id every time, so a fleet sharing it admits four clients, then waits. Six clients took about 36 seconds to admit with a supervisor that spaced its logins.

The server does not use the device id for security. It is a throttle key and a session record. Giving each client its own id sidesteps a throttle meant to slow abuse. This is acceptable only because the world is private and owned by the project.

## Decision

Each headless client sends a device id derived deterministically from its own label, so it is stable across reconnects and different for every client. The prototype default (the browser client's id) stays for single-client runs. The per-address limit of 30 logins a minute still applies to the whole fleet and is not worked around.

## Consequences

- Clients can be admitted a second or two apart, with no quiet period.
- A supervisor must still pace logins to respect the per-address limit, and must treat code 16 as a signal to back off, not retry.
- If the project ever connects to a server it does not own, this decision must be revisited; it must not be assumed to be acceptable there.
- Changing the server's limits, or running behind one address, would need new measurements.
