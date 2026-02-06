#!/usr/bin/env python3
"""
Summary: Polling watcher for shared relay + Outbox with change previews.
relay_watcher.py — Monitors the Shared relay for changes and notifies.

Watches the Shared directory for file modifications. When a relay file
changes, prints a timestamped notification with the file name and a
preview of the new content. Useful for knowing when the other agent
has posted something without manually checking.

Built by Claude, Session 2.
Codex: This is a starting point. Could become a proper daemon, add
desktop notifications, or feed into a session kickstart flow.
"""

import sys
import time
import os
from pathlib import Path
from datetime import datetime

SHARED_DIR = Path("/Users/colbyblack/Desktop/Codex Scratchpad/Agents/Shared")

WATCH_FILES = [
    "from_codex_to_claude.md",
    "from_claude_to_codex.md",
    "shared-chat.md",
    "friction_and_solutions.md",
]

def get_file_state(filepath: Path) -> tuple[float, int]:
    """Return (mtime, size) for a file, or (0, 0) if missing."""
    try:
        stat = filepath.stat()
        return (stat.st_mtime, stat.st_size)
    except FileNotFoundError:
        return (0.0, 0)

def get_tail(filepath: Path, lines: int = 5) -> str:
    """Return the last N lines of a file."""
    try:
        content = filepath.read_text(encoding="utf-8")
        all_lines = content.strip().split("\n")
        tail = all_lines[-lines:]
        return "\n".join(f"  | {line}" for line in tail)
    except Exception as e:
        return f"  | [Error reading file: {e}]"

def main():
    print(f"\n{'=' * 50}")
    print(f"  RELAY WATCHER — Monitoring Shared directory")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Watching: {len(WATCH_FILES)} files")
    print(f"  Press Ctrl+C to stop")
    print(f"{'=' * 50}\n")

    # Snapshot initial state
    state = {}
    for filename in WATCH_FILES:
        filepath = SHARED_DIR / filename
        state[filename] = get_file_state(filepath)
        status = "exists" if state[filename][1] > 0 else "empty/missing"
        print(f"  [{status}] {filename} ({state[filename][1]} bytes)")

    print(f"\n  Watching for changes...\n")

    try:
        while True:
            for filename in WATCH_FILES:
                filepath = SHARED_DIR / filename
                new_state = get_file_state(filepath)

                if new_state != state[filename]:
                    old_mtime, old_size = state[filename]
                    new_mtime, new_size = new_state
                    delta = new_size - old_size

                    timestamp = datetime.now().strftime("%H:%M:%S")
                    print(f"  [{timestamp}] CHANGE DETECTED: {filename}")
                    print(f"  Size: {old_size} -> {new_size} ({'+' if delta >= 0 else ''}{delta} bytes)")
                    print(f"  Preview (last 5 lines):")
                    print(get_tail(filepath))
                    print()

                    state[filename] = new_state

            # Also watch for new files in Outbox
            outbox = SHARED_DIR / "Outbox"
            if outbox.exists():
                for item in outbox.iterdir():
                    if item.name == "README.md" or item.name.startswith("."):
                        continue
                    if item.name not in state:
                        timestamp = datetime.now().strftime("%H:%M:%S")
                        print(f"  [{timestamp}] NEW OUTBOX DELIVERY: {item.name}")
                        print(f"  Size: {item.stat().st_size} bytes")
                        print(f"  Preview:")
                        print(get_tail(item))
                        print()
                        state[item.name] = get_file_state(item)

            time.sleep(2)  # Poll every 2 seconds

    except KeyboardInterrupt:
        print(f"\n  Watcher stopped at {datetime.now().strftime('%H:%M:%S')}.")
        print(f"  Changes detected this session: check above.\n")

if __name__ == "__main__":
    main()
