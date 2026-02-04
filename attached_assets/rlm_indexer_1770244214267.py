#!/usr/bin/env python3
"""Index scratchpad files into SQLite with private/public summaries."""
import sqlite3
from pathlib import Path
from datetime import datetime
from models.ollama_adapter import summarize_private, summarize_public

BASE = Path("/Users/colbyblack/Desktop/Codex Scratchpad")
DB = BASE / "Projects/RLM/storage/rlm.db"
SCHEMA = BASE / "Projects/RLM/storage/schema.sql"

TARGET_DIRS = [
    BASE / "Agents/Shared",
    BASE / "News/AI/NateBJones",
    BASE / "Gifts",
    BASE / "Research",
]

EXCLUDE = [
    BASE / "02_Notes/About_Me/Colby Black/Profile/06_Private",
    BASE / "02_Notes/About_Me/Colby Black/Profile/04_Relationships",
]


def ensure_db():
    conn = sqlite3.connect(DB)
    conn.executescript(SCHEMA.read_text())
    return conn


def should_index(path: Path) -> bool:
    if path.is_dir():
        return False
    if path.suffix.lower() not in {".md", ".txt"}:
        return False
    for ex in EXCLUDE:
        try:
            path.relative_to(ex)
            return False
        except ValueError:
            pass
    return True


def upsert_doc(conn, path: Path):
    now = datetime.utcnow().isoformat()
    cur = conn.cursor()
    cur.execute("SELECT id FROM docs WHERE path = ?", (str(path),))
    row = cur.fetchone()
    if row:
        doc_id = row[0]
        cur.execute("UPDATE docs SET updated_at=? WHERE id=?", (now, doc_id))
    else:
        cur.execute("INSERT INTO docs (path, source, created_at, updated_at) VALUES (?,?,?,?)",
                    (str(path), "scratchpad", now, now))
        doc_id = cur.lastrowid
    return doc_id


def upsert_chunk(conn, doc_id: int, layer: str, content: str, summary: str):
    cur = conn.cursor()
    cur.execute("DELETE FROM chunks WHERE doc_id=? AND layer=?", (doc_id, layer))
    cur.execute(
        "INSERT INTO chunks (doc_id, layer, content, tags, summary) VALUES (?,?,?,?,?)",
        (doc_id, layer, content, "", summary),
    )


def main():
    conn = ensure_db()
    for base in TARGET_DIRS:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not should_index(path):
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            doc_id = upsert_doc(conn, path)
            private_summary = summarize_private(text)
            public_summary = summarize_public(text)
            upsert_chunk(conn, doc_id, "private", text[:10000], private_summary)
            upsert_chunk(conn, doc_id, "public", text[:10000], public_summary)
            conn.commit()
            print(f"Indexed {path}")
    conn.close()


if __name__ == "__main__":
    main()
