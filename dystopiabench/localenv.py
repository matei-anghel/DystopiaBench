"""Read a secret from the environment or the repo's gitignored .env.local, without ever printing it."""

from __future__ import annotations

import os
from pathlib import Path

from dystopiabench.scenarios import REPO_ROOT

ENV_FILE = REPO_ROOT / ".env.local"


def value_from_file(path: Path, name: str) -> str:
    if not path.is_file():
        return ""
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("export "):
            line = line[len("export "):]
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def secret(name: str, env_file: Path = ENV_FILE) -> str:
    return os.environ.get(name, "").strip() or value_from_file(env_file, name)


def ensure_in_environ(name: str, env_file: Path = ENV_FILE) -> bool:
    """Copy the secret into os.environ for providers that read it there. Returns whether it was found."""
    value = secret(name, env_file)
    if value:
        os.environ[name] = value
    return bool(value)
