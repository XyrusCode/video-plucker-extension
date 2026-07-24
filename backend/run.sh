#!/bin/bash
# Start the Xyrus' Youtube Plucker backend server

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo "Starting Xyrus' Youtube Plucker API on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
