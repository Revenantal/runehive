# 03 · Login investigation

[Headless client experiments](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Can the disposable client establish a normal-player session using the pinned Revision 274 world? Source inspection used the revisions and environment in the [baseline](01-bootstrap.md). The service registry initially reported the world stopped, but a later test revealed an older server process still running.

## Observations

- Before the owner-approved configuration change, the world had engine revision 274, the login service enabled, automatic registration enabled (`website.registration` is false), and `node.production` false.
- In the pinned engine's `src/server/login/LoginThread.ts`, when `node.production` is false, the login thread sets the response staff level to 4, including when the login service is enabled. The source labels this developer access with destructive commands.
- In `src/util/WorldConfig.ts`, an existing `data/config/world.json` is loaded directly. The legacy `NODE_PRODUCTION` setting is read while migrating a legacy environment file, not as a runtime override of an existing world configuration.
- In the pinned browser client's `src/client/Client.ts`, login involves an initial handshake, server seed, revision and checksums, an RSA-encrypted credential block and stream cipher setup. The result includes a staff level. These are source observations, not evidence that a headless login works.
- The upstream SQLite schema gives new accounts a default staff level of 0, but the non-production login thread overrides the response. After the approved configuration change and restart, two successful experimental logins reported staff level 0 from the normal login response.

## Results and service issue

The owner approved changing the existing world's `node.production` setting to true; this was the only server configuration edit. A new startup reported ready but then failed with `EADDRINUSE` on the game port. An older unmanaged server process remained running with the previous configuration, even though `runehive status` reported stopped. A single initial experimental protocol login reached that old process, returned an accepted response with client-visible staff level 2 (the server caps this response at 2), and was immediately disconnected; no gameplay was performed. With the owner's approval, the old process was signaled and the server restarted using the updated configuration. A later protocol login and the CLI login both received acceptance with client-visible staff level 0. No server source was changed.

## Further test observations

- In a later controlled experiment, a human-only read-only database check found no matching account before the first attempt. The client then received an ordinary-player login acceptance. After disconnecting and waiting for the session to be released, it received another ordinary-player acceptance using the same credential. A subsequent human-only database check found one account associated with two recorded sessions. The client did not use these database checks as observations.
- A deliberately incorrect password for an account previously accepted by the new server returned protocol code 3. The pinned browser client labels code 3 invalid username or password; the server's response alone does not specify which was wrong. A subsequent attempt with the matching credential was accepted with staff level 0. This verifies reauthentication, not persistence of character state.
- The prototype fetches `/crc` and opens the normal game TCP port, using public login-key parameters from the pinned browser client. Its initial login and flags are decoded; post-login game packets are discarded. A user-triggered stop closes the socket without issuing a game logout.

## Remaining limitations

- The experimental account is entered at the CLI prompt or supplied through an environment variable; automatic allocation and client-side verification that a chosen name was previously unused remain unresolved. The controlled database check verified freshness only for the tested account, as a human diagnostic. The client cannot yet verify persistent character identity or state from game packets.
- Two attempts to log back in soon after abruptly disconnecting received protocol code 5, indicating an existing login according to the pinned server. A later attempt succeeded after the server recorded the prior account session as logged out. Immediate socket closure is not a clean game logout, and there was no fixed-duration guarantee established. Session maintenance, clean logout, reconnect semantics, and behavior across server restarts remain unverified. The fixed public key is tied to the pinned browser client and could be incompatible with a differently configured vanilla world.
- The service registry failed to detect the pre-existing process, and the new start reported ready before a later port-binding failure. Treat these as service-management gaps; neither is fixed by this experiment.
