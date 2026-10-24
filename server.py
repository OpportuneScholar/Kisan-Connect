import os
import webbrowser
from threading import Timer

import uvicorn
from app import app

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    if os.getenv("OPEN_BROWSER", "true").lower() == "true":
        Timer(1.2, lambda: webbrowser.open(f"http://{host}:{port}")).start()
    uvicorn.run(app, host=host, port=port)
