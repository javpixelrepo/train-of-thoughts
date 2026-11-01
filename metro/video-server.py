"""Local-only PNG -> H.264 encoder. Run alongside the preview server."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import json, os, shutil, subprocess, threading, uuid

FFMPEG = shutil.which('ffmpeg') or r'C:\Program Files\Shutter Encoder\app\Library\ffmpeg.exe'
OUT = Path(__file__).parent / 'exports'
OUT.mkdir(exist_ok=True)
sessions = {}
lock = threading.Lock()
ORIGINS = {'http://127.0.0.1:4173', 'http://localhost:4173'}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def reply(self, code, data, kind='application/json'):
        if isinstance(data, dict): data = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Access-Control-Allow-Origin', self.headers.get('Origin', 'http://127.0.0.1:4173'))
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_OPTIONS(self):
        if self.headers.get('Origin') not in ORIGINS: return self.reply(403, {})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    def do_GET(self):
        if self.path == '/health': return self.reply(200, {'ready': Path(FFMPEG).exists(), 'width':2048, 'height':2048, 'fps':60})
        self.reply(404, {})
    def do_POST(self):
        if self.headers.get('Origin') not in ORIGINS: return self.reply(403, {})
        try:
            if self.path == '/start':
                with lock:
                    if sessions: return self.reply(409, {'error':'Another video is exporting.'})
                    key = uuid.uuid4().hex
                    path = OUT / ('Train-of-Thoughts-2K-60fps-' + key + '.mp4')
                    log = open(OUT / (key + '.log'), 'wb')
                    proc = subprocess.Popen([FFMPEG,'-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','60','-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(path)],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                    sessions[key] = (proc,path,log)
                return self.reply(200, {'id':key})
            action,key = self.path.strip('/').split('/')
            proc,path,log = sessions[key]
            if action == 'frame':
                size = int(self.headers.get('Content-Length','0'))
                if size < 24 or size > 64*1024*1024: return self.reply(400, {'error':'Invalid frame size.'})
                data = self.rfile.read(size)
                if data[:8] != b'\x89PNG\r\n\x1a\n' or int.from_bytes(data[16:20],'big') != 2048 or int.from_bytes(data[20:24],'big') != 2048: return self.reply(400, {'error':'Expected a 2048-square PNG.'})
                proc.stdin.write(data); proc.stdin.flush()
                return self.reply(200, {})
            if action == 'finish':
                proc.stdin.close(); code=proc.wait(timeout=300); log.close(); sessions.pop(key,None)
                if code: return self.reply(500, {'error':'Video encoding failed.'})
                return self.reply(200,path.read_bytes(),'video/mp4')
            if action == 'cancel':
                proc.kill();proc.wait();proc.stdin.close();log.close();sessions.pop(key,None)
                path.unlink(missing_ok=True)
                return self.reply(200,{})
            self.reply(404,{})
        except Exception as error:
            self.reply(500, {'error':str(error)})

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1',4174),Handler).serve_forever()
