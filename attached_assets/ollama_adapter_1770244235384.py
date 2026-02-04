#!/usr/bin/env python3
"""Minimal Ollama adapter for local summarization/redaction."""
import json
import subprocess

DEFAULT_MODEL = "llama3.1"


def ollama_generate(prompt: str, model: str = DEFAULT_MODEL) -> str:
    cmd = ["ollama", "run", model]
    proc = subprocess.run(cmd, input=prompt, text=True, capture_output=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "ollama run failed")
    return proc.stdout.strip()


def summarize_private(text: str) -> str:
    prompt = (
        "Summarize the following text in 5-7 bullet points. Keep all key facts.\n\n"
        + text[:6000]
    )
    return ollama_generate(prompt)


def summarize_public(text: str) -> str:
    prompt = (
        "Summarize the following text in 3-5 bullet points, "
        "redacting sensitive details and removing specific names or identifiers.\n\n"
        + text[:6000]
    )
    return ollama_generate(prompt)


if __name__ == "__main__":
    print("Ollama adapter OK")
