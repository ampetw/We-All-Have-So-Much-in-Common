#!/usr/bin/env python3
"""Local server so QR scans can reach this computer and load saved media."""

from __future__ import annotations

import json
import mimetypes
import os
import re
import socket
import sys
from email import policy
from email.parser import BytesParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "media-data"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
CODE_RE = re.compile(r"^[a-z0-9]{3,32}$")


def lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def share_origin() -> str:
    return f"http://{lan_ip()}:{PORT}"


def safe_code(value: str) -> str | None:
    code = unquote(value or "").strip().lower()
    return code if CODE_RE.match(code) else None


def parse_multipart(headers, body: bytes):
    content_type = headers.get("Content-Type", "")
    header_blob = f"MIME-Version: 1.0\r\nContent-Type: {content_type}\r\n".encode("utf-8")
    message = BytesParser(policy=policy.default).parsebytes(header_blob + b"\r\n" + body)
    fields: dict[str, bytes] = {}
    files: dict[str, list[tuple[str, str, bytes]]] = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        payload = part.get_payload(decode=True) or b""
        filename = part.get_filename()
        if filename:
            ctype = part.get_content_type() or "application/octet-stream"
            files.setdefault(name, []).append((filename, ctype, payload))
        else:
            fields[name] = payload
    return fields, files


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload, status=200):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_index(self):
        path = ROOT / "index.html"
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = unquote(self.path.split("?", 1)[0])
        if path == "/api/origin":
            self.send_json({"origin": share_origin(), "local": f"http://127.0.0.1:{PORT}"})
            return
        media_meta = re.match(r"^/api/media/([^/]+)/?$", path)
        if media_meta:
            code = safe_code(media_meta.group(1))
            if not code:
                self.send_json({"error": "invalid code"}, 400)
                return
            meta_path = DATA / code / "meta.json"
            if not meta_path.exists():
                self.send_json({"error": "not found"}, 404)
                return
            self.send_json(json.loads(meta_path.read_text(encoding="utf-8")))
            return
        media_file = re.match(r"^/media/([^/]+)/([^/]+)$", path)
        if media_file:
            code = safe_code(media_file.group(1))
            name = Path(media_file.group(2)).name
            if not code or name.startswith("."):
                self.send_error(400)
                return
            file_path = DATA / code / name
            if not file_path.exists() or not file_path.is_file():
                self.send_error(404)
                return
            ctype = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if path == "/" or path.startswith("/m/"):
            self.send_index()
            return
        super().do_GET()

    def do_POST(self):
        path = unquote(self.path.split("?", 1)[0])
        match = re.match(r"^/api/media/([^/]+)/?$", path)
        if not match:
            self.send_error(404)
            return
        code = safe_code(match.group(1))
        if not code:
            self.send_json({"error": "invalid code"}, 400)
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length > 80 * 1024 * 1024:
            self.send_json({"error": "too large"}, 413)
            return
        body = self.rfile.read(length) if length else b""
        fields, files = parse_multipart(self.headers, body)
        try:
            meta = json.loads(fields.get("meta", b"{}").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json({"error": "invalid meta"}, 400)
            return
        folder = DATA / code
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.iterdir():
            if old.is_file():
                old.unlink()

        texts = []
        for item in meta.get("texts") or []:
            body_text = str(item.get("body") or "").strip()
            if not body_text:
                continue
            texts.append({"id": str(item.get("id") or f"t{len(texts)+1}"), "body": body_text})

        voices = []
        for key, uploads in files.items():
            if not key.startswith("voice-"):
                continue
            item_id = key[6:]
            filename, ctype, payload = uploads[0]
            ext = ".webm" if "webm" in (ctype or "") else ".m4a" if "mp4" in (ctype or "") else ".webm"
            stored = f"voice-{item_id}{ext}"
            (folder / stored).write_bytes(payload)
            voices.append({"id": item_id, "filename": stored, "type": ctype or "audio/webm"})

        attachments = []
        for key, uploads in files.items():
            if not key.startswith("file-"):
                continue
            item_id = key[5:]
            filename, ctype, payload = uploads[0]
            safe_name = re.sub(r"[^a-zA-Z0-9._-]+", "-", Path(filename).name)[:80] or "file"
            stored = f"file-{item_id}-{safe_name}"
            (folder / stored).write_bytes(payload)
            attachments.append(
                {
                    "id": item_id,
                    "filename": stored,
                    "name": Path(filename).name,
                    "type": ctype or "application/octet-stream",
                }
            )

        saved = {
            "code": code,
            "place": str(meta.get("place") or ""),
            "passenger": str(meta.get("passenger") or ""),
            "date": str(meta.get("date") or ""),
            "memory": str(meta.get("memory") or ""),
            "ombreStart": str(meta.get("ombreStart") or "#e9ca30"),
            "ombreEnd": str(meta.get("ombreEnd") or "#e4451a"),
            "typeColor": str(meta.get("typeColor") or "#000000"),
            "texts": texts,
            "voices": voices,
            "files": attachments,
        }
        (folder / "meta.json").write_text(json.dumps(saved, indent=2), encoding="utf-8")
        self.send_json(saved)


def main():
    DATA.mkdir(exist_ok=True)
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    local = f"http://127.0.0.1:{PORT}"
    share = share_origin()
    print(f"Serving {ROOT}")
    print(f"  This computer: {local}")
    print(f"  Phone QR URL:  {share}")
    print("Keep this window open while people scan tickets.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
