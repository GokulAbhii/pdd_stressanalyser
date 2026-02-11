import uvicorn
import webview
import threading
import sys
import os

# Add the current directory to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from app.main import app

def start_server():
    # Use a random free port or fixed for internal
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

if __name__ == "__main__":
    multiprocessing_frozen = False
    if getattr(sys, 'frozen', False):
        import multiprocessing
        multiprocessing.freeze_support()
        multiprocessing_frozen = True

    # Start the server in a separate thread
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()

    # Create a native window
    # Camera access is handled by WebView2 automatically on Windows
    # We just need to ensure the URL matches the server
    window = webview.create_window(
        'ZenithAI Stress Detection', 
        'http://127.0.0.1:8000', 
        width=1280, 
        height=720, 
        resizable=True
    )
    webview.start()
