from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse
import os, json, shutil, re
from pathlib import Path
from typing import List

app = FastAPI()

def clean_filename(name: str) -> str:
    return re.sub(r'[^a-zA-Z0-9_-]', '_', name)[:50]

def process_chat(chat_data, output_dir: str):
    """Convert one chat JSON into Markdown file"""
    title = chat_data.get("title", "Untitled")
    filename = clean_filename(title) + ".md"
    messages = []

    for _, v in chat_data.get("mapping", {}).items():
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
    return filename

@app.get("/", response_class=HTMLResponse)
async def index():
    return """
    <html>
        <head><title>ChatGPT Restructure Tool</title></head>
        <body>
            <h1>Upload ChatGPT JSON Export(s)</h1>
            <form action="/upload/" enctype="multipart/form-data" method="post">
                <input type="file" name="files" multiple />
                <input type="submit" value="Convert & Download" />
            </form>
        </body>
    </html>
    """

@app.post("/upload/")
async def upload(files: List[UploadFile] = File(...)):
    # If only 1 file → return .md directly
    if len(files) == 1:
        file = files[0]
        data = json.load(file.file)
        chats = data.get("conversations") or [data]

        temp_dir = "/tmp/single"
        os.makedirs(temp_dir, exist_ok=True)

        filename = None
        for chat in chats:
            filename = process_chat(chat, temp_dir)

        file_path = Path(temp_dir) / filename
        return FileResponse(file_path, filename=filename)

    # If multiple files → return ZIP
    temp_dir = "/tmp/output"
    os.makedirs(temp_dir, exist_ok=True)

    for file in files:
        data = json.load(file.file)
        chats = data.get("conversations") or [data]
        for chat in chats:
            process_chat(chat, temp_dir)

    zip_base = "/tmp/chat_export"
    zip_path = f"{zip_base}.zip"
    shutil.make_archive(zip_base, 'zip', temp_dir)
    shutil.rmtree(temp_dir)

    return FileResponse(zip_path, filename="chat_export.zip")
