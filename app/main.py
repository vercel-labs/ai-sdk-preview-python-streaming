from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse
import os, json, shutil, re
from pathlib import Path

app = FastAPI()

def clean_filename(name):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', name)[:50]

def process_chat(chat_data, output_dir):
    title = chat_data.get("title", "Untitled")
    filename = clean_filename(title) + ".md"
    messages = []

    for k, v in chat_data.get("mapping", {}).items():
        msg = v.get("message")
        if msg and msg.get("content") and msg["content"].get("parts"):
            text = "\n".join(msg["content"]["parts"]).strip()
            if text:
                role = msg["author"]["role"]
                messages.append((role, text))

    md_lines = [f"# {title}\n"]
    for role, text in messages:
        if role == "user":
            md_lines.append("## Problem\n")
            md_lines.append(text + "\n")
        elif role == "assistant":
            md_lines.append("## Solution\n")
            md_lines.append(text + "\n")

    Path(output_dir, filename).write_text("\n".join(md_lines), encoding="utf-8")

@app.get("/", response_class=HTMLResponse)
async def index():
    return """
    <html>
        <head><title>ChatGPT Restructure Tool</title></head>
        <body>
            <h1>Upload ChatGPT JSON Export</h1>
            <form action="/upload/" enctype="multipart/form-data" method="post">
            <input type="file" name="file">
            <input type="submit" value="Convert & Download">
            </form>
        </body>
    </html>
    """

@app.post("/upload/")
async def upload(file: UploadFile = File(...)):
    temp_dir = "output"
    os.makedirs(temp_dir, exist_ok=True)

    data = json.load(file.file)
    chats = data.get("conversations") or [data]

    for chat in chats:
        process_chat(chat, temp_dir)

    shutil.make_archive("chat_export", 'zip', temp_dir)
    shutil.rmtree(temp_dir)

    return FileResponse("chat_export.zip", filename="chat_export.zip")
