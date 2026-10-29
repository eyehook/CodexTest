#!/bin/bash
# Double-click in Finder, or run this file from Terminal.
set -u
# The launcher lives at the root of the checkout it serves.
SITE_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
ADB='/Applications/Meta Quest Developer Hub.app/Contents/Resources/bin/adb'
PORT=8080
fail() {
  printf '\n%s\n' "$1"
  if [[ -t 0 ]]; then read -r -p 'Press Return to close… ' unused; fi
  exit 1
}
[[ -f "$SITE_DIR/index.html" && -f "$SITE_DIR/projects/forest/index.html" ]] || fail "Cannot find the website at $SITE_DIR"
[[ -x "$ADB" ]] || fail 'Install Meta Quest Developer Hub in Applications first.'
command -v python3 >/dev/null 2>&1 || fail 'Python 3 was not found.'

printf 'Checking your Quest…\n'
DEVICE_LIST="$("$ADB" devices)" || fail 'Could not start ADB.'
SERIALS=()
while read -r serial state remainder; do
  [[ "$state" == device ]] && SERIALS+=("$serial")
done <<< "$DEVICE_LIST"
if [[ ${#SERIALS[@]} -eq 0 ]]; then
  printf '%s\n' "$DEVICE_LIST"
  fail 'Connect and unlock the Quest. If it says unauthorized, accept USB debugging inside the headset, then run this script again.'
fi
[[ ${#SERIALS[@]} -eq 1 ]] || fail 'More than one ADB device is connected. Disconnect the others and run this script again.'
SERIAL="${SERIALS[0]}"

# Reuse a server only if its project index matches this checkout.
if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/index.html" | cmp -s "$SITE_DIR/index.html" -; then
  printf 'The VR web server is already running.\n'
  SERVER_PID=''
else
  if /usr/sbin/lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
    fail 'Port 8080 is being used by another server. Stop that server and try again.'
  fi
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SITE_DIR" &
  SERVER_PID=$!
  cleanup() { [[ -z "$SERVER_PID" ]] || kill "$SERVER_PID" 2>/dev/null || true; }
  trap cleanup EXIT
  trap 'exit 0' INT TERM
  READY=0
  for attempt in {1..30}; do
    if curl -fsS --max-time 1 "http://127.0.0.1:$PORT/index.html" 2>/dev/null | cmp -s "$SITE_DIR/index.html" -; then READY=1; break; fi
    kill -0 "$SERVER_PID" 2>/dev/null || break
    sleep .2
  done
  [[ "$READY" -eq 1 ]] || fail 'The web server could not start.'
fi

"$ADB" -s "$SERIAL" reverse tcp:$PORT tcp:$PORT || fail 'USB forwarding failed. Reconnect the Quest and try again.'
printf '\nReady! Open in Meta Quest Browser:\n\n  Projects: http://localhost:8080/\n  Forest:   http://localhost:8080/projects/forest/\n\nServing your local Documents/GitHub/CodexTest checkout.\nEdits here appear locally; commit and push to update GitHub Pages.\nKeep the USB cable connected. Run this script again after reconnecting if needed.\n'
if [[ -n "$SERVER_PID" ]]; then
  printf '\nKeep this window open. Press Control-C to stop the server.\n'
  wait "$SERVER_PID"
else
  printf '\nThe existing server will keep running in its original window.\n'
  if [[ -t 0 ]]; then read -r -p 'Press Return to close this window… ' unused; fi
fi
