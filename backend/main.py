import os
import uuid
import shutil
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import yt_dlp
import zipfile
import io

app = FastAPI(title="Xyrus' Plucker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = Path("downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

COOKIE_DIR = Path("cookies")
COOKIE_DIR.mkdir(exist_ok=True)

SUPPORTED_PLATFORMS = ["youtube", "twitter", "tiktok"]


class URLRequest(BaseModel):
    url: str
    cookies_from_browser: Optional[str] = None


class DownloadRequest(BaseModel):
    url: str
    format_id: str
    cookies_from_browser: Optional[str] = None


class PlaylistDownloadRequest(BaseModel):
    url: str
    format_id: str
    mode: str = "zip"
    selected_videos: Optional[list[int]] = None
    cookies_from_browser: Optional[str] = None


def detect_platform(url: str) -> Optional[str]:
    lower = url.lower()
    if "twitter.com" in lower or "x.com" in lower:
        return "twitter"
    if "youtube.com" in lower or "youtu.be" in lower:
        return "youtube"
    if "tiktok.com" in lower:
        return "tiktok"
    return None


def platform_cookies_file(url: str) -> Optional[str]:
    platform = detect_platform(url)
    if not platform:
        return None
    path = COOKIE_DIR / f"{platform}.txt"
    if path.exists():
        return str(path.resolve())
    return None


def build_ydl_opts(base_opts: dict, url: str, cookies_from_browser: Optional[str] = None) -> dict:
    opts = base_opts.copy()
    cf = platform_cookies_file(url)
    if cf:
        opts["cookiefile"] = cf
    if cookies_from_browser and cookies_from_browser != "none":
        opts["cookiesfrombrowser"] = (cookies_from_browser,)
    return opts


def make_format_label(fmt: dict) -> str:
    height = fmt.get("height") or 0
    ext = fmt.get("ext", "")
    vcodec = fmt.get("vcodec", "none")
    acodec = fmt.get("acodec", "none")
    filesize = fmt.get("filesize") or fmt.get("filesize_approx", 0)
    size_str = f" ~{filesize / (1024 * 1024):.1f}MB" if filesize else ""
    fps_str = f" {fmt['fps']}fps" if fmt.get("fps") else ""

    if vcodec != "none" and acodec == "none":
        return f"{height}p{fps_str} ({ext}) - Video only{size_str}"
    if vcodec == "none" and acodec != "none":
        abr = fmt.get("abr", 0)
        return f"Audio Only {abr:.0f}kbps ({ext}){size_str}"
    if vcodec != "none" and acodec != "none":
        return f"{height}p{fps_str} ({ext}){size_str}"

    note = fmt.get("format_note", "")
    return f"{note or height}p {ext}"


def sort_formats(formats: list[dict]) -> list[dict]:
    def key(f):
        h = f.get("height") or 0
        v = f.get("vcodec", "none")
        a = f.get("acodec", "none")
        is_audio = v == "none" and a != "none"
        is_video = v != "none"
        return (2 if is_audio else (1 if v == "none" else 0), -h if is_video else 0)

    return sorted(formats, key=key)


# ── Cookie Manager ──────────────────────────────────────────────────

@app.get("/api/cookies/status")
async def get_cookie_status():
    status = {}
    for platform in SUPPORTED_PLATFORMS:
        status[platform] = (COOKIE_DIR / f"{platform}.txt").exists()
    return status


@app.post("/api/cookies/import")
async def import_cookies(platform: str = Form(...), file: UploadFile = File(...)):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
    dest = COOKIE_DIR / f"{platform}.txt"
    content = await file.read()
    with open(dest, "wb") as f:
        f.write(content)
    return {"status": "ok", "platform": platform, "path": str(dest)}


@app.post("/api/cookies/clear")
async def clear_cookies(platform: str = Form(...)):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
    path = COOKIE_DIR / f"{platform}.txt"
    if path.exists():
        path.unlink()
    return {"status": "ok", "platform": platform}


# ── Info / Download ─────────────────────────────────────────────────

@app.post("/api/info")
async def get_info(req: URLRequest):
    try:
        base_opts = {"quiet": True, "no_warnings": True}
        opts = build_ydl_opts(base_opts, req.url, req.cookies_from_browser)
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(req.url, download=False)

        source = info.get("extractor_key", info.get("extractor", ""))

        if "entries" in info and info["entries"]:
            videos = []
            for entry in info["entries"]:
                if entry:
                    videos.append(
                        {
                            "id": entry.get("id"),
                            "title": entry.get("title"),
                            "url": entry.get("webpage_url", f"https://www.youtube.com/watch?v={entry.get('id')}"),
                            "duration": entry.get("duration"),
                            "thumbnail": entry.get("thumbnail"),
                        }
                    )
            return {
                "type": "playlist",
                "title": info.get("title"),
                "playlist_count": info.get("playlist_count"),
                "videos": videos,
                "source": source,
            }

        formats = []
        seen = set()
        for fmt in info.get("formats", []):
            fid = fmt["format_id"]
            if fid in seen:
                continue
            seen.add(fid)
            formats.append(
                {
                    "format_id": fid,
                    "ext": fmt.get("ext"),
                    "quality": fmt.get("format_note") or f"{fmt.get('height', 0)}p",
                    "height": fmt.get("height"),
                    "fps": fmt.get("fps"),
                    "vcodec": fmt.get("vcodec", "none"),
                    "acodec": fmt.get("acodec", "none"),
                    "filesize": fmt.get("filesize") or fmt.get("filesize_approx"),
                    "tbr": fmt.get("tbr"),
                    "abr": fmt.get("abr"),
                    "label": make_format_label(fmt),
                }
            )

        formats = sort_formats(formats)

        return {
            "type": "video",
            "id": info.get("id"),
            "title": info.get("title"),
            "duration": info.get("duration"),
            "thumbnail": info.get("thumbnail"),
            "channel": info.get("channel"),
            "formats": formats,
            "source": source,
        }
    except Exception as e:
        detail = str(e)
        if "Sign in to confirm" in detail:
            detail += "\n\nTip: Import YouTube cookies or set 'Cookies from browser' in extension options."
        raise HTTPException(status_code=400, detail=detail)


@app.post("/api/download")
async def download_video(req: DownloadRequest):
    output_dir = DOWNLOAD_DIR / str(uuid.uuid4())
    output_dir.mkdir(parents=True)
    try:
        base_opts = {
            "quiet": True,
            "no_warnings": True,
            "outtmpl": str(output_dir / "%(title)s.%(ext)s"),
            "format": req.format_id,
            "merge_output_format": "mp4",
        }
        opts = build_ydl_opts(base_opts, req.url, req.cookies_from_browser)
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info(req.url, download=True)

        files = list(output_dir.iterdir())
        if not files:
            raise HTTPException(status_code=500, detail="Download failed - no output file")

        file_path = files[0]
        filename = file_path.name

        async def iter_file():
            try:
                with open(file_path, "rb") as f:
                    while chunk := f.read(65536):
                        yield chunk
            finally:
                shutil.rmtree(output_dir, ignore_errors=True)

        return StreamingResponse(
            iter_file(),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        shutil.rmtree(output_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(output_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/playlist")
async def get_playlist(req: URLRequest):
    try:
        base_opts = {"quiet": True, "no_warnings": True, "extract_flat": True}
        opts = build_ydl_opts(base_opts, req.url, req.cookies_from_browser)
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(req.url, download=False)

        if "entries" not in info or not info["entries"]:
            raise HTTPException(status_code=400, detail="Not a playlist URL")

        videos = []
        for i, entry in enumerate(info["entries"]):
            if entry:
                videos.append(
                    {
                        "index": i,
                        "id": entry.get("id"),
                        "title": entry.get("title"),
                        "url": entry.get("webpage_url", f"https://www.youtube.com/watch?v={entry.get('id')}"),
                        "duration": entry.get("duration"),
                        "thumbnail": entry.get("thumbnail"),
                    }
                )

        return {
            "title": info.get("title"),
            "playlist_count": info.get("playlist_count"),
            "videos": videos,
            "source": info.get("extractor_key", info.get("extractor", "")),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/playlist/download")
async def download_playlist(req: PlaylistDownloadRequest):
    base_opts = {"quiet": True, "no_warnings": True, "extract_flat": True}
    opts = build_ydl_opts(base_opts, req.url, req.cookies_from_browser)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(req.url, download=False)

    if "entries" not in info or not info["entries"]:
        raise HTTPException(status_code=400, detail="Not a playlist URL")

    entries = info["entries"]
    if req.selected_videos is not None:
        entries = [entries[i] for i in req.selected_videos if i < len(entries)]

    output_dir = DOWNLOAD_DIR / str(uuid.uuid4())
    output_dir.mkdir(parents=True)
    try:
        for entry in entries:
            if not entry:
                continue
            video_url = entry.get("webpage_url", f"https://www.youtube.com/watch?v={entry['id']}")
            dl_base = {
                "quiet": True,
                "no_warnings": True,
                "outtmpl": str(output_dir / "%(title)s.%(ext)s"),
                "format": req.format_id,
                "merge_output_format": "mp4",
            }
            dl_opts = build_ydl_opts(dl_base, req.url, req.cookies_from_browser)
            with yt_dlp.YoutubeDL(dl_opts) as ydl2:
                ydl2.download([video_url])

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in output_dir.iterdir():
                zf.write(file_path, file_path.name)

        zip_buffer.seek(0)
        data = zip_buffer.getvalue()

        playlist_title = info.get("title", "playlist")
        safe_title = "".join(c for c in playlist_title if c.isalnum() or c in " _-.").strip() or "playlist"

        return StreamingResponse(
            iter([data]),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_title}.zip"',
                "Content-Length": str(len(data)),
            },
        )
    finally:
        shutil.rmtree(output_dir, ignore_errors=True)


@app.get("/api/download")
async def download_video_get(url: str, format_id: str, cookies_from_browser: Optional[str] = None):
    return await download_video(DownloadRequest(url=url, format_id=format_id, cookies_from_browser=cookies_from_browser))


@app.get("/api/playlist/download")
async def download_playlist_get(url: str, format_id: str, mode: str = "zip", selected_videos: Optional[str] = None, cookies_from_browser: Optional[str] = None):
    indices = None
    if selected_videos:
        indices = [int(i) for i in selected_videos.split(",")]
    return await download_playlist(PlaylistDownloadRequest(url=url, format_id=format_id, mode=mode, selected_videos=indices, cookies_from_browser=cookies_from_browser))


@app.get("/api/health")
async def health():
    return {"status": "ok"}
