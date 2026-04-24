#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DATA_DIR="$PROJECT_DIR/data"
MONGODB_DATA_DIR="$DATA_DIR/db"
MONGODB_LOG_DIR="$DATA_DIR/db"

BACKEND_PID=""
FRONTEND_PID=""
MONGO_PID=""

get_backend_pid() {
    BACKEND_PID=$(lsof -ti :3000 2>/dev/null | head -1)
    if [ -z "$BACKEND_PID" ]; then
        BACKEND_PID=$(ps aux | grep "tsx watch" | grep -v grep | awk '{print $2}' | head -1)
    fi
}

get_frontend_pid() {
    FRONTEND_PID=$(lsof -ti :5173 2>/dev/null | head -1)
    if [ -z "$FRONTEND_PID" ]; then
        FRONTEND_PID=$(ps aux | grep "vite" | grep -v grep | awk '{print $2}' | head -1)
    fi
}

get_mongo_pid() {
    MONGO_PID=$(ps aux | grep "mongod" | grep -v grep | grep -v defunct | awk '{print $2}' | head -1)
}

is_mongo_running() {
    get_mongo_pid
    [ -n "$MONGO_PID" ]
}

start_backend() {
    echo "🚀 Starting backend server..."
    cd "$PROJECT_DIR"
    mkdir -p "$PROJECT_DIR/logs"
    (cd "$PROJECT_DIR" && bash -c "source .env && exec npx tsx src/index.ts" > "$PROJECT_DIR/logs/backend.log" 2>&1) &
    BACKEND_PID=$!
    disown $BACKEND_PID 2>/dev/null
    sleep 8
    if lsof -i :3000 >/dev/null 2>&1; then
        echo "✅ Backend started"
    else
        echo "❌ Backend failed to start - check logs/backend.log"
    fi
}

start_frontend() {
    echo "🚀 Starting frontend server..."
    cd "$FRONTEND_DIR"
    mkdir -p "$PROJECT_DIR/logs"
    setsid npm run dev > "$PROJECT_DIR/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    sleep 5
    if lsof -i :5173 >/dev/null 2>&1; then
        echo "✅ Frontend started (PID: $FRONTEND_PID)"
    else
        echo "❌ Frontend failed to start - check logs/frontend.log"
    fi
}

start_mongo() {
    if is_mongo_running; then
        echo "⚠️  MongoDB already running (PID: $MONGO_PID)"
        return
    fi
    echo "🗄️  Starting MongoDB..."
    mkdir -p "$MONGODB_DATA_DIR"
    mongod --dbpath "$MONGODB_DATA_DIR" --logpath "$MONGODB_LOG_DIR/mongod.log" --fork 2>/dev/null
    sleep 2
    if is_mongo_running; then
        get_mongo_pid
        echo "✅ MongoDB started (PID: $MONGO_PID)"
    else
        echo "❌ Failed to start MongoDB"
    fi
}

stop_backend() {
    get_backend_pid
    if [ -n "$BACKEND_PID" ]; then
        echo "🛑 Stopping backend (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null
        sleep 1
        kill -9 "$BACKEND_PID" 2>/dev/null
        echo "✅ Backend stopped"
    else
        echo "⚠️  Backend not running"
    fi
}

stop_frontend() {
    get_frontend_pid
    if [ -n "$FRONTEND_PID" ]; then
        echo "🛑 Stopping frontend (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null
        sleep 1
        kill -9 "$FRONTEND_PID" 2>/dev/null
        echo "✅ Frontend stopped"
    else
        echo "⚠️  Frontend not running"
    fi
}

stop_mongo() {
    if ! is_mongo_running; then
        echo "⚠️  MongoDB not running"
        return
    fi
    get_mongo_pid
    echo "🛑 Stopping MongoDB (PID: $MONGO_PID)..."
    kill "$MONGO_PID" 2>/dev/null
    sleep 1
    kill -9 "$MONGO_PID" 2>/dev/null
    echo "✅ MongoDB stopped"
}

restart_backend() {
    stop_backend
    sleep 1
    start_backend
}

restart_frontend() {
    stop_frontend
    sleep 1
    start_frontend
}

restart_mongo() {
    stop_mongo
    sleep 1
    start_mongo
}

status() {
    get_backend_pid
    get_frontend_pid
    get_mongo_pid
    
    echo "📊 Server Status:"
    echo "----------------"
    if is_mongo_running; then
        echo "✅ MongoDB: running (PID: $MONGO_PID)"
    else
        echo "❌ MongoDB: not running"
    fi
    if [ -n "$BACKEND_PID" ]; then
        echo "✅ Backend: running (PID: $BACKEND_PID)"
    else
        echo "❌ Backend: not running"
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        echo "✅ Frontend: running (PID: $FRONTEND_PID)"
    else
        echo "❌ Frontend: not running"
    fi
}

case "$1" in
    start)
        start_mongo
        sleep 1
        start_backend
        sleep 2
        start_frontend
        echo ""
        echo "🌐 Frontend: http://localhost:5173"
        echo "🔌 Backend:  http://localhost:3000"
        ;;
    stop)
        stop_backend
        stop_frontend
        stop_mongo
        ;;
    restart)
        stop_backend
        stop_frontend
        restart_mongo
        sleep 1
        start_backend
        sleep 2
        start_frontend
        ;;
    status)
        status
        ;;
    backend)
        case "$2" in
            start) start_mongo; sleep 1; start_backend ;;
            stop) stop_backend ;;
            restart) restart_backend ;;
            *) echo "Usage: $0 backend {start|stop|restart}" ;;
        esac
        ;;
    frontend)
        case "$2" in
            start) start_frontend ;;
            stop) stop_frontend ;;
            restart) restart_frontend ;;
            *) echo "Usage: $0 frontend {start|stop|restart}" ;;
        esac
        ;;
    mongo)
        case "$2" in
            start) start_mongo ;;
            stop) stop_mongo ;;
            restart) restart_mongo ;;
            *) echo "Usage: $0 mongo {start|stop|restart}" ;;
        esac
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|backend|frontend|mongo}"
        echo ""
        echo "Commands:"
        echo "  start              - Start all servers (mongo, backend, frontend)"
        echo "  stop               - Stop all servers"
        echo "  restart            - Restart all servers"
        echo "  status             - Show server status"
        echo "  backend start|stop|restart - Manage backend only"
        echo "  frontend start|stop|restart - Manage frontend only"
        echo "  mongo start|stop|restart - Manage MongoDB only"
        exit 1
        ;;
esac
