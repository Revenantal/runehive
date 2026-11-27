# One A-to-B movement script

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Use a deliberately direct, retained experimental script as a baseline before extracting a simpler wrapper. The owner positioned an ordinary character in the main world. Its client-observed starting position was ground-level (3222, 3214). The current-region ground and location data and relevant client configuration were fetched through ordinary client interfaces and validated against the advertised archive checksums and map-file version/checksums. The experimental collision snapshot is static and does not yet reconcile all dynamic changes.

## Success defined before running

Choose a nearby target on the same level, (3222, 3219), and calculate a bounded cardinal route using the current experimental collision grid. Request the calculated waypoints once. Report `completed` only if a later client player update reaches the target; report `unknown` for timeout, interruption, unsupported scene change, or incomplete data. Stop if the observed starting position or region is different, the route is missing or too long, or client framing/state decoding fails. This is not proof of reliable general navigation and should not infer an obstruction from timeout.

## First attempt and retry defined before running

The first attempt observed movement north to (3222, 3216), but the script treated an unclassified zone update as a possible scene change and stopped reporting `completed`. A later login observed the character at (3222, 3217). This later position does not establish exactly when the movement stopped, and logging out must not be treated as an immediate movement cancellation.

Before retrying: begin from the newly observed (3222, 3217), use the same target and validated region snapshot, and decode zone updates so known non-location events do not automatically invalidate the attempt. Any location change, zone reset, malformed update, framing error or loss of position during the request still leaves the result unknown. Require a subsequent player update reaching the target; do not treat the earlier partial movement as proof of arrival.

The retry observed positions (3222, 3218) and (3222, 3219), in order, and reported `completed`, without a reported relevant scene change or decode error. The retained baseline is `tools/headless-experiment/demos/move-a-to-b.mjs`. It explicitly loads already-acquired files and owns connection, packet observation, routing, timeouts and logout; it is intentionally not the desired final script interface. The asset-fetch probe was temporary, and the baseline does not itself verify the on-disk files, so reuse requires independently acquired and verified inputs. Dynamic-scene reconciliation is still incomplete.

## Wrapper comparison defined before running

A trusted, hand-written script with no imports will receive a `moveTo` action from a separate experimental host. From the newly observed position (3222, 3219), it will request a return to (3222, 3217). The host owns session startup, packet observation, route calculation, deadlines and cleanup. As before, report `completed` only if a subsequent position update reaches the destination; relevant location changes or lost observations make the result `unknown`. This is a comparison of script ergonomics, not a sandbox for generated or untrusted JavaScript, nor a general interaction-aware navigation API.

The wrapper comparison completed: the host reported an observed position of (3222, 3217), level 0, after the script requested that target. The action-only script is `tools/headless-experiment/demos/programs/move-to-point.mjs`; its experimental host is `tools/headless-experiment/demos/run-move-program.mjs`, and the reusable movement operation is `tools/headless-experiment/move-action.mjs`. The original baseline remains available for comparison.

The host statically imports exactly this trusted example. Its action still requires a supplied pre-acquired static collision snapshot, accepts only a bounded single-region cardinal path, and does not automatically handle doors or ladders. Snapshot acquisition, integrity validation and dynamic-scene reconciliation are not integrated. `unknown` does not imply that movement has been cancelled: a previously sent request may continue after the host stops waiting. No LLM or generated-code execution was added.

## Observations and open concerns

- **A simple script can hide infrastructure without hiding outcomes.** This example delegates to `moveTo` and returns its result. A longer entrypoint can use ordinary control flow, but it must have a way to respond to an `unknown` outcome instead of blindly continuing as if the character arrived. The exact API and error model are not yet decided.
- **The snapshot is not a current scene.** The experimental host begins monitoring relevant changes only after its initial position is available. It does not reconcile earlier dynamic updates with the static map, independently verify the loaded files, or account for all neighboring-region objects. A successful short walk does not validate those assumptions. The host must not be described as providing a fresh or authoritative collision map.
- **Stopping the wait is not stopping the player.** The first attempt's later observed position differed from the last position recorded by its driver. We do not know the exact timing, but the experience demonstrates that the client cannot assume a pending movement has ceased simply because it timed out or logged out. The current action releases its single-flight guard after an `unknown` result even though the prior server-side movement may still be active. Cancellation, interruption and safe sequencing need explicit investigation before looping or issuing follow-on actions automatically.
- **Observation is not perfect attribution.** Reaching the target after a request is evidence of arrival, but this prototype does not prove the request alone caused it or fully account for other players' actions, server-side changes, skipped updates or simultaneous inputs. Missing updates and discontinuities must invalidate confidence rather than manufacture an outcome.
- **General routing is not demonstrated.** This test has one nearby target on one level, using a cardinal route in one supplied region. The wrapper does not plan door or ladder interactions, navigate across regions or levels, or recover from arbitrary interruptions. The earlier door demonstration was a separate location-specific script.
- **A convenient entrypoint is not a security boundary.** The host imports a trusted local module with normal Node.js authority. It is not safe isolation for model-written or human-supplied code. Before any such execution, separately design and review the execution boundary, available capabilities, resource and time limits, cancellation, logging and credential handling. Human nudges remain advisory.

## Follow-up questions

Determine how actions expose progress, unknown outcomes and safe cancellation; how scripts are stopped and cleaned up; how loops are bounded and monitored; and how fresh observations, verified assets and dynamic location changes reach the navigation system. Retain the action-only script and the explicit baseline for comparing future approaches, rather than treating this host as the production API.
