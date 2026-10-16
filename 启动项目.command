#!/bin/bash
set -e
project_dir="$(cd "$(dirname "$0")" && pwd)"
runtime_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [ ! -x "$runtime_node" ]; then
  runtime_node="$(command -v node || true)"
fi
if [ ! -x "$runtime_node" ]; then
  echo "未找到可用的 Node.js，请先安装 Node.js。"
  exit 1
fi
backend_pid=""
frontend_pid=""
cleanup() {
  trap - EXIT INT TERM
  if [ -n "$backend_pid" ]; then kill "$backend_pid" 2>/dev/null || true; fi
  if [ -n "$frontend_pid" ]; then kill "$frontend_pid" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM
cd "$project_dir"
"$runtime_node" backend/index.js &
backend_pid=$!
(
  cd front
  exec "$runtime_node" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
) &
frontend_pid=$!
echo "项目启动中，打开 http://127.0.0.1:5173；按 Ctrl+C 停止。"
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
  sleep 1
done
