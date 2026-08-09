#!/bin/bash
set -e

echo "==========================================="
echo "  Video Plucker - Setup"
echo "==========================================="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "Error: Python 3 not found. Please install Python 3.8+ first."
    exit 1
fi

PY_VER=$(python3 --version 2>&1 | grep -oP '\d+\.\d+')
PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)

if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 8 ]); then
    echo "Error: Python 3.8+ required (found $PY_VER)"
    exit 1
fi

echo "✓ Python $PY_VER found"

# Navigate to backend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "==========================================="
echo "  Setup Complete!"
echo "==========================================="
echo ""
echo "  To start the backend server:"
echo "    cd backend && ./run.sh"
echo ""
echo "  Then load the extension in Chrome:"
echo "    1. Open chrome://extensions"
echo "    2. Enable 'Developer mode' (top right)"
echo "    3. Click 'Load unpacked'"
echo "    4. Select the 'extension' folder"
echo ""
echo "  Default backend URL: http://localhost:8000"
echo "  (Configure in extension Options page)"
echo ""
