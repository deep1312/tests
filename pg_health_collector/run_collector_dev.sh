#!/bin/bash
cd "$(dirname "$0")"

VENV_DIR=".venv"

if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
else
    echo "[WARN] Virtual environment not found at '$VENV_DIR'."
    echo "[WARN] Running with system Python."
fi

python3 -m app.main
