# Video Plucker — Chrome Extension

Send videos from supported sites (YouTube, X/Twitter, TikTok) to the [Video Plucker Desktop](https://github.com/XyrusCode/video-plucker/releases/latest) app for downloading.

## How it works

1. Install the extension from the [latest release](https://github.com/XyrusCode/video-plucker-extension/releases/latest) (Load unpacked in `chrome://extensions` with Developer mode on).
2. Run the **Video Plucker Desktop** app — it exposes a local server on `localhost:19877`.
3. Browse to a supported video page, click the floating **🪶 Pluck** button, then click the extension icon and hit **Send to Desktop App**.
4. The desktop app handles the download via yt-dlp.

## Supported sites

- YouTube (`youtube.com`, `youtu.be`)
- X / Twitter (`twitter.com`, `x.com`)
- TikTok (`tiktok.com`)

## Settings

Right-click the extension icon → **Options**, or open `chrome://extensions`, find Video Plucker, and click **Details → Extension options**.

- **Auto-update** — Checks GitHub Releases daily for new versions. Disable if you prefer manual updates.
- **Check Now** — Manually check for an update.

## Terms of Use

Video Plucker is provided for personal use only. Respect platform terms of service, copyright, and content ownership. Included in the extension at `terms/terms.html`.

## Development

```bash
# Clone
git clone https://github.com/XyrusCode/video-plucker-extension.git
cd video-plucker-extension

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked" and select the extension/ folder
```

## Release

Bump `version` in `extension/manifest.json` and push to `main`. The [release workflow](.github/workflows/release.yml) builds a zip and publishes a GitHub Release.

## Repos

| App | Repo |
|-----|------|
| Desktop | [video-plucker](https://github.com/XyrusCode/video-plucker) |
| Extension | [video-plucker-extension](https://github.com/XyrusCode/video-plucker-extension) |
| Android | [video-plucker-android](https://github.com/XyrusCode/video-plucker-android) |
