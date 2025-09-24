HOST_VAL="0.0.0.0"
PORT_VAL="13886"

echo "[run-backend] Starting FastAPI on ${HOST_VAL}:${PORT_VAL}"
exec uvicorn app.main:app \
  --host "${HOST_VAL}" \
  --port "${PORT_VAL}" \
  --reload