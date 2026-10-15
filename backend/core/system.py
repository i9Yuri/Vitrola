import os
import re
import sys
import json
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any


def get_resource_path(relative_path: str) -> Path:
    """Get absolute path to resource, works for dev and for PyInstaller bundle."""
    if hasattr(sys, "_MEIPASS"):
        return Path(getattr(sys, "_MEIPASS")) / relative_path
    return (Path(__file__).resolve().parent.parent.parent / relative_path).resolve()


def get_config_path() -> Path:
    """Get the active configuration file path honoring XDG standard."""
    user_config = Path(os.path.expanduser("~/.config/vitrola/config.json"))
    if user_config.exists():
        return user_config
    for legacy_name in ["mare", "mediaforge"]:
        legacy_user_config = Path(os.path.expanduser(f"~/.config/{legacy_name}/config.json"))
        if legacy_user_config.exists():
            try:
                user_config.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(legacy_user_config, user_config)
                print(f"[System] Migrada configuração legada de {legacy_user_config} para {user_config}")
                return user_config
            except Exception as e:
                print(f"[System] Aviso ao migrar configuração legada: {e}")
                return legacy_user_config

    local_cfg = Path.cwd() / "config" / "config.json"
    if local_cfg.exists():
        return local_cfg
    pkg_cfg = get_resource_path("config/config.json")
    if pkg_cfg.exists():
        return pkg_cfg
    return user_config


def load_config() -> Dict[str, Any]:
    """Load configuration from config.json with safe fallbacks."""
    default_cfg = {
        "server": {"host": "127.0.0.1", "port": 8765},
        "storage": {
            "download_dir": "~/Música/Vitrola",
            "fallback_dir": "downloads",
        },
        "defaults": {
            "mode": "audio",
            "embed_metadata": True,
            "embed_thumbnail": True,
            "embed_subtitles": False,
            "default_subtitle_lang": "pt,en",
            "audio_codec_priority": ["opus", "m4a", "webm"],
            "max_video_resolution": 1080,
        },
    }
    cfg_path = get_config_path()
    if not cfg_path.exists():
        return default_cfg
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Merge shallow keys
            for k, v in default_cfg.items():
                if k not in data:
                    data[k] = v
                elif isinstance(v, dict) and isinstance(data[k], dict):
                    merged = {**v, **data[k]}
                    data[k] = merged
            return data
    except Exception as e:
        print(f"[System] Warning: Failed to parse {cfg_path}: {e}")
        return default_cfg


def save_config(new_config: Dict[str, Any]) -> bool:
    """Save updated configuration to ~/.config/vitrola/config.json."""
    target = Path(os.path.expanduser("~/.config/vitrola/config.json"))
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            json.dump(new_config, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[System] Error saving config: {e}")
        return False


def get_download_directory() -> Path:
    """Resolve and create the effective download directory."""
    cfg = load_config()
    raw_path = cfg.get("storage", {}).get("download_dir", "~/Música/Vitrola")
    expanded = Path(os.path.expanduser(raw_path)).resolve()

    try:
        expanded.mkdir(parents=True, exist_ok=True)
        # Test writability
        test_file = expanded / ".write_test"
        test_file.touch()
        test_file.unlink()
        return expanded
    except Exception as e:
        fallback = Path(os.path.expanduser("~/Downloads/Vitrola")).resolve()
        try:
            fallback.mkdir(parents=True, exist_ok=True)
            return fallback
        except Exception:
            fallback_local = (Path.cwd() / "downloads").resolve()
            fallback_local.mkdir(parents=True, exist_ok=True)
            return fallback_local


def sanitize_filename(name: str) -> str:
    """
    Sanitize filename for Linux ext4/POSIX compatibility.
    Removes null bytes, forward slashes, and control characters while preserving unicode.
    """
    # Replace slashes and backslashes with underscores or hyphens
    sanitized = re.sub(r'[/\\:\0*?"<>|]', "-", name)
    # Collapse multiple whitespace or hyphens
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    sanitized = re.sub(r"-+", "-", sanitized)
    if not sanitized:
        sanitized = "media_download"
    # Linux max filename is 255 bytes
    return sanitized[:240]


def get_unique_filepath(directory: Path, desired_name: str, ext: str) -> Path:
    """
    Returns a unique file path in the target directory by appending _1, _2 if already exists.
    """
    clean_base = sanitize_filename(desired_name)
    clean_ext = ext.lstrip(".")
    candidate = directory / f"{clean_base}.{clean_ext}"

    if not candidate.exists():
        return candidate

    counter = 1
    while True:
        candidate = directory / f"{clean_base}_{counter}.{clean_ext}"
        if not candidate.exists():
            return candidate
        counter += 1


def open_in_file_manager(target_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Open the directory or file with xdg-open in Nobara Linux.
    Returns status dict.
    """
    if not shutil.which("xdg-open"):
        return {"success": False, "error": "xdg-open binary not found on system"}

    dl_dir = get_download_directory()
    path_to_open = None

    if target_path:
        p = Path(target_path)
        if p.exists():
            path_to_open = p
        else:
            # Check if it's a relative filename in download dir
            candidate = dl_dir / target_path
            if candidate.exists():
                path_to_open = candidate
            elif p.parent.exists():
                path_to_open = p.parent

    if not path_to_open or not path_to_open.exists():
        path_to_open = dl_dir

    dest = str(path_to_open)
    try:
        subprocess.Popen(
            ["xdg-open", dest],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return {"success": True, "opened": dest}
    except Exception as e:
        return {"success": False, "error": str(e)}


def format_bytes(size: Optional[float]) -> str:
    """Format bytes into human-readable string."""
    if size is None or size <= 0:
        return "N/A"
    units = ["B", "KiB", "MiB", "GiB", "TiB"]
    val = float(size)
    for u in units:
        if val < 1024.0 or u == units[-1]:
            return f"{val:.1f} {u}"
        val /= 1024.0
    return f"{val:.1f} GiB"


def format_seconds(seconds: Optional[float]) -> str:
    """Format seconds into HH:MM:SS or MM:SS."""
    if seconds is None or seconds < 0:
        return "--:--"
    total_secs = int(seconds)
    hours = total_secs // 3600
    minutes = (total_secs % 3600) // 60
    secs = total_secs % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def select_directory_dialog() -> Dict[str, Any]:
    """
    Shows native Linux folder picker dialog using Zenity or KDialog.
    Updates config if a folder is selected.
    """
    current = str(get_download_directory())
    chosen = None

    if shutil.which("zenity"):
        try:
            proc = subprocess.run(
                [
                    "zenity",
                    "--file-selection",
                    "--directory",
                    f"--filename={current}/",
                    "--title=Selecionar pasta para downloads",
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if proc.returncode == 0:
                chosen = proc.stdout.strip()
        except Exception as e:
            print(f"[System] Zenity dialog error: {e}")
    elif shutil.which("kdialog"):
        try:
            proc = subprocess.run(
                ["kdialog", "--getexistingdirectory", current],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if proc.returncode == 0:
                chosen = proc.stdout.strip()
        except Exception as e:
            print(f"[System] KDialog error: {e}")

    if chosen and Path(chosen).is_dir():
        cfg = load_config()
        if "storage" not in cfg:
            cfg["storage"] = {}
        cfg["storage"]["download_dir"] = chosen
        save_config(cfg)
        return {"canceled": False, "path": chosen}

    return {"canceled": True, "path": current}
