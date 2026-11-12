# Local VR preview and JSON captures

`Start-VR.command` launches `tools/vr_server.py`, serves the checkout on
`http://localhost:8080/`, and reverse-forwards that port to the USB-connected
Quest. It requires Python 3 and Meta Quest Developer Hub's ADB, as before.
No additional Python packages are needed.

Stop an older static server before restarting the launcher. Reuse checks now
require a capture-capable server for the same checkout, not just matching HTML.

For desktop development without a headset:

```sh
python3 tools/vr_server.py --directory . --port 8080
```

Static pages and relative assets are served as before. Binding stays on
`127.0.0.1`; the existing ADB reverse supplies Quest access. Keep the terminal
and USB connection active. The launcher stops only a server it started.

## Discovery

`GET /__debug/info` returns JSON, including:

```json
{
  "server": "CodexTest VR",
  "version": 1,
  "siteDirectory": "/path/to/CodexTest",
  "capturesDirectory": "/path/to/CodexTest/.captures",
  "captureEndpoint": "/__debug/captures/{project}",
  "maxCaptureBytes": 33554432
}
```

Clients can use this to detect upload support. GitHub Pages and ordinary static
servers do not provide the receiver. Do not attempt cross-origin uploads to a
computer from a public Pages session; retain/export the JSON instead.

## Upload contract

Send `POST /__debug/captures/<project>` with `Content-Type: application/json`
and a JSON object or array. Fetch supplies Content-Length automatically. Project
names are 1–64 ASCII letters, digits, underscores or hyphens, starting with a
letter/digit; names are case sensitive (for example, `hike` or `secretGarden`).
The payload schema is owned by the project; the server does not require a
particular profiler format or modify the JSON. A version and capture ID in the
payload are useful for analysis and identifying repeated retries.

```js
async function sendCapture(project, capture) {
  const response = await fetch(`/__debug/captures/${encodeURIComponent(project)}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(capture),
  });
  if (!response.ok) throw new Error(`Capture upload failed (${response.status})`);
  return response.json();
}

const result = await sendCapture('hike', {
  version: 1,
  captureId: crypto.randomUUID(),
  appVersion: '0.19.0',
  samples: [],
});
```

Success is **201 Created**, after the file has been completely written:

```json
{"ok":true,"project":"hike","file":"hike/20261112T031000.123456Z-a12b34c56d78.json","bytes":92}
```

`file` is relative to `capturesDirectory`, not a downloadable URL. Captures are
saved under `.captures/<project>/<UTC-timestamp>-<random-id>.json`; unique names
and exclusive creation prevent overwriting existing files. The terminal logs
each saved absolute path. `.captures/` is Git-ignored and its contents are not
served over HTTP. Codex can read these local files directly when asked to analyze
a capture. No capture files need to be committed or pushed.

Keep the headset's copy until the server acknowledges success. Network or save
failures should leave a retry/export option. If a response is lost after a save,
a retry may create another file; use the payload capture ID to recognize it.
Uploading is implemented here; projects provide their own capture UI/recorder.
Hike now has a [30-second profiling workflow](../projects/hike/PROFILING.md).

## Limits and failures

- Maximum body: **32 MiB**; receive timeout: **10 seconds**.
- Only JSON objects/arrays are accepted; malformed JSON, non-finite numbers and
  invalid/truncated lengths return an error rather than writing a file.
- The receiver checks localhost Host and same-origin Origin headers, sends no
  cross-origin permissions, and accepts native clients without an Origin header.
- Error responses are JSON with `ok: false` and `error`: 400 invalid body/length,
  403 origin/host, 404 endpoint/project, 408 timeout, 411 missing length,
  413 oversized body, 415 content type, 500 save failure.
- Projects cannot specify a filename or arbitrary destination path.

Optional `--captures-directory /absolute/path` changes storage when running the
Python server manually. `/__debug/info` reports the actual directory. The launcher
uses the default checkout-local `.captures` directory.

## Validation

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/tools -p 'test_*.py'
bash -n Start-VR.command
git diff --check
```

These focused tooling checks cover static preview, capability discovery,
project-scoped saves, concurrency, input/origin limits, save failures and launcher
reuse checks. They do not require a headset. A physical USB upload remains a
separate integration check; no browser runtime/project code changes are needed
for server-only maintenance.
