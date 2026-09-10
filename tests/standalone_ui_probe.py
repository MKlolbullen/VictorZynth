"""Check the real standalone editor's readiness report and capture its window."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("executable", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
report = args.output.resolve() / "standalone-ui.json"
report.unlink(missing_ok=True)
with (args.output / "standalone.log").open("w") as log:
    process = subprocess.Popen([str(args.executable.resolve())], stdout=log, stderr=subprocess.STDOUT,
                               start_new_session=True,
                               env={**os.environ, "AETHERWAVE_UI_REPORT": str(report)})
    try:
        deadline = time.monotonic() + 35
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise SystemExit(f"FAIL: standalone exited with code {process.returncode}")
            try:
                status = json.loads(report.read_text())
            except (OSError, ValueError):
                status = {}
            if status.get("status") == "failed":
                raise SystemExit("FAIL: " + status.get("detail", "WebView failed"))
            if status.get("status") == "ready":
                time.sleep(0.5)
                subprocess.run(["import", "-window", "root", str(args.output / "standalone-ui.png")],
                               check=True, timeout=5)
                print("PASS: standalone React/CSS/canvas rendering and native bridge round-trip")
                break
            time.sleep(0.1)
        else:
            raise SystemExit("FAIL: standalone UI did not become ready within 35 seconds")
    finally:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=5)
