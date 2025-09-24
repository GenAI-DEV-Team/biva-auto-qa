#!/usr/bin/env bash
set -euo pipefail

# Simple nohup-based backend manager: start | stop | status | logs
# - Writes logs to logs/backend.out and logs/backend.err
# - Writes PID to .backend.pid

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
LOG_DIR="${ROOT_DIR}/logs"
PID_FILE="${ROOT_DIR}/.backend.pid"

mkdir -p "${LOG_DIR}"

command -v nohup >/dev/null 2>&1 || { echo "nohup not found" >&2; exit 1; }

load_env() {
  # Prefer workspace .env, then backend/.env
  if [ -f "${ROOT_DIR}/.env" ]; then
    set -a; source "${ROOT_DIR}/.env"; set +a
  elif [ -f "${BACKEND_DIR}/.env" ]; then
    set -a; source "${BACKEND_DIR}/.env"; set +a
  fi
}

is_running() {
  if [ -f "${PID_FILE}" ]; then
    local pid
    pid="$(cat "${PID_FILE}" || true)"
    if [ -n "${pid}" ] && ps -p "${pid}" > /dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

start() {
  if is_running; then
    echo "[nohup-backend] Already running with PID $(cat "${PID_FILE}")"
    exit 0
  fi

  load_env

  # Activate virtualenv if exists
  if [ -d "${BACKEND_DIR}/venv" ]; then
    # shellcheck disable=SC1091
    source "${BACKEND_DIR}/venv/bin/activate"
  elif [ -d "${ROOT_DIR}/venv" ]; then
    # shellcheck disable=SC1091
    source "${ROOT_DIR}/venv/bin/activate"
  fi

  # Ensure deps
  if ! command -v uvicorn >/dev/null 2>&1; then
    echo "[nohup-backend] Installing dependencies..."
    pip install -r "${BACKEND_DIR}/requirements.txt"
  fi

  local host port reload
  host="${HOST:-0.0.0.0}"
  port="${PORT:-8000}"
  reload="${RELOAD:-false}"

  echo "[nohup-backend] Starting backend on ${host}:${port} (reload=${reload})"
  cd "${BACKEND_DIR}"

  # Build command
  cmd=(uvicorn app.main:app --host "${host}" --port "${port}" --proxy-headers)
  if [ "${reload}" = "true" ]; then
    cmd+=(--reload)
  fi

  # Start with nohup
  nohup "${cmd[@]}" \
    > "${LOG_DIR}/backend.out" \
    2> "${LOG_DIR}/backend.err" &

  echo $! > "${PID_FILE}"
  echo "[nohup-backend] PID $(cat "${PID_FILE}")"
}

stop() {
  if ! is_running; then
    echo "[nohup-backend] Not running"
    exit 0
  fi
  local pid
  pid="$(cat "${PID_FILE}")"
  echo "[nohup-backend] Stopping PID ${pid}"
  kill "${pid}" 2>/dev/null || true
  # Wait briefly, then force kill if needed
  sleep 2
  if ps -p "${pid}" > /dev/null 2>&1; then
    echo "[nohup-backend] Force killing ${pid}"
    kill -9 "${pid}" 2>/dev/null || true
  fi
  rm -f "${PID_FILE}"
}

status() {
  if is_running; then
    echo "[nohup-backend] Running (PID $(cat "${PID_FILE}"))"
  else
    echo "[nohup-backend] Stopped"
  fi
}

logs() {
  echo "[nohup-backend] Tailing logs (Ctrl+C to exit)"
  tail -n 200 -f "${LOG_DIR}/backend.out" "${LOG_DIR}/backend.err"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <start|stop|status|logs>

Env vars:
  HOST            Bind host (default 0.0.0.0)
  PORT            Bind port (default 8000)
  RELOAD          Set to "true" to enable uvicorn reload
EOF
}

cmd="${1:-}"
case "${cmd}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  logs) logs ;;
  *) usage; exit 1 ;;
esac


