# 0008. One LostCity server at a time

- **Status:** Accepted
- **Date:** 2026-11-26

## Context

During the headless client experiments, two LostCity servers ran from the same checkout: one on the owner's host and one in an agent's sandbox that mounts the same directory. Each had its own players, slots and world, and both used the same SQLite file. Browser characters and headless clients on different servers could not see each other, and several hours of results were misread as a client bug. The service manager decided "already running?" from a PID file and a process scan, and neither works across machines.

## Decision

Exactly one LostCity server runs for a checkout, on one machine, at any time.

- Everything that needs the world (browsers, headless clients, agents) connects to that one server.
- `start` writes a lock file, `lostcity/.runehive/lostcity.owner`, with the machine name. It refuses to start while another machine holds it, and `stop` refuses to touch a server another machine holds. `status` reports `remote` or `conflict` in those cases.
- The lock is created exclusively, so two machines starting at once cannot both win.
- Server configuration cannot enforce this. LostCity has no setting for a single instance across machines, and its port and SQLite file give no protection across the machine boundary.

## Consequences

If a machine crashes without stopping the server, its lock stays and blocks `start` elsewhere. The message names the holder. After confirming that server is gone, delete `lostcity/.runehive/lostcity.owner`. A server started before the lock existed has no lock until it is restarted. Agents must not start a server unless `status` reports `stopped`, and must never start one for a test the owner's server can serve.
