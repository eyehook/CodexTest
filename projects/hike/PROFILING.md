# Hike profiling

Reload the local Hike page after source changes. On Quest, use the launcher URL:
`http://localhost:8080/projects/hike/`.

1. Press B or Y, select **Debug**, then **Start capture (30 seconds)**.
2. Settings closes. Walk or fly normally for about 30 seconds of active gameplay.
3. A brief completion notice appears. The result is retained on the headset and
   automatically sent to the computer when the local capture receiver is available.
4. Reopen Debug for status and CPU/frame/GPU summaries. **Send capture to computer**
   retries an upload; **Export JSON** downloads a copy.

There is no live profiling dashboard during collection. General and Teleport
remain available; the former Debug tuning controls/readouts are replaced by the
capture workflow. Desktop diagnostics expose the same capture controls.

## Capture behavior

- Collection lasts **30 seconds of active world frames**, excluding Settings,
  hidden/untracked sessions and mode changes. An immersive capture does not
  silently continue as a desktop capture after leaving VR; reenter VR to resume.
- Reopening Debug during collection shows the paused countdown and **Cancel capture**.
  Cancelling retains the previous completed result.
- Only the most recent completed capture is stored in IndexedDB. It survives reloads
  and upload failures. Export an unsent result before replacing it with another
  completed capture if the computer is unavailable. Device-storage failure leaves
  the result in memory; export or upload before closing/reloading that page.
- Automatic upload happens after collection and report processing. GitHub Pages
  has no receiver: the capture remains available for export/retry there.
- The recorder uses an 8,192-frame fixed Float64 buffer (about 1.97 MB), samples
  GPU time every fourth frame with at most eight outstanding queries, and does
  not block waiting for GPU results. Report assembly/JSON serialization run in a
  worker after collection; a failure fallback preserves the report on the main
  thread after recording has stopped.
- Finalization, device storage, export and upload occur outside the measured
  window. Recording itself has some overhead; measurements are not overhead-free.

## Files on the computer

Successful uploads show **Saved to computer**. `Start-VR.command` saves JSON in:

```text
.captures/hike/<UTC-timestamp>-<random-id>.json
```

The folder is Git-ignored. Tell Codex a capture is ready; it can inspect these
local files directly. There is no need to send a browser screenshot or commit
captures to GitHub. [Receiver documentation](../../tools/vr-server.md) describes
server setup and the HTTP contract. Keep the launcher and USB connection active.

## Reading the output

Schema version 1 is a JSON object with:

- `project`, `captureId`, and `metadata`: version, seed, capture mode, settings,
  timestamps, pauses, browser, buffer dimensions, MSAA and available GPU timing.
- `columns` and `samples`: each sample is an array using the corresponding
  column index. Times end in `Ms`; positions/heights are metres. Missing timings
  are `null`, not zero. Movement is 0 walking, 1 gliding, 2 landing runout.
- `summary`: frame count, active duration, means/percentiles/maxima, worst ten
  callback intervals with event/context data, terrain/grass job counts and
  estimated upload bytes.
- `notes`: metric scopes and interpretation limits.

Important distinctions:

- `cpuMs` measures the application callback, including render submission and
  driver work. It is not total device CPU utilization. `renderSubmitMs` is CPU
  submission time, not GPU render time.
- `terrainApplyMs` measures worker results applied between callbacks and is
  reported separately; it must not be blindly added to callback time as though
  it happened inside the same callback. `terrainSnaps`, grass jobs and shadow
  rebuilds help correlate spikes with work.
- `gpuMs` is an asynchronous timer-query measurement of the application render
  scope, including its shadow draws. It excludes compositor/other-app work.
  Unsupported, unsampled, invalid/disjoint and pending results remain null.
- `intervalMs` describes callback cadence. `lateCallbacks` is only computed when
  the headset exposes its refresh rate, using intervals over 1.5 frame budgets;
  it is not a count of compositor dropped/stale frames.
- `estimatedUploadBytes` estimates changed buffer data from versions/ranges;
  it does not measure transfer latency or all driver allocations.
- Color-pass triangles/draw calls come from Three.js's render counters. Shadow
  casters/rebuilds are separate fields; do not assume those counters include
  every pass.

## Maintenance and focused checks

Project-owned modules: `profiler.mjs` (lifecycle/upload), `gpu-timer.mjs`,
`capture-store.mjs`, `profiler-report.mjs` / `profiler-report-worker.mjs`, and
`capture-notice.mjs`. Shared input/control helpers are reused by the menu.

```sh
node --test projects/hike/tests/profiler.mjs projects/hike/tests/settings-menu.mjs projects/hike/tests/field-worker.mjs
```

These cover recording/pause/cancel, report percentiles, storage/upload retry,
GPU-query validity, real worker transfer parity and surrounding menu/worker
behavior. A browser integration check can shorten the duration on that test
instance; the shipped default remains 30 seconds. Test captures should have
`metadata.smokeTest: true` and be removed only after their identity is verified.
Physical Quest capture quality and recording overhead still need real-device
validation. No OVR Metrics/remote debugging configuration is installed here.
