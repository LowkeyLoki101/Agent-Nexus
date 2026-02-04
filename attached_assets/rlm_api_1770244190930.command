#!/bin/bash
set -euo pipefail
cd "/Users/colbyblack/Desktop/Codex Scratchpad/Projects/RLM/api"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn rlm_api:app --host 0.0.0.0 --port 8089
