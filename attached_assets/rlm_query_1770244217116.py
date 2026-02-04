#!/usr/bin/env python3
"""Simple keyword search over public layer (v1)."""
import sqlite3
import sys
from pathlib import Path

BASE = Path("/Users/colbyblack/Desktop/Codex Scratchpad")
DB = BASE / "Projects/RLM/storage/rlm.db"


def main():
    if len(sys.argv) < 2:
        print("Usage: rlm_query.py <query>")
        sys.exit(1)
    q = " ".join(sys.argv[1:]).lower()
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("SELECT docs.path, chunks.summary FROM chunks JOIN docs ON chunks.doc_id=docs.id WHERE chunks.layer='public' AND chunks.summary LIKE ? LIMIT 10", (f"%{q}%",))
    rows = cur.fetchall()
    for path, summary in rows:
        print("---")
        print(path)
        print(summary)
    conn.close()


if __name__ == "__main__":
    main()
