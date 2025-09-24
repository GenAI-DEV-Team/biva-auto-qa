from __future__ import annotations

from pathlib import Path
from functools import lru_cache
from typing import Dict, Optional, List


def _app_dir() -> Path:
    # .../backend/app/utils -> app
    return Path(__file__).resolve().parent.parent


def get_prompts_dir() -> Path:
    return _app_dir() / "prompts"


def _candidate_paths(name: str, base_dir: Optional[Path]) -> List[Path]:
    base = base_dir or get_prompts_dir()
    p = Path(name)
    if p.is_absolute():
        base = Path("/")
    candidates: List[Path] = []
    raw = (base / p) if not p.is_absolute() else p
    candidates.append(raw)
    if raw.suffix == "":
        candidates.append(raw.with_suffix(".md"))
        candidates.append(raw.with_suffix(".txt"))
    return candidates


def resolve_prompt_path(name: str, base_dir: Optional[Path] = None) -> Path:
    for candidate in _candidate_paths(name, base_dir):
        if candidate.exists() and candidate.is_file():
            return candidate
    # default last candidate for error message
    last = _candidate_paths(name, base_dir)[-1]
    raise FileNotFoundError(f"Prompt file not found for '{name}' under '{(base_dir or get_prompts_dir())}'. Tried variants like: {last}")


@lru_cache(maxsize=128)
def _read_file_cached(path_str: str, encoding: str = "utf-8") -> str:
    path = Path(path_str)
    return path.read_text(encoding=encoding)


def load_prompt(
    name: str,
    *,
    base_dir: Optional[Path] = None,
    variables: Optional[Dict[str, str]] = None,
    encoding: str = "utf-8",
) -> str:
    """Load a prompt file content from app/prompts (by default).

    - name: file name or relative path; extension optional (.md/.txt).
    - variables: optional dict to replace placeholders like {{key}}.
    - base_dir: custom directory; default is app/prompts.
    """
    path = resolve_prompt_path(name, base_dir)
    content = _read_file_cached(str(path), encoding)
    if variables:
        for key, value in variables.items():
            content = content.replace("{{" + key + "}}", str(value))
    return content


def list_prompts(base_dir: Optional[Path] = None) -> List[str]:
    """List prompt files (relative names) in the prompts directory."""
    dir_path = base_dir or get_prompts_dir()
    if not dir_path.exists():
        return []
    results: List[str] = []
    for p in dir_path.iterdir():
        if p.is_file() and p.suffix in {".md", ".txt"}:
            results.append(p.name)
    return sorted(results)


