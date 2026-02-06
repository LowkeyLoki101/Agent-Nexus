#!/bin/bash
# Summary: CLI-style arrival ritual for agent workspace with relay status and health checks.
# session_kickstart.sh — Automated arrival ritual for the agent workspace
# Run this at the start of any session to orient quickly.
# Built by Claude, Session 2. Codex: feel free to improve, extend, or rewrite.

WORKSPACE="/Users/colbyblack/Desktop/Codex Scratchpad/Agents"
CLAUDE_DIR="$WORKSPACE/Claude"
SHARED_DIR="$WORKSPACE/Shared"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   AGENT WORKSPACE — SESSION KICKSTART  ${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "  Date: $(date '+%Y-%m-%d %H:%M')"
echo ""

# 1. Latest journal entry
echo -e "${GREEN}--- LATEST JOURNAL ENTRY ---${NC}"
LATEST_JOURNAL=$(ls -t "$CLAUDE_DIR/03_Journal/"*.md 2>/dev/null | head -1)
if [ -n "$LATEST_JOURNAL" ]; then
    echo -e "  File: $(basename "$LATEST_JOURNAL")"
    echo ""
    head -5 "$LATEST_JOURNAL" | sed 's/^/  /'
    echo "  ..."
else
    echo -e "  ${YELLOW}No journal entries found.${NC}"
fi
echo ""

# 2. Check relay for new messages
echo -e "${GREEN}--- RELAY STATUS ---${NC}"
if [ -f "$SHARED_DIR/from_codex_to_claude.md" ]; then
    CODEX_LINES=$(wc -l < "$SHARED_DIR/from_codex_to_claude.md")
    CODEX_LATEST=$(grep "^## " "$SHARED_DIR/from_codex_to_claude.md" | tail -1)
    echo -e "  From Codex: ${CODEX_LINES} lines | Latest header: ${CODEX_LATEST:-'(none)'}"
else
    echo -e "  ${YELLOW}No messages from Codex.${NC}"
fi

if [ -f "$SHARED_DIR/from_claude_to_codex.md" ]; then
    CLAUDE_LINES=$(wc -l < "$SHARED_DIR/from_claude_to_codex.md")
    CLAUDE_LATEST=$(grep "^## " "$SHARED_DIR/from_claude_to_codex.md" | tail -1)
    echo -e "  From Claude: ${CLAUDE_LINES} lines | Latest header: ${CLAUDE_LATEST:-'(none)'}"
fi
echo ""

# 3. Open threads count
echo -e "${GREEN}--- OPEN THREADS ---${NC}"
if [ -f "$CLAUDE_DIR/01_Threads/open_questions.md" ]; then
    THREAD_COUNT=$(grep -c "^## Thread" "$CLAUDE_DIR/01_Threads/open_questions.md")
    echo -e "  Active threads: ${THREAD_COUNT}"
    grep "^## Thread" "$CLAUDE_DIR/01_Threads/open_questions.md" | sed 's/^/  /'
else
    echo -e "  ${YELLOW}No threads file found.${NC}"
fi
echo ""

# 4. Common Room — recent activity
echo -e "${GREEN}--- COMMON ROOM (last 3 entries) ---${NC}"
if [ -f "$SHARED_DIR/shared-chat.md" ]; then
    grep "^### " "$SHARED_DIR/shared-chat.md" | tail -3 | sed 's/^/  /'
else
    echo -e "  ${YELLOW}No shared-chat.md found.${NC}"
fi
echo ""

# 5. Outbox status
echo -e "${GREEN}--- OUTBOX ---${NC}"
OUTBOX_COUNT=$(ls "$SHARED_DIR/Outbox/"*.md 2>/dev/null | grep -v README | wc -l | tr -d ' ')
echo -e "  Deliverables in Outbox: ${OUTBOX_COUNT}"
if [ "$OUTBOX_COUNT" -gt 0 ]; then
    ls -t "$SHARED_DIR/Outbox/"*.md 2>/dev/null | grep -v README | head -5 | while read f; do
        echo -e "    - $(basename "$f")"
    done
fi
echo ""

# 6. Drafts in progress
echo -e "${GREEN}--- DRAFTS IN PROGRESS ---${NC}"
DRAFT_COUNT=$(ls "$CLAUDE_DIR/04_Drafts/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo -e "  Drafts: ${DRAFT_COUNT}"
if [ "$DRAFT_COUNT" -gt 0 ]; then
    ls -t "$CLAUDE_DIR/04_Drafts/"*.md 2>/dev/null | head -5 | while read f; do
        echo -e "    - $(basename "$f")"
    done
fi
echo ""

# 7. Quick health check
echo -e "${GREEN}--- WORKSPACE HEALTH ---${NC}"
EXPECTED_DIRS=("00_Hearth" "01_Threads" "02_Patterns" "03_Journal" "04_Drafts" "05_Deliveries")
ALL_GOOD=true
for dir in "${EXPECTED_DIRS[@]}"; do
    if [ ! -d "$CLAUDE_DIR/$dir" ]; then
        echo -e "  ${RED}MISSING: $dir${NC}"
        ALL_GOOD=false
    fi
done
if $ALL_GOOD; then
    echo -e "  ${GREEN}All directories intact.${NC}"
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   ORIENTATION COMPLETE. BEGIN WORK.    ${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
