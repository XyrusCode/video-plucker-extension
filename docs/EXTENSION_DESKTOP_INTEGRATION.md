# Extension ↔ Desktop App Integration Spec

## Overview

Replace the local FastAPI backend with a direct extension-to-desktop-app handoff. The Chrome/Edge extension detects video URLs and passes them to the **Xyrus YT Plucker** desktop app (Tauri v2) via a custom protocol handler (`yt-plucker://`). The desktop app handles all downloading, progress, and file management — no server, no setup required for end users.

## Architecture

```
┌──────────────────────┐                    ┌──────────────────────────┐
│  Chrome Extension    │  yt-plucker://     │  Desktop App (Tauri v2)  │
│  ──────────────────  │  analyze?url=...   │  ─────────────────────── │
│  - Context menus     │ ─────────────────► │  - Deep link handler     │
│  - Page URL grab     │                    │  - yt-dlp sidecar        │
│  - Protocol launch   │                    │  - ffmpeg sidecar        │
│                      │                    │  - Progress/Resume/Tray  │
└──────────────────────┘                    └──────────────────────────┘
```

## Protocol Specification

### URL Scheme: `yt-plucker://`

| Action | Format | Description |
|---|---|---|
| Analyze | `yt-plucker://analyze?url=<encoded_url>` | Fetch metadata and show in UI |
| Quick Pluck | `yt-plucker://pluck?url=<encoded_url>&quality=<quality>` | Skip UI, download directly |

### Parameters

| Param | Required | Description |
|---|---|---|
| `url` | Yes | Full URL-encoded video/playlist URL |
| `quality` | No | Format string (e.g., `best[height<=1080]`). If omitted, defaults to saved preference or `best[height<=1080]`. |

### Examples

```
yt-plucker://analyze?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ
yt-plucker://pluck?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&quality=best%5Bheight%3C%3D720%5D
```

## What Gets Removed

### From Extension
- ❌ `DEFAULT_BACKEND` constant and all `localhost:8000` references
- ❌ "Backend URL" option in settings
- ❌ `fetch()` calls to backend API
- ❌ CORS and API response handling
- ❌ The entire `backend/` directory (no longer needed)

### From Desktop App
- Nothing removed. New deep-link handling is additive.

## Extension Changes

### 1. background.js — Replace API calls with protocol launches

**Current flow:**
```
context menu click → fetch(backendUrl + '/api/info') → show popup → fetch(backendUrl + '/api/download') → chrome.downloads.download()
```

**New flow:**
```
context menu click → chrome.tabs.create({ url: 'yt-plucker://analyze?url=...' }) → desktop app handles everything
```

Replace all `fetch()` calls to the backend API with protocol URL construction:
```js
function getPluckerUrl(action, url, quality) {
  const params = new URLSearchParams({ url });
  if (quality) params.set('quality', quality);
  return `yt-plucker://${action}?${params}`;
}
```

**Auto-download mode:** When `autoDownload` is enabled and `defaultQuality` is set, use `yt-plucker://pluck?...` to skip the desktop app UI entirely.

**Playlist URLs:** Append `&list=` URLs the same way — the desktop app's `fetch_metadata` already handles playlists via `playlist_mode`.

### 2. content.js — No changes needed
Content script injection remains the same — it just injects the Pluck button overlay on supported pages.

### 3. popup/popup.js — Simplify or remove
The popup currently shows format selection from the backend API. Since the desktop app handles quality selection, the popup can either be removed entirely or reduced to a minimal launcher.

### 4. options/options.js — Remove backend settings
Remove "Backend URL" field. Keep "Default Quality" and "Auto Download" — these map to the `quality` param in the protocol URL.

### 5. manifest.json
Remove `http://localhost:8000` from permissions/host_permissions if present.

## Desktop App Changes

### 1. Add `tauri_plugin_deep_link` to Cargo.toml
```toml
tauri-plugin-deep-link = "2"
```

### 2. Register protocol in tauri.conf.json
```json
{
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["yt-plucker"]
      }
    }
  }
}
```

### 3. Handle deep links in lib.rs

The app already uses `tauri_plugin_single_instance`. When a second instance is launched with a `yt-plucker://` URL, the single-instance callback fires with `argv`. Parse the URL there:

```rust
use url::Url;

fn handle_deep_link(app: &AppHandle, url_str: &str) {
    if let Ok(url) = Url::parse(url_str) {
        match url.host_str() {
            Some("analyze") => {
                // Extract 'url' query param, emit event to frontend
                // Show main window, populate URL input, auto-analyze
            }
            Some("pluck") => {
                // Extract 'url' and 'quality' params
                // Show window, start download immediately
            }
            _ => {}
        }
    }
}
```

**Key behaviors:**
- If the app is in tray (hidden), show and focus the main window
- If analyzing, populate the URL input and trigger auto-analyze
- If quick-plucking, start the download immediately with progress UI
- Deduplicate: ignore duplicate URLs if already analyzing/plucking

### 4. Tauri capabilities update
Add the deep-link permission in `src-tauri/capabilities/`:
```json
{
  "identifier": "deep-link-default",
  "windows": ["main"],
  "permissions": ["deep-link:default"]
}
```

### 5. Windows: Installer must write registry

For the protocol handler to work on Windows, the installer (NSIS) must register `yt-plucker://` in the registry. Tauri's NSIS bundler typically handles this when `tauri-plugin-deep-link` is configured, but verify:

```
HKEY_CLASSES_ROOT\yt-plucker
  (Default) = "URL:yt-plucker Protocol"
  URL Protocol = ""
  \shell\open\command
    (Default) = "C:\Program Files\Xyrus YT Plucker\yt-plucker.exe" "%1"
```

### 6. Frontend (src/main.js)

Add a listener for the URL being passed from the Rust backend. The Rust side emits an event or calls a JS function when a deep link is received. The frontend should:
- Populate the URL input field
- Auto-trigger the "Analyze" button
- Switch to the appropriate tab (URL tab for analyze, Downloads tab for pluck)

## Task Breakdown

### Phase 1: Protocol Handler (Desktop App)
- [ ] Add `tauri-plugin-deep-link` dependency
- [ ] Register `yt-plucker://` scheme in tauri.conf.json
- [ ] Implement deep-link parsing in the single-instance callback
- [ ] Emit parsed URL to frontend via Tauri event
- [ ] Frontend: handle incoming URL (populate input, auto-analyze)
- [ ] Verify Windows registry registration in NSIS installer
- [ ] Test: open `yt-plucker://analyze?url=...` from browser

### Phase 2: Extension Cleanup (Extension)
- [ ] Replace backend API calls with protocol URL launches in `background.js`
- [ ] Simplify or remove popup (quality selection moves to desktop)
- [ ] Remove backend URL from options page
- [ ] Remove backend-related permissions from manifest
- [ ] Delete `backend/` directory
- [ ] Test: context menu "Pluck This Video" → desktop app opens with URL loaded

### Phase 3: Polish
- [ ] Handle edge case: desktop app not installed (show download page link)
- [ ] Handle edge case: desktop app minimized to tray (window should restore)
- [ ] Cookie handoff: desktop app already has its own cookie settings
- [ ] Update README documentation

## Success Criteria
1. Right-click "Pluck This Video" on YouTube → desktop app opens with URL pre-filled and auto-analyzing
2. No `localhost:8000` or FastAPI server running anywhere
3. Download, progress, and file management all happen in the desktop app
4. Works on Windows, macOS, and Linux
