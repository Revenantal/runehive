# Multiple actions in one session

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Can a trusted, hand-written script read client-observed starting state, request A → B → A, and use action outcomes while one ordinary-player session and one position tracker remain active? Use the owner-prepared disposable main-world character, the existing current-region client assets, the pinned Revision 274 world, and the shared production-mode server. Assets are verified separately through ordinary client interfaces. The current snapshot does not fully reconstruct dynamic scene changes.

## Success defined before running

For a normal run, capture A from the client's observed position, choose a nearby predeclared B on the same level, and run two sequential `moveTo` calls in one session. Report success only if the first action observes B and the second observes the original A, with no relevant lost or invalidated observations. The script must not issue the return action if the first outcome is unknown.

For a separate controlled case, after the first movement request is sent, deliberately invalidate the experiment's observation confidence. The expected result is `unknown` and **no second movement request**. Continue observing for a bounded period to see whether the already-sent request can still move the character; absence of movement is not proof that it was cancelled. This is a synthetic invalidation of confidence, not a claim that a real network failure or live scene change was reproduced. Never assume a timeout or logout cancels movement.

Neither experiment executes generated code or tests a security boundary. A session/scene invalidation must not be reported as a confirmed failure or obstruction.

## Observations

The normal run used one accepted ordinary-player session and one state tracker. It sent two movement requests and observed the character go from (3222, 3217), through (3222, 3218), to B at (3222, 3219), then through (3222, 3218) back to A. Both actions reported `completed`; no relevant scene change or framing/state-decoding error was reported.

In the separate invalidation run, the harness deliberately invalidated confidence immediately after the first request was sent. The first action returned `unknown` with reason `observation-interrupted`, the script reported zero completed legs, and the harness sent **one** movement request, not two. During a subsequent five-second observation, player updates nevertheless showed movement through (3222, 3218) to B at (3222, 3219). Thus the synthetic confidence invalidation stopped the script's next action but did **not** cancel the already-sent walk. The character was last observed at B, then the driver requested logout; logout confirmation was not separately recorded.

## Scope and follow-up

The import-free action program is `tools/headless-experiment/demos/programs/round-trip.mjs`; the retained experiment driver is `tools/headless-experiment/demos/run-round-trip.mjs`. The `normal` and `invalidate` modes are explicit. The driver relies on externally acquired, independently validated `/tmp/abmove-*.bin` current-region files and a fixed prepared starting position; it does not verify those files itself. The original acquisition probe was disposable, not retained. Asset provenance, initial dynamic scene reconciliation, actual connection loss, actual competing actions, safe cancellation and general multi-action lifecycle remain unproven.

The successful round trip supports the basic session/state/action separation for this narrow case. It does not establish a safe runtime for generated scripts or imply that an `unknown` action is physically finished. In particular, scripts must stop on unknown; a production client needs an explicit policy for reconciling or interrupting in-flight work before accepting follow-on actions.
