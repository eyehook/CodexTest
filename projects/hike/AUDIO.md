# Forest ambience

`forest-audio.mjs` implements a non-positional stereo wind/vegetation bed from
five local clips. General Settings provides a saved Sound checkbox (default on),
applied with Save and Close. There are no positional transforms, music,
synthetic layers or procedural-wind connections. Terrain, vegetation and movement
algorithms are unchanged. Source provenance, timestamps, preparation and pending
listening review are in [the asset notes](../../assets/hike/audio/README.md).

## Playback

- One AudioContext, requested at 32 kHz with playback latency, is created lazily
  inside an existing activation gesture. Five stereo AudioBuffers are decoded
  sequentially once and reused. A failed load is optional/non-fatal and can retry
  on a later gesture. Ogg is preferred, with per-clip MP3 fallback.
- Two persistent GainNode lanes connect to one master GainNode and destination.
  There is no AudioListener, PannerNode, stereo collapse or camera/rig coupling.
- Clips are selected randomly from the four alternatives to the previous choice.
  The source begins at zero gain, overlaps the outgoing source by **five seconds**,
  then becomes the sole source. At most two clips sound concurrently.
- Cached 128-point sine/cosine curves are scheduled with `setValueCurveAtTime` on
  the AudioContext clock. Their squared gains sum to one; normalized,
  approximately uncorrelated ambience does not receive a doubled overlap gain.
  Natural wind movements can still change perceived loudness within a clip.
- The first clip also fades in over five seconds. Two-lane automation and source
  starts/stops are scheduled **60 seconds ahead**, replenished by an independent
  timer every five seconds. No gain updates or scheduling run in the render loop.
  The loop only reports changes in active/inactive state; node work is deferred
  to a microtask. The ordinary unchanged-state check allocates nothing.
- Web Audio's AudioBufferSourceNode is one-shot: a cheap source node is created
  for each scheduled play, then disconnected/released on `ended`. The expensive
  buffers, two gain lanes and fade curves are reused. A handful of future nodes
  are scheduled, but only two can sound at once. This avoids media-element timing
  jitter and does not decode clips again at transitions.

The lookahead tolerates ordinary timer jitter/stalls while XR is active. A main
thread stall longer than the queued horizon can still produce a gap; the scheduler
rebases future starts rather than trying to replay missed transitions. No browser
implementation can promise uninterrupted output through OS audio interruptions.
`stats.lateRecoveries` and `error` on `window.hike.ambience` expose these conditions.

## Activation and lifecycle

`unlock()` creates/resumes the context synchronously before awaiting downloads.
It is called from Start walking, the existing Enter VR button, session start,
controller select/squeeze and subsequent desktop interaction. An immersive-session
callback alone is not assumed to satisfy autoplay policy.

`setActive(bool)` is idempotent. The saved Sound checkbox gates it; muted
buffers are retained for reuse. Sound is active only after a play/VR request,
with visible/tracked gameplay outside settings, desktop diagnostics and graphics
warm-up. Hidden/untracked frames and session visibility events silence it. Stop
fades the master over 150 ms, retires sources at 160 ms and suspends the context
after 220 ms. Restart reuses the buffers and begins a fresh randomized sequence
after the retiring sources. Session exit stops the bed; a new desktop gesture or
VR entry restarts it. Page exit aborts loads, cancels timers, stops/disconnects
sources, drops buffers and closes the context. Held movement/controller input
policies remain owned by the existing project modules.

At the requested 32 kHz, 100 seconds × 2 channels × 4-byte float requires
**25.6 MB** for decoded audio, plus small graph/encoded-load overhead. If a browser
uses a different context sample rate, decoded memory scales with its actual rate
(38.4 MB at 48 kHz). No full source recording, extra textures or per-frame audio
buffers are retained. Downloads/decode occur after activation, independently of
world generation and the graphics loading gate.

## Validation

`node --test projects/hike/tests/forest-audio.mjs` checks equal-power endpoints,
random selection, source/lane reuse, deferred scheduling, simulated two-hour
continuity, bounded live nodes, rapid stop/restart, suspension/disposal, fallback
and failed/late loads, XR listeners and asset hashes/window/level constraints.

Desktop Web Audio checks and listening/headset results belong in the current
handoff. Automated/offline rendering can establish scheduling, nonzero samples,
stereo and headroom, but cannot establish unobtrusive birds, natural event cuts,
pleasant perceived transitions or stable Quest output over an extended session.
Those require the pending listening/headset review. No spatial-audio transform
validation is applicable to this deliberately non-positional bed.

## Future integration

`ForestAmbience` is independent of Three.js. Its constructor accepts the clip
loader, context factory, random source, master volume and scheduling options.
A later wind integration can add a deliberate control interface here; no reads
of terrain, grass deformation or procedural wind exist now.
