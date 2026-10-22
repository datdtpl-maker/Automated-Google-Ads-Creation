import os
import sys
import time
import socket
import threading
import webbrowser
import urllib.request

# Cấu hình UTF-8 cho Windows console
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def start_server(port=8000):
    import uvicorn
    from web_app import app
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")

def wait_for_server(url, timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=1) as res:
                if res.status == 200:
                    return True
        except Exception:
            time.sleep(0.3)
    return False

def main():
    port = 8000
    # Nếu port 8000 bị chiếm bởi phiên cũ, tìm port khả dụng
    if is_port_in_use(port):
        # Kiểm tra nếu là chính web_app đang chạy
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/config", timeout=1) as res:
                if res.status == 200:
                    print(f"Server đã chạy sẵn trên cổng {port}.")
                else:
                    port = 8008
        except Exception:
            port = 8008

    app_url = f"http://127.0.0.1:{port}"

    # Khởi động FastAPI server trong background thread nếu chưa chạy
    if not is_port_in_use(port):
        server_thread = threading.Thread(target=start_server, args=(port,), daemon=True)
        server_thread.start()
        print(f"Đang khởi động máy chủ tại {app_url}...")
        if not wait_for_server(app_url):
            print("Cảnh báo: Máy chủ mất nhiều thời gian hơn dự kiến để khởi động.")

    # Mở cửa sổ Desktop Native Window bằng pywebview
    try:
        import webview
        print("Đang mở cửa sổ ứng dụng Windows...")
        window = webview.create_window(
            title="Google Ads Campaign Auto-Generator | Khải Hoàn Derma",
            url=app_url,
            width=1320,
            height=900,
            min_size=(1000, 650),
            confirm_close=False
        )
        webview.start()
    except Exception as e:
        print(f"Chế độ Native Window không khả dụng ({e}). Đang mở trên trình duyệt...")
        webbrowser.open(app_url)
        # Giữ process sống
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Đang tắt ứng dụng...")

if __name__ == "__main__":
    main()
