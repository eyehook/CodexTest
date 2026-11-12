#!/usr/bin/env python3
"""Loopback static preview server with a project-scoped JSON capture receiver."""
import argparse
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import socket
from urllib.parse import unquote, urlsplit
from uuid import uuid4

MAX_CAPTURE_BYTES = 32 * 1024 * 1024
PROJECT_ROUTE = re.compile(r"/__debug/captures/([A-Za-z0-9][A-Za-z0-9_-]{0,63})")


def reject_constant(value):
    raise ValueError("Non-finite JSON number: " + value)


class VRHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, site_directory, captures_directory, **kwargs):
        self.site_directory = Path(site_directory).resolve()
        self.captures_directory = Path(captures_directory).resolve()
        super().__init__(*args, directory=str(self.site_directory), **kwargs)

    def json_response(self, status, body):
        data = json.dumps(body, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def local_request(self):
        # Accept Quest's localhost origin through ADB, and desktop loopback.
        authority = self.headers.get("Host", "")
        try:
            host = urlsplit("http://" + authority)
            valid = (host.hostname in ("localhost", "127.0.0.1")
                     and (host.port or 80) == self.server.server_port
                     and not host.username and not host.password
                     and host.path == "")
        except ValueError:
            valid = False
        origin = self.headers.get("Origin")
        if not valid or (origin is not None and origin != "http://" + authority):
            self.json_response(403, {"ok": False, "error": "Use this server's same-origin localhost URL"})
            return False
        return True

    def do_GET(self):
        if urlsplit(self.path).path == "/__debug/info":
            if self.local_request():
                self.json_response(200, {
                    "server": "CodexTest VR", "version": 1,
                    "siteDirectory": str(self.site_directory),
                    "capturesDirectory": str(self.captures_directory),
                    "captureEndpoint": "/__debug/captures/{project}",
                    "maxCaptureBytes": MAX_CAPTURE_BYTES,
                })
            return
        super().do_GET()

    def send_head(self):
        # Saved captures are local files, not additional public preview assets.
        target = Path(self.translate_path(self.path)).resolve()
        if target == self.captures_directory or self.captures_directory in target.parents:
            self.send_error(403, "Capture files are not served")
            return None
        return super().send_head()

    def do_POST(self):
        self.close_connection = True
        if not self.local_request():
            return
        match = PROJECT_ROUTE.fullmatch(unquote(urlsplit(self.path).path))
        if not match:
            self.json_response(404, {"ok": False, "error": "Unknown capture endpoint or invalid project name"})
            return
        if self.headers.get_content_type() != "application/json":
            self.json_response(415, {"ok": False, "error": "Content-Type must be application/json"})
            return
        if self.headers.get("Transfer-Encoding"):
            self.json_response(400, {"ok": False, "error": "Send a fixed-length JSON body"})
            return
        length = self.headers.get("Content-Length")
        if length is None:
            self.json_response(411, {"ok": False, "error": "Content-Length is required"})
            return
        try:
            length = int(length)
            if length < 0:
                raise ValueError()
        except ValueError:
            self.json_response(400, {"ok": False, "error": "Invalid Content-Length"})
            return
        if length > MAX_CAPTURE_BYTES:
            self.json_response(413, {"ok": False, "error": "Capture exceeds the 32 MiB limit"})
            return
        self.connection.settimeout(10)
        try:
            body = self.rfile.read(length)
            if len(body) != length:
                raise ValueError("Incomplete body")
            capture = json.loads(body.decode("utf-8"), parse_constant=reject_constant)
            if not isinstance(capture, (dict, list)):
                raise ValueError("Capture must be a JSON object or array")
        except socket.timeout:
            self.json_response(408, {"ok": False, "error": "Capture upload timed out"})
            return
        except (ValueError, UnicodeError, RecursionError):
            self.json_response(400, {"ok": False, "error": "Invalid JSON object or array"})
            return
        project = match.group(1)
        filename = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ") + "-" + uuid4().hex[:12] + ".json"
        destination = None
        created = False
        try:
            folder = self.captures_directory / project
            folder.mkdir(parents=True, exist_ok=True)
            if folder.is_symlink() or folder.resolve().parent != self.captures_directory:
                raise OSError("Invalid capture directory")
            destination = folder / filename
            # Exclusive creation prevents replacement of any existing file.
            with destination.open("xb") as output:
                created = True
                output.write(body)
                output.write(b"\n")
        except OSError:
            if created:
                try:
                    destination.unlink(missing_ok=True)
                except OSError:
                    pass
            self.json_response(500, {"ok": False, "error": "Could not save capture"})
            return
        self.log_message("Saved capture: %s", destination)
        self.json_response(201, {"ok": True, "project": project, "file": project + "/" + filename, "bytes": len(body)})


def make_server(directory, port=8080, captures_directory=None):
    directory = Path(directory).resolve()
    captures = Path(captures_directory).resolve() if captures_directory else directory / ".captures"
    handler = partial(VRHandler, site_directory=directory, captures_directory=captures)
    return ThreadingHTTPServer(("127.0.0.1", port), handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--captures-directory", type=Path)
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    with make_server(args.directory, args.port, args.captures_directory) as server:
        print("Serving {} at http://localhost:{}/".format(args.directory.resolve(), server.server_port), flush=True)
        print("Saving captures under {}".format((args.captures_directory or args.directory / ".captures").resolve()), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
