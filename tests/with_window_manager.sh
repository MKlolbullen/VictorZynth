#!/usr/bin/env bash
# Run inside Xvfb, with a real EWMH window manager for native editor tests.
set -Eeuo pipefail
openbox --sm-disable >/tmp/aetherwave-openbox.log 2>&1 &
wm_pid=$!
trap 'kill "$wm_pid" 2>/dev/null || true' EXIT
ready=false
for attempt in {1..50}; do
    if xprop -root _NET_SUPPORTING_WM_CHECK | grep -q 'window id'; then
        ready=true
        break
    fi
    kill -0 "$wm_pid"
    sleep 0.1
done
if [[ "$ready" != true ]]; then
    cat /tmp/aetherwave-openbox.log
    echo 'FAIL: window manager did not initialise' >&2
    exit 1
fi
"$@"
