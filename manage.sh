#!/usr/bin/env bash
set -euo pipefail

APP_NAME="paperclip"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

show_menu() {
    echo ""
    echo "=== Paperclip Manager ==="
    echo ""
    echo "  1) Start"
    echo "  2) Stop"
    echo "  3) Restart"
    echo "  4) Status"
    echo "  5) Logs (live tail)"
    echo "  6) Logs (last 50 lines)"
    echo "  7) Enable auto-start on boot"
    echo "  8) Disable auto-start on boot"
    echo "  9) Rebuild & restart"
    echo "  0) Exit"
    echo ""
}

require_pm2() {
    if ! command -v pm2 &>/dev/null; then
        echo "Error: pm2 is not installed. Run: npm install -g pm2"
        exit 1
    fi
}

do_start() {
    if pm2 describe "$APP_NAME" &>/dev/null; then
        echo "Already running. Use restart instead."
        pm2 status "$APP_NAME"
    else
        echo "Starting $APP_NAME..."
        cd "$APP_DIR"
        pm2 start pnpm --name "$APP_NAME" -- dev:once
    fi
}

do_stop() {
    echo "Stopping $APP_NAME..."
    pm2 stop "$APP_NAME"
}

do_restart() {
    echo "Restarting $APP_NAME..."
    pm2 restart "$APP_NAME"
}

do_status() {
    pm2 status "$APP_NAME"
}

do_logs_tail() {
    echo "Tailing logs (Ctrl+C to stop)..."
    pm2 logs "$APP_NAME"
}

do_logs_recent() {
    pm2 logs "$APP_NAME" --lines 50 --nostream
}

do_enable_startup() {
    pm2 save
    echo ""
    echo "Run the following command to enable auto-start on boot:"
    echo ""
    pm2 startup 2>&1 | grep -E "^\s*sudo" || pm2 startup
    echo ""
    echo "Copy and run the sudo command above, then run: pm2 save"
}

do_disable_startup() {
    pm2 unstartup 2>&1 | grep -E "^\s*sudo" || pm2 unstartup
    echo ""
    echo "Copy and run the sudo command above to disable auto-start."
}

do_rebuild() {
    echo "Building..."
    cd "$APP_DIR"
    pnpm build
    echo ""
    if pm2 describe "$APP_NAME" &>/dev/null; then
        echo "Restarting $APP_NAME..."
        pm2 restart "$APP_NAME"
    else
        echo "Starting $APP_NAME..."
        pm2 start pnpm --name "$APP_NAME" -- dev:once
    fi
}

require_pm2

if [[ $# -gt 0 ]]; then
    case "$1" in
        start)   do_start ;;
        stop)    do_stop ;;
        restart) do_restart ;;
        status)  do_status ;;
        logs)    do_logs_tail ;;
        rebuild) do_rebuild ;;
        *)       echo "Usage: $0 {start|stop|restart|status|logs|rebuild}" ;;
    esac
    exit 0
fi

while true; do
    show_menu
    read -rp "Choose an option: " choice
    case "$choice" in
        1) do_start ;;
        2) do_stop ;;
        3) do_restart ;;
        4) do_status ;;
        5) do_logs_tail ;;
        6) do_logs_recent ;;
        7) do_enable_startup ;;
        8) do_disable_startup ;;
        9) do_rebuild ;;
        0) echo "Bye."; exit 0 ;;
        *) echo "Invalid option." ;;
    esac
done
