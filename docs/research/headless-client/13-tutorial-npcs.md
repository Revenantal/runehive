# Tutorial NPC perception

[Experiment index](README.md) · [Discovery plan](../../plans/headless-client-discovery.md)

## Question and setup

Can an ordinary fresh player observe nearby NPCs using the `NPC_INFO` packet? Use the pinned Revision 274 world, the shared production-mode server, and a bounded disposable client session. The owner reports that normal tutorial completion is required to reach the main world. No NPC interaction is requested in this first experiment.

## Success defined before running

A successful perception experiment receives an `NPC_INFO` packet, decodes its visibility bit section without losing framing, and reports client-visible NPC indices, type identifiers and relative positions when the client's own position is known. Missing position remains unknown. NPC identity, interaction options and undecoded extended attributes are not inferred from type identifiers. No packet or no decoded NPCs is an observation, not proof that the area has no NPCs.

## Observations

In a 15-second fresh ordinary-client session, the observer received 26 NPC update packets without a reported framing or decoding error. It reported up to five visible entries with positions relative to the observed local player. All five had received extended updates that the prototype does not decode, so their attributes remain unverified. These counts are client observations, not an independent validation of NPC identity or proof that an NPC can be interacted with. No interaction or dialogue was attempted.

## Decoder limitations

The experimental observer tracks visible entries and movement from their bit section. It does not decode extended NPC attributes, names, options, animation, transformations, dialogue, or target actions. It flags entries with undecoded extended attributes as unverified. A caller must reset it after a stream error, build/level change, or loss of continuity. Synthetic tests are not evidence of live correctness.
