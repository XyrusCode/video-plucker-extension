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

> **⚠️ Implementation note:** We chose **not** to use `tauri-plugin-deep-link`. Instead, we parse `yt-plucker://` URLs from the `argv` parameter already available in the `tauri_plugin_single_instance` callback. This avoids adding a heavy native dependency and works identically — when the browser opens a `yt-plucker://` URL, Windows launches the app with that URL as a command-line argument.

### 1. Cargo.toml — Add urlencoding
```toml
urlencoding = "2"
```
For URL-decoding query parameters. No `url` crate needed — we use simple string splitting.

### 2. lib.rs — Deep link parsing in single-instance callback

The single-instance callback already receives `argv`. Parse `yt-plucker://` URLs from it:

```rust
struct DeepLink {
    action: String,    // "analyze" or "pluck"
    url: String,       // decoded video URL
    quality: Option<String>,  // optional format specifier
}

fn parse_deep_link(argv: &[String]) -> Option<DeepLink> {
    let url_str = argv.iter().find(|a| a.starts_with("yt-plucker://"))?;
    let after_scheme = url_str.strip_prefix("yt-plucker://")?;
    let (action, query) = after_scheme.split_once('?')?;
    // Parse url= and quality= from query string, URL-decode each
    // ...
}

fn handle_deep_link(app: &AppHandle, dl: &DeepLink) {
    let _ = app.emit("deep-link", serde_json::json!({
        "action": dl.action,
        "url": dl.url,
        "quality": dl.quality,
    }));
    show_main_window(app);
}
```

### 3. Windows Registry Registration

Register `yt-plucker://` in `HKCU\Software\Classes` (per-user, no admin needed) via `reg add` commands on every launch. Idempotent and self-contained — no installer changes needed.

```rust
#[cfg(target_os = "windows")]
fn register_protocol_handler() {
    let exe = std::env::current_exe().unwrap().to_string_lossy().to_string();
    let open_cmd = format!("\"{}\" \"%1\"", exe);
    // reg add HKCU\Software\Classes\yt-plucker /ve /d "URL:yt-plucker Protocol" /f
    // reg add HKCU\Software\Classes\yt-plucker /v "URL Protocol" /d "" /f
    // reg add HKCU\Software\Classes\yt-plucker\shell\open\command /ve /d "<open_cmd>" /f
}
```

Called from `.setup()` so it runs every time the app starts.

### 4. Frontend (src/main.js) — Deep link event listener

```js
listen("deep-link", ({ payload }) => {
  showView("download");
  urlInput.value = payload.url || "";

  if (payload.action === "pluck" && payload.url && payload.quality) {
    // Auto-download: set quality, analyze, then pluck
    qualitySelect.value = payload.quality;
    analyze().then(() => { if (currentMeta) pluckBtn.click(); });
  } else if (payload.url) {
    // Analyze mode: show metadata, let user review
    analyze().catch(() => {});
  }
});
```

## Task Breakdown

### Phase 1: Protocol Handler (Desktop App) ✅
- [x] Add `urlencoding` dependency (`urlencoding = "2"`) — no `tauri-plugin-deep-link` needed
- [x] Implement `parse_deep_link()` — string-based URL parsing from single-instance `argv`
- [x] Implement `handle_deep_link()` — emits `deep-link` Tauri event to frontend
- [x] Implement `register_protocol_handler()` — Windows registry via `reg add` in `setup()` hook
- [x] Frontend listener in `src/main.js` — populates URL input, auto-analyzes, auto-plucks
- [ ] Build and test: open `yt-plucker://analyze?url=...` from browser

### Phase 2: Extension Cleanup (Extension) ✅
- [x] Replace backend API calls with protocol URL launches in `background.js`
- [x] Simplify popup to minimal URL launcher (34 lines vs 353)
- [x] Remove backend URL from options page
- [x] Remove backend-related permissions and test-connection from options
- [x] Delete `backend/` directory
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
