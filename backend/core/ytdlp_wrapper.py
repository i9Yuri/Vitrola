import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from .system import format_bytes, format_seconds, sanitize_filename

YTDLP_BIN = shutil.which("yt-dlp") or "/usr/local/bin/yt-dlp"
FFMPEG_BIN = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"
NODE_BIN = shutil.which("node")


def inspect_url(url: str, timeout: int = 40) -> Dict[str, Any]:
    """
    Extract video/audio metadata using yt-dlp --dump-single-json.
    Returns structured metadata, audio streams, video presets, and subtitles.
    """
    if not url or not url.strip():
        return {"success": False, "error": "URL não fornecida"}

    clean_url = url.strip()

    cmd = [
        YTDLP_BIN,
        "--dump-single-json",
        "--no-playlist",
        "--skip-download",
        "--no-warnings",
    ]

    if NODE_BIN:
        cmd.extend(["--js-runtimes", f"node:{NODE_BIN}"])

    cmd.append(clean_url)

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Tempo limite esgotado ao inspecionar a URL (mais de 40s). Verifique sua conexão.",
        }
    except Exception as e:
        return {"success": False, "error": f"Falha ao executar yt-dlp: {str(e)}"}

    if proc.returncode != 0:
        err = proc.stderr.strip() or "Erro desconhecido ao extrair metadados"
        # Simplify common yt-dlp error messages
        if "Incomplete YouTube ID" in err or "is not a valid URL" in err:
            err = "URL inválida ou formato não reconhecido."
        elif "Private video" in err:
            err = "Este vídeo é privado ou requer autenticação."
        elif "Sign in to confirm your age" in err:
            err = "Vídeo com restrição de idade."
        return {"success": False, "error": err}

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"success": False, "error": "Resposta JSON inválida recebida do yt-dlp."}

    return parse_inspection_data(data, clean_url)


def parse_inspection_data(data: Dict[str, Any], original_url: str) -> Dict[str, Any]:
    """Parse raw yt-dlp JSON dump into clean, structured data for the frontend."""
    # Video details
    title = data.get("title", "Mídia sem título")
    uploader = (
        data.get("uploader")
        or data.get("channel")
        or data.get("creator")
        or "Desconhecido"
    )
    duration = data.get("duration")
    duration_str = format_seconds(duration) if duration else "--:--"

    # High quality thumbnail
    thumbnails = data.get("thumbnails", [])
    thumbnail_url = data.get("thumbnail")
    if thumbnails:
        # Pick the largest/best resolution thumbnail
        sorted_thumbs = sorted(
            [t for t in thumbnails if t.get("url")],
            key=lambda x: (x.get("preference", 0) or 0, (x.get("width", 0) or 0) * (x.get("height", 0) or 0)),
            reverse=True,
        )
        if sorted_thumbs:
            thumbnail_url = sorted_thumbs[0]["url"]

    tags = data.get("tags", []) or []
    view_count = data.get("view_count")

    # Formats analysis
    raw_formats = data.get("formats", [])

    audio_streams = []
    video_resolutions = set()
    video_formats = []

    # Map formats
    for f in raw_formats:
        fid = f.get("format_id", "")
        ext = f.get("ext", "")
        vcodec = f.get("vcodec", "none")
        acodec = f.get("acodec", "none")
        filesize = f.get("filesize") or f.get("filesize_approx")
        abr = f.get("abr") or f.get("tbr")
        asr = f.get("asr")
        height = f.get("height")
        fps = f.get("fps")

        is_audio_only = (vcodec == "none" or not vcodec) and (acodec != "none" and acodec)
        is_video = (vcodec != "none" and vcodec)

        if is_audio_only:
            # Clean codec name
            codec_clean = "desconhecido"
            if "opus" in acodec.lower():
                codec_clean = "Opus"
            elif "mp4a" in acodec.lower() or "aac" in acodec.lower():
                codec_clean = "AAC / M4A"
            elif "flac" in acodec.lower():
                codec_clean = "FLAC"
            elif "vorbis" in acodec.lower():
                codec_clean = "Vorbis"
            elif "mp3" in acodec.lower():
                codec_clean = "MP3"
            else:
                codec_clean = acodec.split(".")[0].upper()

            bitrate_label = f"{int(abr)} kbps" if abr else "Taxa dinâmica"
            size_label = format_bytes(filesize) if filesize else "Tamanho estimado N/A"

            audio_streams.append({
                "format_id": fid,
                "ext": ext,
                "acodec": acodec,
                "codec_name": codec_clean,
                "bitrate": round(abr, 1) if abr else 0,
                "bitrate_label": bitrate_label,
                "sample_rate": f"{asr} Hz" if asr else None,
                "filesize": filesize,
                "size_label": size_label,
                "label": f"{codec_clean} ({ext.upper()}) - {bitrate_label} [{size_label}]",
                "is_preferred": ("opus" in acodec.lower() or ext in ["m4a", "opus"]),
            })

        if is_video and height:
            video_resolutions.add(height)
            fps_label = f"{int(fps)}fps" if fps and fps > 30 else ""
            video_formats.append({
                "format_id": fid,
                "height": height,
                "ext": ext,
                "vcodec": vcodec,
                "acodec": acodec,
                "fps": fps,
                "filesize": filesize,
                "fps_label": fps_label,
            })

    # Sort audio streams: highest bitrate first, favoring opus / m4a
    def audio_sort_key(item):
        is_opus = "opus" in item["acodec"].lower()
        is_m4a = "m4a" in item["ext"] or "aac" in item["acodec"].lower()
        priority = 2 if is_opus else (1 if is_m4a else 0)
        return (priority, item["bitrate"])

    audio_streams.sort(key=audio_sort_key, reverse=True)

    # Standard video quality presets
    preset_order = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144]
    available_presets = []
    max_height = max(video_resolutions) if video_resolutions else 0

    preset_names = {
        4320: "8K Ultra HD (4320p)",
        2160: "4K Ultra HD (2160p)",
        1440: "2K Quad HD (1440p)",
        1080: "Full HD (1080p)",
        720: "HD (720p)",
        480: "SD (480p)",
        360: "360p",
        240: "240p",
        144: "144p",
    }

    for p in preset_order:
        if p in video_resolutions or (available_presets == [] and max_height >= p):
            available_presets.append({
                "height": p,
                "label": preset_names.get(p, f"{p}p"),
                "is_default": p == 1080 or (p == max_height and max_height < 1080),
            })
    # If no standard preset matched but max_height exists
    if not available_presets and max_height > 0:
        available_presets.append({
            "height": max_height,
            "label": f"Resolução Nativa ({max_height}p)",
            "is_default": True,
        })

    # Subtitles
    subs = data.get("subtitles", {}) or {}
    auto_subs = data.get("automatic_captions", {}) or {}

    available_subs = []
    # Collect manual subs first
    for lang_code, sub_list in subs.items():
        name = lang_code
        if sub_list and isinstance(sub_list, list) and len(sub_list) > 0:
            name = sub_list[0].get("name") or lang_code
        available_subs.append({
            "code": lang_code,
            "name": f"{name} (Oficial)",
            "is_auto": False,
        })

    # Collect common automatic subtitles if manual not already present
    common_langs = ["pt", "en", "es", "ja", "fr", "de", "it"]
    for lang_code in common_langs:
        if lang_code in auto_subs and not any(s["code"] == lang_code for s in available_subs):
            sub_list = auto_subs[lang_code]
            name = lang_code
            if sub_list and isinstance(sub_list, list) and len(sub_list) > 0:
                name = sub_list[0].get("name") or lang_code
            available_subs.append({
                "code": lang_code,
                "name": f"{name} (Auto-gerada)",
                "is_auto": True,
            })

    return {
        "success": True,
        "metadata": {
            "id": data.get("id"),
            "url": original_url,
            "title": title,
            "uploader": uploader,
            "duration": duration,
            "duration_str": duration_str,
            "thumbnail": thumbnail_url,
            "tags": tags[:10],
            "view_count": view_count,
        },
        "audio_streams": audio_streams,
        "video_presets": available_presets,
        "subtitles": available_subs,
    }


