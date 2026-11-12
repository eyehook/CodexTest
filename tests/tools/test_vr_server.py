import concurrent.futures
import http.client
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('vr_server', ROOT / 'tools/vr_server.py')
vr_server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vr_server)

class CaptureServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.site = Path(self.temp.name)
        (self.site / 'index.html').write_text('local preview')
        self.server = vr_server.make_server(self.site, 0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port
        self.origin = 'http://127.0.0.1:' + str(self.port)
    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.temp.cleanup()
    def request(self, method='GET', path='/__debug/info', body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=3)
        headers = dict(headers or {})
        if body is not None: headers.setdefault('Content-Type', 'application/json')
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        result = response.status, response.read()
        connection.close()
        return result
    def capture(self, project='hike', value=None):
        body = json.dumps(value if value is not None else {'samples': [1, 2]}).encode()
        return self.request('POST', '/__debug/captures/' + project, body, {'Origin': self.origin})
    def test_preview_and_info(self):
        self.assertEqual(self.request('GET', '/index.html'), (200, b'local preview'))
        status, raw = self.request(); info = json.loads(raw)
        self.assertEqual(status, 200); self.assertEqual(info['server'], 'CodexTest VR')
        self.assertEqual(info['siteDirectory'], str(self.site.resolve()))
        self.assertEqual(self.server.server_address[0], '127.0.0.1')
    def test_unique_project_scoped_json_saves(self):
        files = []
        for project, value in [('hike', {'note': 'seated ✓'}), ('secretGarden', [1, 2]), ('hike', {})]:
            status, raw = self.capture(project, value); self.assertEqual(status, 201)
            saved = json.loads(raw); file = self.site / '.captures' / saved['file']
            self.assertEqual(file.parent.name, project); self.assertEqual(json.loads(file.read_text()), value); files.append(file)
        self.assertEqual(len(set(files)), 3)
        self.assertEqual(self.request('GET', '/.captures/hike/' + files[0].name)[0], 403)
        self.assertEqual(self.request('HEAD', '/.captures/')[0], 403)
    def test_name_collision_does_not_replace_or_delete_existing_capture(self):
        status, raw = self.capture(value={'original': True})
        self.assertEqual(status, 201)
        file = self.site / '.captures' / json.loads(raw)['file']
        timestamp, suffix = file.stem.rsplit('-', 1)
        with patch.object(vr_server, 'datetime') as clock, patch.object(vr_server, 'uuid4') as uuid:
            clock.now.return_value.strftime.return_value = timestamp
            uuid.return_value.hex = suffix + '0' * 20
            self.assertEqual(self.capture(value={'replacement': True})[0], 500)
        self.assertEqual(json.loads(file.read_text()), {'original': True})

    def test_concurrent_uploads(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda i: self.capture(value={'index': i}), range(8)))
        self.assertTrue(all(status == 201 for status, _ in results))
        self.assertEqual(len(list((self.site / '.captures/hike').glob('*.json'))), 8)
    def test_invalid_json(self):
        for body in [b'{broken', b'null', b'123', b'{"bad":NaN}', b'{"bad":Infinity}', b'"text"', b'\xff']:
            self.assertEqual(self.request('POST', '/__debug/captures/hike', body)[0], 400)
        self.assertFalse((self.site / '.captures').exists())
    def test_bad_paths(self):
        for path in ['/__debug/captures/../outside', '/__debug/captures/%2e%2e', '/__debug/captures/a%2fb', '/__debug/captures/', '/unknown']:
            self.assertEqual(self.request('POST', path, b'{}')[0], 404)
    def test_limits_and_origins(self):
        path = '/__debug/captures/hike'
        for headers, body, status in [({'Content-Type': 'text/plain'}, b'{}', 415), ({'Content-Length': str(vr_server.MAX_CAPTURE_BYTES+1)}, b'', 413), ({'Content-Length': 'bad'}, b'{}', 400), ({'Origin': 'https://other.example'}, b'{}', 403), ({'Host': 'other.example'}, b'{}', 403)]:
            self.assertEqual(self.request('POST', path, body, headers)[0], status)
        host = 'localhost:' + str(self.port)
        self.assertEqual(self.request('POST', path, b'{}', {'Host': host, 'Origin': 'http://' + host})[0], 201)
    def test_missing_length_and_incomplete_body(self):
        for extra, body in [('', ''), ('Content-Length: 20\r\n', '{}')]:
            with socket.create_connection(('127.0.0.1', self.port), timeout=3) as connection:
                message = 'POST /__debug/captures/hike HTTP/1.0\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\n{}\r\n{}'.format(self.port, extra, body)
                connection.sendall(message.encode()); connection.shutdown(socket.SHUT_WR)
                response = connection.recv(4096)
                self.assertIn(b' 411 ' if not extra else b' 400 ', response.split(b'\r\n')[0])
    def test_disk_error_and_symlink(self):
        with patch.object(Path, 'open', side_effect=OSError('disk error')):
            self.assertEqual(self.capture()[0], 500)
        outside = self.site / 'outside'; outside.mkdir()
        (self.site / '.captures/hike').rmdir()
        (self.site / '.captures/hike').symlink_to(outside, target_is_directory=True)
        self.assertEqual(self.capture()[0], 500); self.assertEqual(list(outside.iterdir()), [])
    def test_launcher_probe(self):
        launcher = (ROOT / 'Start-VR.command').read_text()
        function = launcher.split('server_ready() {', 1)[1].split('\n}', 1)[0]
        script = 'server_ready() {' + function + '\n}\nserver_ready'
        environment = dict(os.environ, SITE_DIR=str(self.site), PORT=str(self.port))
        self.assertEqual(subprocess.run(['bash', '-c', script], env=environment).returncode, 0)
        environment['SITE_DIR'] = str(self.site / 'other')
        self.assertNotEqual(subprocess.run(['bash', '-c', script], env=environment).returncode, 0)
if __name__ == '__main__': unittest.main()
