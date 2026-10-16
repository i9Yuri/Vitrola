import json
import re
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
from .system import format_bytes, format_seconds, sanitize_filename

YTDLP_BIN = shutil.which("yt-dlp") or "/usr/local/bin/yt-dlp"
FFMPEG_BIN = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"
NODE_BIN = shutil.which("node")


def clean_media_title(raw_title: str) -> str:
    """Removes trailing bracketed 11-character video IDs like [aqz-KE-bpKQ] from titles."""
    if not raw_title:
        return ""
    cleaned = re.sub(r"\s*\[[a-zA-Z0-9_-]{11}\]$", "", raw_title).strip()
    return cleaned or raw_title


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
        "--ignore-config",
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
    raw_title = data.get("title", "Mídia sem título")
    title = clean_media_title(raw_title)
    uploader = (
        data.get("uploader")
        or data.get("channel")
        or data.get("creator")
        or "Desconhecido"
    )
    duration = data.get("duration")
    duration_str = format_seconds(duration) if duration else "--:--"

    # High quality thumbnail extraction (filtering 404-prone webp like vi_webp/maxresdefault.webp)
    vid_id = data.get("id")
    thumbnails = data.get("thumbnails", []) or []
    thumbnail_url = None

    valid_thumbs = []
    for t in thumbnails:
        u = t.get("url", "")
        if not u:
            continue
        # Exclude webp URLs that frequently return 404 on Google CDN
        if "vi_webp" in u or u.endswith("maxresdefault.webp"):
            continue
        valid_thumbs.append(t)

    if valid_thumbs:
        def thumb_score(thumb):
            u = thumb.get("url", "")
            is_jpg = ".jpg" in u or ".jpeg" in u
            w = thumb.get("width") or 0
            h = thumb.get("height") or 0
            pref = thumb.get("preference") or 0
            return (1 if is_jpg else 0, pref, w * h)

        sorted_thumbs = sorted(valid_thumbs, key=thumb_score, reverse=True)
        thumbnail_url = sorted_thumbs[0].get("url")

    if not thumbnail_url or "vi_webp" in thumbnail_url:
        thumbnail_url = data.get("thumbnail")

    # Safe fallback to standard YouTube thumbnail if missing or 404-prone
    if (not thumbnail_url or "vi_webp" in thumbnail_url or "maxresdefault.webp" in thumbnail_url) and vid_id:
        thumbnail_url = f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg"

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

    # Decorate audio streams with clean visual badges
    for idx, s in enumerate(audio_streams):
        if idx == 0:
            s["badge"] = "ORIGINAL / BIT-PERFECT"
            s["is_best"] = True
            s["label"] = f"{s['codec_name']} ({s['ext'].upper()}) - {s['bitrate_label']} [ORIGINAL / BIT-PERFECT]"
        else:
            s["badge"] = None
            s["is_best"] = False
            s["label"] = f"{s['codec_name']} ({s['ext'].upper()}) - {s['bitrate_label']} [{s['size_label']}]"

    # Detect YouTube Music / pure phonographic audio tracks
    is_music_domain = "music.youtube.com" in original_url.lower()
    uploader_str = str(uploader).lower()
    is_topic_channel = uploader_str.endswith("- topic") or " - topic" in uploader_str
    has_track_meta = bool(data.get("track") or data.get("album") or data.get("artist"))
    is_music_track = is_music_domain or is_topic_channel or has_track_meta

    # Check for genuine video streams (not just static canvas or storyboard)
    real_video_streams = [
        f for f in video_formats
        if (f.get("height") or 0) >= 144 and (f.get("fps") or 0) >= 10 and f.get("vcodec") not in ["none", None, ""]
    ]
    has_real_video = (len(real_video_streams) > 0) and not is_music_domain
    if is_topic_channel and len(real_video_streams) == 0:
        has_real_video = False

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

    if has_real_video:
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

        # Decorate video presets with best quality badge
        for idx, p in enumerate(available_presets):
            if idx == 0:
                p["badge"] = "MELHOR QUALIDADE"
                p["is_best"] = True
                p["label_formatted"] = f"{p['label']} [MELHOR QUALIDADE]"
            else:
                p["badge"] = None
                p["is_best"] = False
                p["label_formatted"] = p["label"]

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

    raw_filesize = data.get("filesize") or data.get("filesize_approx")
    if not raw_filesize and audio_streams:
        raw_filesize = audio_streams[0].get("filesize")

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
            "filesize": raw_filesize,
            "filesize_formatted": format_bytes(raw_filesize) if raw_filesize else None,
            "is_music_track": is_music_track,
            "has_real_video": has_real_video,
            "has_video": has_real_video,
        },
        "audio_streams": audio_streams,
        "video_presets": available_presets,
        "subtitles": available_subs,
    }


