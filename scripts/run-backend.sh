#!/usr/bin/env bash
set -euo pipefail

# Root of the workspace (this script lives in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}/backend"

# Load environment variables from .env if present (at workspace root or backend)
if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env"
  set +a
elif [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1090
  source .env
  set +a
fi

# Prefer venv inside backend/venv, else workspace venv, else system python
if [ -d "${ROOT_DIR}/backend/venv" ]; then
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/backend/venv/bin/activate"
elif [ -d "${ROOT_DIR}/venv" ]; then
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/venv/bin/activate"
fi

# Ensure uvicorn is available
if ! command -v uvicorn >/dev/null 2>&1; then
  echo "[run-backend] 'uvicorn' not found. Installing dependencies..." >&2
  if [ -f requirements.txt ]; then
    pip install -r requirements.txt
  else
    echo "[run-backend] requirements.txt not found in backend/. Please install uvicorn manually." >&2
    exit 1
  fi
fi

# Defaults align with app.core.config.Settings
HOST_DEFAULT="0.0.0.0"
PORT_DEFAULT="8000"

HOST_VAL="${HOST:-${HOST_DEFAULT}}"
PORT_VAL="${PORT:-${PORT_DEFAULT}}"

echo "[run-backend] Starting FastAPI on ${HOST_VAL}:${PORT_VAL}"
exec uvicorn app.main:app \
  --host "${HOST_VAL}" \
  --port "${PORT_VAL}" \
  --reload


