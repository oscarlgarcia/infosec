#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$RUN_DIR/logs"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

mkdir -p "$LOG_DIR"

usage() {
  echo "Uso: $0 {start|stop|restart|status}"
}

require_project_files() {
  if [[ ! -f "$BACKEND_DIR/package.json" ]]; then
    echo "No se encontro package.json en $BACKEND_DIR" >&2
    exit 1
  fi

  if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
    echo "No se encontro package.json en $FRONTEND_DIR" >&2
    exit 1
  fi
}

read_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' < "$pid_file"
  fi
}

is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

cleanup_pid_file() {
  local pid_file="$1"
  local pid
  pid="$(read_pid "$pid_file")"
  if [[ -z "$pid" ]] || ! is_running "$pid"; then
    rm -f "$pid_file"
    return 0
  fi
  return 1
}

start_service() {
  local name="$1"
  local workdir="$2"
  local pid_file="$3"
  local log_file="$4"
  local command="$5"
  local pid

  pid="$(read_pid "$pid_file")"
  if is_running "$pid"; then
    echo "$name ya estaba iniciado con PID $pid. Se reiniciara."
    stop_service "$name" "$pid_file"
  else
    cleanup_pid_file "$pid_file" || true
  fi

  (
    cd "$workdir"
    nohup bash -lc "$command" >> "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )

  pid="$(read_pid "$pid_file")"
  sleep 1

  if is_running "$pid"; then
    echo "$name iniciado con PID $pid"
  else
    echo "No se pudo iniciar $name. Revisa $log_file" >&2
    rm -f "$pid_file"
    exit 1
  fi
}

stop_service() {
  local name="$1"
  local pid_file="$2"
  local pid

  pid="$(read_pid "$pid_file")"
  if ! is_running "$pid"; then
    cleanup_pid_file "$pid_file" || true
    echo "$name no esta iniciado"
    return 0
  fi

  kill "$pid" 2>/dev/null || true

  for _ in {1..10}; do
    if ! is_running "$pid"; then
      rm -f "$pid_file"
      echo "$name detenido"
      return 0
    fi
    sleep 1
  done

  kill -9 "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  echo "$name detenido por fuerza"
}

status_service() {
  local name="$1"
  local pid_file="$2"
  local pid

  pid="$(read_pid "$pid_file")"
  if is_running "$pid"; then
    echo "$name: running (PID $pid)"
  else
    cleanup_pid_file "$pid_file" || true
    echo "$name: stopped"
  fi
}

start_all() {
  require_project_files
  start_service "Backend" "$BACKEND_DIR" "$BACKEND_PID_FILE" "$BACKEND_LOG" "PORT=3000 npm run dev"
  start_service "Frontend" "$FRONTEND_DIR" "$FRONTEND_PID_FILE" "$FRONTEND_LOG" "npm run dev -- --host 0.0.0.0"
  echo "Logs:"
  echo "  Backend:  $BACKEND_LOG"
  echo "  Frontend: $FRONTEND_LOG"
}

stop_all() {
  stop_service "Frontend" "$FRONTEND_PID_FILE"
  stop_service "Backend" "$BACKEND_PID_FILE"
}

status_all() {
  status_service "Backend" "$BACKEND_PID_FILE"
  status_service "Frontend" "$FRONTEND_PID_FILE"
}

case "${1:-}" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status_all
    ;;
  *)
    usage
    exit 1
    ;;
esac