SUPPORTED_THUMBNAIL_CONTAINERS = {
    "mp3", "mkv", "mka", "ogg", "opus", "flac", "m4a", "mp4", "m4v", "mov"
}


def can_embed_thumbnail(container_format: Optional[str] = None, audio_codec: Optional[str] = None) -> bool:
    """Verifica se o contêiner/formato suporta embutição nativa de miniaturas pelo yt-dlp/Mutagen.
    Contêineres brutos WebM não suportam embutição e causam encerramento fatal no pós-processamento.
    """
    if not container_format:
        return False
    fmt = str(container_format).strip().lower()
    return fmt in SUPPORTED_THUMBNAIL_CONTAINERS


def purge_partial_download_artifacts(
    target_dir: Union[str, Path],
    media_title: Optional[str] = None,
    video_id: Optional[str] = None,
) -> None:
    """Purga preventivamente arquivos residuais parciais (.part, .ytdl, .temp)
    no diretório de destino para impedir a ocorrência de HTTP Error 416 (Requested range not satisfiable).
    Trata exceções de permissão/concorrência defensivamente sem interromper o fluxo principal.
    """
    if not target_dir:
        return
    try:
        p_dir = Path(target_dir).expanduser().resolve()
        if not p_dir.is_dir():
            return

        id_str = str(video_id).strip().lower() if video_id else None
        clean_title = (
            re.sub(r"[^\w\s\-\.\u00C0-\u017F]", "", str(media_title)).strip().lower()
            if media_title
            else ""
        )

        for entry in p_dir.iterdir():
            if not entry.is_file():
                continue
            name_lower = entry.name.lower()
            is_partial = (
                name_lower.endswith(".part")
                or name_lower.endswith(".ytdl")
                or ".part-" in name_lower
                or name_lower.endswith(".temp")
            )
            if not is_partial:
                continue

            match = False
            if id_str and id_str in name_lower:
                match = True
            elif clean_title and len(clean_title) >= 4:
                prefix = clean_title[:15]
                if prefix in name_lower:
                    match = True

            if match:
                try:
                    entry.unlink()
                    print(f"[YtDlp] Purged partial artifact: {entry.name}")
                except Exception as e:
                    print(f"[YtDlp] Warning: Could not remove locked partial file {entry.name}: {e}")
    except Exception as e:
        print(f"[YtDlp] Warning during partial artifacts scan: {e}")


IMAGE_EXTENSIONS = {".webp", ".png", ".jpg", ".jpeg", ".temp"}


def purge_orphan_thumbnails(output_audio_path: Union[str, Path, None]) -> None:
    """Varre o diretório do arquivo final buscando resíduos homônimos com extensões de imagem
    (.webp, .png, .jpg, .jpeg, .temp) ou contêineres intermediários (.webm quando o destino não é webm)
    e os remove sumariamente para garantir entrega em arquivo único limpo.
    """
    if not output_audio_path:
        return
    try:
        p = Path(output_audio_path).resolve()
        dir_path = p.parent
        if not dir_path.is_dir():
            return

        audio_ext = p.suffix.lower()
        base_name = p.stem
        clean_base = re.sub(r"[^\w\s\-\.\u00C0-\u017F]", "", base_name).strip().lower()

        for entry in dir_path.iterdir():
            if not entry.is_file() or entry == p:
                continue

            file_ext = entry.suffix.lower()
            file_stem = entry.stem
            clean_file_stem = re.sub(r"[^\w\s\-\.\u00C0-\u017F]", "", file_stem).strip().lower()

            is_orphan_image = file_ext in IMAGE_EXTENSIONS
            is_orphan_intermediate = (
                (file_ext == ".webm" and audio_ext != ".webm")
                or entry.name.endswith(".ytdl")
                or entry.name.endswith(".part")
            )

            if not is_orphan_image and not is_orphan_intermediate:
                continue

            is_match = False
            if file_stem == base_name or clean_file_stem == clean_base:
                is_match = True
            elif len(clean_base) >= 4 and (
                clean_file_stem.startswith(clean_base[:15]) or clean_base.startswith(clean_file_stem[:15])
            ):
                is_match = True

            if is_match:
                try:
                    entry.unlink(missing_ok=True)
                    print(f"[YtDlp] Purged orphan thumbnail/artifact: {entry.name}")
                except Exception as unlink_err:
                    print(f"[YtDlp] Warning: Could not remove orphan file {entry.name}: {unlink_err}")
    except Exception as e:
        print(f"[YtDlp] Warning during orphan thumbnail sweep: {e}")


