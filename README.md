# Xyrus' Plucker

A Chrome extension for downloading videos from **YouTube**, **X (Twitter)**, **TikTok**, and more — powered by the [Xyrus YT Plucker desktop app](https://github.com/XyrusCode/Xyrus-YT-Plucker-Desktop).

## Quick Start

### 1. Install the desktop app
Download and install **Xyrus YT Plucker** from [GitHub Releases](https://github.com/XyrusCode/Xyrus-YT-Plucker-Desktop/releases).

### 2. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/` folder

### 3. Pluck a video

- Click the **🪶 Pluck** button floating on any supported video page, or
- Right-click a video link → **Pluck This Video**, or
- Click the extension icon to send the current tab to the desktop app

## Features

| Feature | Description |
|---|---|
| **Multi-site** | YouTube, X (Twitter), TikTok — desktop app handles 1000+ sites via yt-dlp |
| **Quality selection** | 360p → 4K, audio-only — configured in the desktop app |
| **Context menu** | Right-click any video link to pluck instantly |
| **Auto-download** | Skip the quality prompt entirely with auto-download mode |
| **Playlists** | Download entire playlists from YouTube |

## How it works

The extension sends video URLs to the desktop app via the `yt-plucker://` protocol. All downloading, processing, and file management happens on your machine — no server, no setup.

## Release

Bump `version` in `extension/manifest.json`, push to `main` — the [release workflow](.github/workflows/release.yml) auto-builds and publishes the extension zip.

## Tech Stack

- **Extension**: Chrome MV3 (vanilla JS)
- **Desktop app**: [Tauri v2 + Rust + yt-dlp](https://github.com/XyrusCode/Xyrus-YT-Plucker-Desktop)
