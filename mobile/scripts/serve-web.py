# Serves the browser build (dist/) for previews: python3 scripts/serve-web.py dist 8792
# Sends the headers browser SQLite needs (SharedArrayBuffer), and maps /plan to plan.html.
import http.server, sys, os
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()
    def log_message(self, *a): pass
    def send_head(self):
        # Expo Router static output: /plan -> plan.html
        p = self.translate_path(self.path.split('?')[0])
        if not os.path.exists(p) and os.path.exists(p + '.html'):
            self.path = self.path.split('?')[0] + '.html'
        return super().send_head()
H.extensions_map['.wasm'] = 'application/wasm'
os.chdir(sys.argv[1])
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), H).serve_forever()
