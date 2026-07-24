# Xyrus' Plucker

A Chrome extension for downloading videos from **YouTube**, **X (Twitter)**, **TikTok**, and more — backed by `yt-dlp`.

## Quick Start

### 1. Start the backend

```powershell
cd backend
.\run.ps1          # starts API at http://localhost:8000
```

### 2. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder

### 3. Pluck a video

- Click the **🪶 Pluck** button floating on any supported video page, or
- Right-click a video link → **Pluck This Video**, or
- Paste a URL directly into the popup

### 4. (Optional) Import cookies

Export cookies.txt from your browser (use a "Get cookies.txt" extension), then import per platform in the extension popup or options page to bypass login walls and bot checks.

## Features

| Feature | Description |
|---|---|
| **Multi-site** | YouTube, X (Twitter), TikTok — `yt-dlp` handles 1000+ sites |
| **Cookie Manager** | Import/clear per-platform cookies.txt |
| **Browser cookies** | Use Chrome/Edge/Firefox login cookies via `--cookies-from-browser` |
| **Playlists** | Download entire playlists individually or as a zip |
| **Quality selection** | 360p → 4K, audio-only MP3/M4A |
| **Context menu** | Right-click any video link to pluck instantly |
| **Auto-release** | GitHub Actions packages extension + backend on version bump |

## Release

Bump `version` in `extension/manifest.json`, push to `main` — the [release workflow](.github/workflows/release.yml) auto-builds and publishes.

## Tech Stack

- **Extension**: Chrome MV3 (vanilla JS)
- **Backend**: Python FastAPI + `yt-dlp` + `ffmpeg`
- **Desktop companion**: [Tauri/Rust app](https://github.com/XyrusCode/Xyrus-YT-Plucker-Desktop)
