#!/usr/bin/env python3
"""
Simple HTTP server for OKR Phoenix Project
Serves static files with proper CORS headers for Google Sheets API testing
"""

import http.server
import socketserver
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler

class CORSHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        # Custom logging
        timestamp = time.strftime('%Y-%m-%d %H:%M:%S')
        sys.stdout.write(f"[{timestamp}] {format % args}\n")
        sys.stdout.flush()

if __name__ == "__main__":
    PORT = 8000
    
    with socketserver.TCPServer(("0.0.0.0", PORT), CORSHTTPRequestHandler) as httpd:
        print(f"🚀 OKR Phoenix Project Server starting on port {PORT}")
        print(f"📂 Serving files from: {httpd.server_address}")
        print(f"🌐 Access your application at: http://localhost:{PORT}")
        print(f"🧪 Test API page: http://localhost:{PORT}/test-api.html")
        print(f"🔐 Login page: http://localhost:{PORT}/okr-login.html")
        print("=" * 60)
        sys.stdout.flush()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server shutting down...")
            httpd.shutdown()