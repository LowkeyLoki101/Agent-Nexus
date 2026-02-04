#!/usr/bin/env python3
"""Local RLM API for private summaries and public redaction."""
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from Projects.RLM.models.ollama_adapter import summarize_private, summarize_public

API_TOKEN = "CHANGE_ME"

app = FastAPI(title="RLM Local API")

class SummarizeRequest(BaseModel):
    text: str
    mode: str = "public"  # public | private


@app.post("/summarize")
def summarize(req: SummarizeRequest, x_token: str = Header(default="")):
    if API_TOKEN and x_token != API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if req.mode == "private":
        return {"summary": summarize_private(req.text)}
    return {"summary": summarize_public(req.text)}

