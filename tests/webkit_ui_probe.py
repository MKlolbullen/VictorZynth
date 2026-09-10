"""Load the production assets through JUCE's Linux URI scheme in real WebKitGTK."""
import argparse
from pathlib import Path
import sys

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.1")
gi.require_version("Soup", "3.0")
from gi.repository import Gio, GLib, Gtk, Soup, WebKit2

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("assets", type=Path)
parser.add_argument("--screenshot", type=Path)
args = parser.parse_args()
assets = args.assets.resolve()
context = WebKit2.WebContext.new()
requests = []


def resource(request):
    path = request.get_path()
    requests.append(path)
    entries = {"/": ("index.html", "text/html; charset=utf-8"),
               "/assets/app.js": ("assets/app.js", "text/javascript; charset=utf-8"),
               "/assets/style.css": ("assets/style.css", "text/css; charset=utf-8")}
    filename, mime = entries.get(path, (None, "text/plain"))
    body = (assets / filename).read_bytes() if filename else b"not found"
    stream = Gio.MemoryInputStream.new_from_bytes(GLib.Bytes.new(body))
    response = WebKit2.URISchemeResponse.new(stream, len(body))
    headers = Soup.MessageHeaders.new(Soup.MessageHeadersType.RESPONSE)
    headers.append("Content-Type", mime)
    response.set_http_headers(headers)
    response.set_status(200 if filename else 404, None)
    request.finish_with_response(response)


# Match pinned JUCE's scheme registration; do not relax WebKit's origin policy.
context.register_uri_scheme("juce", resource)
view = WebKit2.WebView.new_with_context(context)
view.get_settings().set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.NEVER)
view.get_settings().set_enable_write_console_messages_to_stdout(True)
window = Gtk.Window(title="AetherWave WebKit UI probe")
window.set_default_size(1440, 900)
window.add(view)
window.show_all()
result = 1
finished = False
attempts = 0


def finish(ok, message):
    global result, finished
    if finished:
        return
    finished = True
    result = 0 if ok else 1
    print(("PASS: " if ok else "FAIL: ") + message, flush=True)
    print("Requested resources:", requests, flush=True)
    if args.screenshot:
        args.screenshot.parent.mkdir(parents=True, exist_ok=True)
        def snapshot_done(widget, task, data=None):
            try:
                widget.get_snapshot_finish(task).write_to_png(str(args.screenshot))
            except Exception as error:
                print("Snapshot error:", error, flush=True)
            Gtk.main_quit()
        view.get_snapshot(WebKit2.SnapshotRegion.VISIBLE, WebKit2.SnapshotOptions.NONE,
                          None, snapshot_done, None)
    else:
        Gtk.main_quit()


def checked(widget, task, data=None):
    try:
        rendered = widget.evaluate_javascript_finish(task).to_boolean()
        if rendered:
            finish(True, "production React UI rendered through juce:// in WebKitGTK")
    except GLib.Error as error:
        print("Evaluation error:", error.message, flush=True)


def poll():
    global attempts
    if finished:
        return False
    attempts += 1
    if attempts >= 40:
        finish(False, "React controls did not render within 20 seconds")
        return False
    view.evaluate_javascript("""Boolean(document.getElementById('root') &&
        document.querySelectorAll('#root button').length > 10 &&
        document.querySelectorAll('#root canvas').length > 0 &&
        document.getElementById('root').getBoundingClientRect().height > 400)""",
        -1, None, None, None, checked, None)
    return True


view.connect("load-failed", lambda widget, event, url, error:
             print("Load failed:", url, error.message, flush=True) or False)
view.load_uri("juce://juce.backend/")
GLib.timeout_add(500, poll)
Gtk.main()
sys.exit(result)
