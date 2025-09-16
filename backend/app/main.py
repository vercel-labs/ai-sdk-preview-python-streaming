"""FastAPI application powering the ChatGPT Restructure Tool backend.

The service accepts exported ChatGPT conversations (JSON files), converts each
conversation into a Markdown document that follows a Problem/Solution format,
archives the generated files into a ZIP, and returns both the Markdown payloads
and the ZIP archive to the client.

Designed to run on Vercel's Python runtime.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import re
import time
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

LOGGER = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="ChatGPT Restructure Tool API",
    version="1.0.0",
    description=(
        "Serverless API that restructures ChatGPT JSON exports into Markdown "
        "files ready for download."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


MarkdownTuple = Tuple[str, str, str]
ResponseFile = Dict[str, Any]


class ProcessingError(RuntimeError):
    """Raised when an uploaded file cannot be processed."""


def clean_filename(name: str) -> str:
    """Return a filesystem-safe filename derived from ``name``.

    Vercel's serverless environment is case-sensitive and has path length
    restrictions, so the output is limited to ASCII characters with a maximum of
    80 characters.
    """

    sanitized = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")
    if not sanitized:
        sanitized = "conversation"
    return sanitized[:80]


def normalise_conversations(payload: Any) -> List[Dict[str, Any]]:
    """Extract a list of conversation dictionaries from the uploaded payload."""

    if isinstance(payload, dict):
        if isinstance(payload.get("conversations"), list):
            return [c for c in payload["conversations"] if isinstance(c, dict)]
        if "mapping" in payload or "messages" in payload:
            return [payload]
    if isinstance(payload, list):
        return [c for c in payload if isinstance(c, dict)]
    raise ProcessingError("File does not contain any conversations")


def iterate_messages(conversation: Dict[str, Any]) -> Iterable[Tuple[float, str, str]]:
    """Yield (timestamp, role, text) tuples for user/assistant messages."""

    def _normalise_text(content: Any) -> str:
        if content is None:
            return ""
        if isinstance(content, dict):
            parts = content.get("parts")
            if isinstance(parts, list):
                text_parts = [str(part) for part in parts if isinstance(part, (str, int, float))]
                return "\n".join(text_parts).strip()
            if isinstance(content.get("text"), str):
                return content["text"].strip()
            return ""
        if isinstance(content, list):
            text_parts = [str(part) for part in content if isinstance(part, (str, int, float))]
            return "\n".join(text_parts).strip()
        if isinstance(content, (int, float)):
            return str(content)
        if isinstance(content, str):
            return content.strip()
        return ""

    items: List[Tuple[float, str, str]] = []

    mapping = conversation.get("mapping")
    messages = conversation.get("messages")
    if isinstance(mapping, dict) and mapping:
        for node in mapping.values():
            message = node.get("message") if isinstance(node, dict) else None
            if not isinstance(message, dict):
                continue
            author_role = (message.get("author") or {}).get("role")
            if author_role not in {"user", "assistant"}:
                continue
            text = _normalise_text(message.get("content"))
            if not text:
                continue
            timestamp = float(message.get("create_time") or 0.0)
            items.append((timestamp, author_role, text))
    elif isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict):
                continue
            author_role = (message.get("author") or {}).get("role")
            if author_role not in {"user", "assistant"}:
                continue
            text = _normalise_text(message.get("content"))
            if not text:
                continue
            timestamp = float(message.get("create_time") or 0.0)
            items.append((timestamp, author_role, text))

    if not items:
        LOGGER.debug("Conversation %s contains no user/assistant messages", conversation.get("id"))
    return items


def conversation_to_markdown(conversation: Dict[str, Any]) -> MarkdownTuple:
    """Convert a single conversation into a Markdown document."""

    title = (conversation.get("title") or "Untitled Conversation").strip()
    messages = sorted(iterate_messages(conversation), key=lambda item: item[0])

    if not messages:
        raise ProcessingError("Conversation has no readable messages")

    filename = f"{clean_filename(title)}.md"
    lines: List[str] = [f"# {title}", ""]

    for _, role, text in messages:
        heading = "## Problem" if role == "user" else "## Solution"
        lines.append(heading)
        lines.append("")
        lines.append(text)
        lines.append("")

    markdown = "\n".join(lines).strip() + "\n"
    return filename, title, markdown


def ensure_unique_filename(filename: str, seen: Dict[str, int]) -> str:
    """Append a counter to duplicate filenames so they remain unique."""

    if filename not in seen:
        seen[filename] = 1
        return filename

    stem, dot, suffix = filename.partition(".")
    counter = seen[filename]
    seen[filename] = counter + 1
    if dot:
        return f"{stem}-{counter}{dot}{suffix}"
    return f"{stem}-{counter}"


def build_zip(files: Sequence[Tuple[str, str]]) -> bytes:
    """Create a ZIP archive in memory from ``files``."""

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for filename, content in files:
            archive.writestr(filename, content)
    buffer.seek(0)
    return buffer.read()


@app.get("/api/health")
def healthcheck() -> Dict[str, Any]:
    """Simple readiness probe endpoint."""

    now = datetime.now(timezone.utc)
    return {
        "status": "ok",
        "timestamp": now.isoformat(),
        "service": app.title,
        "version": app.version,
    }


@app.post("/api/process")
async def process_upload(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """Process the uploaded ChatGPT exports and return Markdown payloads."""

    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    start = time.perf_counter()
    processed: List[ResponseFile] = []
    zip_inputs: List[Tuple[str, str]] = []
    filename_counts: Dict[str, int] = {}
    errors: List[Dict[str, str]] = []
    conversations_total = 0

    for upload in files:
        try:
            payload_bytes = await upload.read()
            if not payload_bytes:
                raise ProcessingError("File is empty")
            try:
                payload = json.loads(payload_bytes)
            except json.JSONDecodeError as exc:
                raise ProcessingError(f"Invalid JSON: {exc.msg}") from exc

            conversations = normalise_conversations(payload)
            if not conversations:
                raise ProcessingError("No conversations found in file")

            for conversation in conversations:
                try:
                    filename, title, markdown = conversation_to_markdown(conversation)
                except ProcessingError as exc:
                    errors.append(
                        {
                            "upload": upload.filename or "uploaded-file",
                            "reason": str(exc),
                        }
                    )
                    continue

                unique_filename = ensure_unique_filename(filename, filename_counts)
                zip_inputs.append((unique_filename, markdown))
                processed.append(
                    {
                        "title": title,
                        "markdownFile": unique_filename,
                        "originalUpload": upload.filename,
                        "content": markdown,
                        "size": len(markdown.encode("utf-8")),
                    }
                )
                conversations_total += 1
        except ProcessingError as exc:
            LOGGER.warning("Failed to process upload %s: %s", upload.filename, exc)
            errors.append(
                {
                    "upload": upload.filename or "uploaded-file",
                    "reason": str(exc),
                }
            )
        finally:
            await upload.close()

    if not processed:
        raise HTTPException(
            status_code=422,
            detail="No conversations could be processed. Check the upload format.",
        )

    zip_bytes = build_zip(zip_inputs)
    zip_base64 = base64.b64encode(zip_bytes).decode("utf-8")

    duration_ms = int((time.perf_counter() - start) * 1000)
    processed_at = datetime.now(timezone.utc).isoformat()

    return {
        "files": processed,
        "zipFile": zip_base64,
        "zipFileName": "chatgpt-notes.zip",
        "summary": {
            "uploads": len(files),
            "conversations": conversations_total,
            "markdownFiles": len(processed),
            "processingTimeMs": duration_ms,
        },
        "processedAt": processed_at,
        "errors": errors,
    }