def build_single_file_audio_args(
    url: str,
    target_directory: Union[str, Path],
    format: str = "original",
    embed_thumbnail: bool = True,
    embed_metadata: bool = True,
) -> List[str]:
    """Constrói os argumentos para download atômico de áudio consolidado em arquivo único,
    com extração/remux direto via FFmpeg, metadados e miniatura embutidos.
    """
    target_fmt = "best" if str(format).lower() in ("original", "source") else str(format).lower()
    cmd = [
        YTDLP_BIN,
        "--ignore-config",
        "--no-playlist",
        "--ffmpeg-location",
        FFMPEG_BIN,
        "--windows-filenames",
        "--no-part",
        "--no-continue",
        "--concurrent-fragments",
        "1",
        "--newline",
        "-o",
        f"{str(target_directory)}/%(title)s.%(ext)s",
        "-x",
        "--audio-format",
        target_fmt,
        "--no-keep-video",
    ]
    if NODE_BIN:
        cmd.extend(["--js-runtimes", f"node:{NODE_BIN}"])
    if embed_metadata:
        cmd.append("--add-metadata")
    if embed_thumbnail:
        cmd.append("--embed-thumbnail")
    if url:
        cmd.append(url)
    return cmd


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
    is_original_quality: bool = False,
    target_format: Optional[str] = None,
) -> List[str]:
    """
    Builds the exact yt-dlp command-line arguments.
    Enforces pure audio without transcoding and MP4 multi-resolution container.
    Saves cleanly as <Title>.<ext> without video ID brackets.
    Supports is_original_quality (direct extraction without recoding).
    """
    cmd = [
        YTDLP_BIN,
        "--ignore-config",
        "--no-playlist",
        "--ffmpeg-location",
        FFMPEG_BIN,
        "--windows-filenames",  # Ext4 / Linux safe filenames without forbidden chars
        "--no-part",            # Clean output
        "--no-continue",        # Impede requisições HTTP Range inválidas (HTTP 416)
        "--concurrent-fragments",
        "1",                    # Download sequencial limpo desde byte zero
        "--newline",            # One progress event per line
        # Precise stdout progress markers
        "--progress-template",
        "PROGRESS:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_estimate_str)s|%(progress.filename)s",
    ]

    if NODE_BIN:
        cmd.extend(["--js-runtimes", f"node:{NODE_BIN}"])

    output_template = str(output_dir / "%(title)s.%(ext)s")
    cmd.extend(["-o", output_template])

    is_original = (
        is_original_quality
        or str(target_format).lower() in ("original", "source")
        or str(format_id).lower() in ("original", "source")
    )

    if mode == "audio":
        # =========================================================================
        # PIPELINE DE ÁUDIO (ORIGINAL / BIT-PERFECT OU ESPECIFICADO)
        # =========================================================================
        if is_original:
            cmd.extend(["-f", "bestaudio/best"])
        elif format_id:
            cmd.extend(["-f", format_id])
        else:
            # Native best audio stream: Opus preferred, then M4A, then any native audio
            cmd.extend(["-f", "ba[ext=opus]/ba[ext=m4a]/ba"])

        # Remux atômico direto/lossless para contêiner de áudio legítimo (.opus/.m4a/.mp3)
        # eliminando contêiner WebM órfão e garantindo entrega em arquivo único
        audio_fmt = "best"
        if not is_original and target_format and str(target_format).lower() not in ("original", "source", "best"):
            audio_fmt = str(target_format).lower()
        cmd.extend(["-x", "--audio-format", audio_fmt, "--no-keep-video"])

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
        # PIPELINE DE VÍDEO
        # =========================================================================
        if is_original:
            cmd.extend(["-f", "bestvideo+bestaudio/best"])
        elif format_id:
            cmd.extend(["-f", f"{format_id}+bestaudio[ext=m4a]/bestaudio/best"])
            cmd.extend(["--merge-output-format", "mp4"])
        else:
            format_str = (
                f"bestvideo[height<={target_res}][ext=mp4]+bestaudio[ext=m4a]/"
                f"bestvideo[height<={target_res}]+bestaudio/"
                f"best[height<={target_res}]"
            )
            cmd.extend(["-f", format_str])
            cmd.extend(["--merge-output-format", "mp4"])

        if embed_metadata:
            cmd.append("--add-metadata")

        if embed_thumbnail:
            is_incompatible = (
                is_original
                and (not target_format or not can_embed_thumbnail(target_format))
            )
            if is_incompatible:
                cmd.append("--write-thumbnail")
            else:
                cmd.append("--embed-thumbnail")

        if embed_subtitles:
            lang = subtitle_lang if subtitle_lang else "pt,en.*"
            cmd.extend(["--write-subs", "--sub-langs", lang, "--embed-subs"])

    # URL to download
    cmd.append(url)
    return cmd
