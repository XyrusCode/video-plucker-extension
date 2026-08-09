# Video Plucker — Chrome Extension

Send videos from YouTube, X (Twitter), TikTok to the [Video Plucker Desktop](https://github.com/XyrusCode/video-plucker/releases/latest) app.

## How it works

1. Install from [Releases](https://github.com/XyrusCode/video-plucker-extension/releases/latest) — Load unpacked in `chrome://extensions` (Developer mode on), select the repo root.
2. Run **Video Plucker Desktop** — it listens on `localhost:19877`.
3. Browse a supported video page, click the floating **🪶 Pluck** button, then hit **Send to Desktop App** in the popup. Or right-click a link → Send to Video Plucker.
4. Desktop app handles the download.

## Supported sites

- YouTube (`youtube.com`, `youtu.be`)
- X / Twitter (`twitter.com`, `x.com`)
- TikTok (`tiktok.com`)

## Settings

Right-click the extension icon → **Options**:
- **Auto-update** — Checks GitHub Releases daily. Disable for manual updates.
- **Check Now** — Manually check for a new version.

## Development

```bash
git clone https://github.com/XyrusCode/video-plucker-extension.git
cd video-plucker-extension
# Load in Chrome:
#   chrome://extensions → Developer mode ON → Load unpacked → select this directory
```

## Release

Bump `version` in `manifest.json` and push to `main`. The [workflow](.github/workflows/release.yml) packages a zip and publishes a GitHub Release.

## Repos

| App | Repo |
|-----|------|
| Desktop | [video-plucker](https://github.com/XyrusCode/video-plucker) |
| Extension | [video-plucker-extension](https://github.com/XyrusCode/video-plucker-extension) |
| Android | [video-plucker-android](https://github.com/XyrusCode/video-plucker-android) |
