import http.server
import socketserver
import webbrowser
import os

PORT = 8000
DIRECTORY = "demo"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def main():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"服务已启动！")
        print(f"请访问: http://localhost:{PORT}")
        print(f"按 Ctrl+C 停止服务")
        
        # 自动打开浏览器
        webbrowser.open(f"http://localhost:{PORT}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务已停止")
            httpd.shutdown()

if __name__ == "__main__":
    main()