def build_download_command(
    url: str,
    mode: str,
    output_dir: Path,
    format_id: Optional[str] = None,
    target_res: int = 1080,
    embed_metadata: bool = True,
    embed_thumbnail: bool = True,
    embed_subtitles: bool = False,
    subtitle_lang: Optional[str] = None,
) -> List[str]:
    """
    Builds the exact yt-dlp command-line arguments.
    Enforces pure audio without transcoding and MP4 multi-resolution container.
    """
    cmd = [
        YTDLP_BIN,
        "--no-playlist",
        "--ffmpeg-location",
        FFMPEG_BIN,
        "--windows-filenames",  # Ext4 / Linux safe filenames without forbidden chars
        "--no-part",            # Clean output
        "--newline",            # One progress event per line
        # Precise stdout progress markers
        "--progress-template",
        "PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_estimate_str)s|%(progress.filename)s",
    ]

    if NODE_BIN:
        cmd.extend(["--js-runtimes", f"node:{NODE_BIN}"])

    output_template = str(output_dir / "%(title)s [%(id)s].%(ext)s")
    cmd.extend(["-o", output_template])

    if mode == "audio":
        # =========================================================================
        # PIPELINE DE ÁUDIO PURO (BIT-PERFECT / SEM RECODIFICAÇÃO)
        # =========================================================================
        if format_id:
            cmd.extend(["-f", format_id])
        else:
            # Native best audio stream: Opus preferred, then M4A, then any native audio
            cmd.extend(["-f", "ba[ext=opus]/ba[ext=m4a]/ba"])

        # Embed complete metadata and album art / thumbnail
        if embed_metadata:
            cmd.append("--add-metadata")
        if embed_thumbnail:
            cmd.append("--embed-thumbnail")

        # Lyrics / subtitles embedding if requested
        if embed_subtitles:
            lang = subtitle_lang if subtitle_lang else "all"
            cmd.extend(["--write-subs", "--sub-langs", lang, "--embed-subs"])

    else:
        # =========================================================================
        # PIPELINE DE VÍDEO MP4 (MULTI-RESOLUÇÃO)
        # =========================================================================
        if format_id:
            cmd.extend(["-f", f"{format_id}+bestaudio[ext=m4a]/bestaudio/best"])
        else:
            format_str = (
                f"bestvideo[height<={target_res}][ext=mp4]+bestaudio[ext=m4a]/"
                f"bestvideo[height<={target_res}]+bestaudio/"
                f"best[height<={target_res}]"
            )
            cmd.extend(["-f", format_str])

        # Enforce final MP4 container
        cmd.extend(["--merge-output-format", "mp4"])

        if embed_metadata:
            cmd.append("--add-metadata")
        if embed_thumbnail:
            cmd.append("--embed-thumbnail")

        if embed_subtitles:
            lang = subtitle_lang if subtitle_lang else "pt,en.*"
            cmd.extend(["--write-subs", "--sub-langs", lang, "--embed-subs"])

    # URL to download
    cmd.append(url)
    return cmd
