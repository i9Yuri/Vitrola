import os
import json
import subprocess
import unittest
from pathlib import Path
import shutil

from backend.core.system import (
    load_config,
    sanitize_filename,
    get_unique_filepath,
    format_bytes,
    format_seconds,
)
from backend.core.ytdlp_wrapper import (
    build_download_command,
    parse_inspection_data,
)


class TestVitrolaCore(unittest.TestCase):
    def setUp(self):
        self.test_dir = Path(__file__).resolve().parent / "fixtures"
        self.test_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        if self.test_dir.exists():
            shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_sanitize_filename(self):
        dirty = "AC/DC - Back in Black: Live [1992] ? <4K> * | test"
        clean = sanitize_filename(dirty)
        self.assertNotIn("/", clean)
        self.assertNotIn("\\", clean)
        self.assertNotIn(":", clean)
        self.assertNotIn("*", clean)
        self.assertNotIn("?", clean)
        self.assertNotIn("<", clean)
        self.assertNotIn(">", clean)
        self.assertNotIn("|", clean)
        self.assertTrue(clean.startswith("AC-DC"))

    def test_unique_filepath(self):
        p1 = get_unique_filepath(self.test_dir, "song", "opus")
        p1.touch()
        p2 = get_unique_filepath(self.test_dir, "song", "opus")
        self.assertEqual(p2.name, "song_1.opus")
        p2.touch()
        p3 = get_unique_filepath(self.test_dir, "song", "opus")
        self.assertEqual(p3.name, "song_2.opus")

    def test_format_helpers(self):
        self.assertEqual(format_bytes(1024), "1.0 KiB")
        self.assertEqual(format_bytes(1048576), "1.0 MiB")
        self.assertEqual(format_seconds(65), "01:05")
        self.assertEqual(format_seconds(3665), "01:01:05")

    def test_pure_audio_command_flags(self):
        cmd = build_download_command(
            url="https://youtube.com/watch?v=mock123",
            mode="audio",
            output_dir=self.test_dir,
            embed_metadata=True,
            embed_thumbnail=True,
        )
        # Strict rules:
        cmd_str = " ".join(cmd)
        self.assertIn("-f ba[ext=opus]/ba[ext=m4a]/ba", cmd_str)
        self.assertIn("--add-metadata", cmd)
        self.assertIn("--embed-thumbnail", cmd)
        self.assertIn("--ignore-config", cmd)
        self.assertIn("-x", cmd)
        self.assertIn("--audio-format", cmd)
        self.assertIn("--no-keep-video", cmd)
        self.assertNotIn("--write-thumbnail", cmd)
        # Verify clean output template (no [%(id)s])
        self.assertNotIn("[%(id)s]", cmd_str)
        self.assertIn("/%(title)s.%(ext)s", cmd_str)

    def test_video_mp4_command_flags(self):
        cmd = build_download_command(
            url="https://youtube.com/watch?v=mock123",
            mode="video",
            output_dir=self.test_dir,
            target_res=1080,
            embed_metadata=True,
            embed_thumbnail=True,
            embed_subtitles=True,
            subtitle_lang="pt,en",
        )
        cmd_str = " ".join(cmd)
        self.assertIn("--ignore-config", cmd)
        self.assertIn("--merge-output-format mp4", cmd_str)
        self.assertIn("--write-subs", cmd)
        self.assertIn("--sub-langs", cmd)
        self.assertIn("pt,en", cmd)
        self.assertIn("--embed-subs", cmd)
        self.assertIn("height<=1080", cmd_str)
        # Verify clean output template (no [%(id)s])
        self.assertNotIn("[%(id)s]", cmd_str)
        self.assertIn("/%(title)s.%(ext)s", cmd_str)

    def test_clean_media_title(self):
        from backend.core.ytdlp_wrapper import clean_media_title
        self.assertEqual(
            clean_media_title("Daft Punk - Around the World [dQw4w9WgXcQ]"),
            "Daft Punk - Around the World"
        )
        self.assertEqual(
            clean_media_title("AC/DC - Back in Black [aqz-KE-bpKQ]"),
            "AC/DC - Back in Black"
        )
        self.assertEqual(
            clean_media_title("Song Name [Official Video]"),
            "Song Name [Official Video]"
        )

    def test_youtube_music_and_badges(self):
        # 1. YouTube Music Mock
        yt_music_dump = {
            "id": "ytm_123",
            "title": "Studio Master Track [dQw4w9WgXcQ]",
            "uploader": "Audio Artist - Topic",
            "duration": 180,
            "track": "Studio Master Track",
            "thumbnails": [
                {"url": "https://i.ytimg.com/vi_webp/ytm_123/maxresdefault.webp", "preference": 0},
                {"url": "https://i.ytimg.com/vi/ytm_123/maxresdefault.jpg", "preference": -1, "width": 1920, "height": 1080},
            ],
            "formats": [
                {
                    "format_id": "251",
                    "ext": "webm",
                    "vcodec": "none",
                    "acodec": "opus",
                    "abr": 160.0,
                    "asr": 48000,
                }
            ]
        }
        res_music = parse_inspection_data(yt_music_dump, "https://music.youtube.com/watch?v=ytm_123")
        self.assertTrue(res_music["success"])
        # Verify robust thumbnail selection avoided 404-prone webp
        self.assertEqual(res_music["metadata"]["thumbnail"], "https://i.ytimg.com/vi/ytm_123/maxresdefault.jpg")
        self.assertTrue(res_music["metadata"]["is_music_track"])
        self.assertFalse(res_music["metadata"]["has_real_video"])
        # Title clean
        self.assertEqual(res_music["metadata"]["title"], "Studio Master Track")
        # Audio badge
        self.assertEqual(res_music["audio_streams"][0]["badge"], "ORIGINAL / BIT-PERFECT")
        # Video presets empty since has_real_video is False
        self.assertEqual(len(res_music["video_presets"]), 0)

    def test_parse_inspection_data(self):
        mock_dump = {
            "id": "mock_id",
            "title": "Industrial Sound Machine - Track 01 [aqz-KE-bpKQ]",
            "uploader": "AudioForge Lab",
            "duration": 245,
            "thumbnails": [{"url": "https://img.youtube.com/vi/mock/maxresdefault.jpg", "preference": 1}],
            "tags": ["ambient", "industrial", "flac"],
            "view_count": 150200,
            "formats": [
                {
                    "format_id": "251",
                    "ext": "webm",
                    "vcodec": "none",
                    "acodec": "opus",
                    "abr": 160.0,
                    "asr": 48000,
                    "filesize": 4800000,
                },
                {
                    "format_id": "140",
                    "ext": "m4a",
                    "vcodec": "none",
                    "acodec": "mp4a.40.2",
                    "abr": 128.0,
                    "asr": 44100,
                    "filesize": 3900000,
                },
                {
                    "format_id": "137",
                    "ext": "mp4",
                    "vcodec": "avc1.640028",
                    "acodec": "none",
                    "height": 1080,
                    "fps": 60,
                    "filesize": 45000000,
                },
                {
                    "format_id": "248",
                    "ext": "webm",
                    "vcodec": "vp9",
                    "acodec": "none",
                    "height": 1080,
                    "fps": 30,
                    "filesize": 38000000,
                },
            ],
            "subtitles": {"pt": [{"name": "Português", "ext": "vtt"}]},
            "automatic_captions": {"en": [{"name": "English", "ext": "vtt"}]},
        }

        parsed = parse_inspection_data(mock_dump, "https://youtube.com/mock")
        self.assertTrue(parsed["success"])
        meta = parsed["metadata"]
        self.assertEqual(meta["title"], "Industrial Sound Machine - Track 01")
        self.assertEqual(meta["duration_str"], "04:05")
        self.assertFalse(meta["is_music_track"])
        self.assertTrue(meta["has_real_video"])

        # Audio streams
        audio = parsed["audio_streams"]
        self.assertEqual(len(audio), 2)
        # Opus should be sorted first (preferred) with badge
        self.assertEqual(audio[0]["codec_name"], "Opus")
        self.assertEqual(audio[0]["badge"], "ORIGINAL / BIT-PERFECT")
        self.assertEqual(audio[0]["format_id"], "251")
        self.assertEqual(audio[1]["codec_name"], "AAC / M4A")

        # Video presets with best quality badge
        video_presets = parsed["video_presets"]
        self.assertTrue(any(p["height"] == 1080 for p in video_presets))
        self.assertEqual(video_presets[0]["badge"], "MELHOR QUALIDADE")

        # Subtitles
        subs = parsed["subtitles"]
        self.assertTrue(any(s["code"] == "pt" for s in subs))
        self.assertTrue(any(s["code"] == "en" for s in subs))

        # Original Audio & Video metadata
        self.assertIn("originalAudio", parsed)
        self.assertIn("originalVideo", parsed)
        self.assertIn("originalAudio", meta)
        self.assertIn("originalVideo", meta)
        self.assertEqual(parsed["originalAudio"]["codec"], "Opus")
        self.assertEqual(parsed["originalAudio"]["ext"], "webm")
        self.assertEqual(parsed["originalAudio"]["bitrate"], 160.0)
        self.assertIn("Fonte original (Opus ~160 kbps)", parsed["originalAudio"]["label"])
        self.assertIsNotNone(parsed["originalVideo"])
        self.assertEqual(parsed["originalVideo"]["resolution"], "1080p")

    def test_extract_info_alias(self):
        from backend.downloader import extract_info
        from backend.core.ytdlp_wrapper import inspect_url
        self.assertIs(extract_info, inspect_url)


    def test_ffprobe_pure_opus_audio(self):
        """Generate test pure opus file and verify with ffprobe without re-encoding."""
        opus_path = self.test_dir / "test_pure_opus.opus"
        # Create pure opus audio test tone using ffmpeg with metadata
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f", "lavfi",
                "-i", "sine=frequency=440:duration=1",
                "-c:a", "libopus",
                "-b:a", "128k",
                "-metadata", "title=Pure Opus Test",
                "-metadata", "artist=Vitrola Tester",
                str(opus_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        # Inspect using ffprobe
        probe_cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            str(opus_path),
        ]
        probe_res = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
        probe_data = json.loads(probe_res.stdout)

        streams = probe_data.get("streams", [])
        self.assertEqual(len(streams), 1)
        self.assertEqual(streams[0].get("codec_name"), "opus")
        self.assertEqual(streams[0].get("codec_type"), "audio")

        stream_tags = streams[0].get("tags", {}) or {}
        format_tags = probe_data.get("format", {}).get("tags", {}) or {}
        combined_tags = {**format_tags, **stream_tags}
        self.assertEqual(combined_tags.get("title"), "Pure Opus Test")
        self.assertEqual(combined_tags.get("artist"), "Vitrola Tester")

    def test_ffprobe_mp4_video_with_subtitles(self):
        """Generate test MP4 container with video, audio and subtitle stream and verify with ffprobe."""
        mp4_path = self.test_dir / "test_video_1080p.mp4"
        srt_path = self.test_dir / "test_sub.srt"
        srt_path.write_text(
            "1\n00:00:00,000 --> 00:00:01,000\nLegenda de Teste Vitrola\n",
            encoding="utf-8",
        )

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f", "lavfi",
                "-i", "color=c=black:s=1920x1080:d=1",
                "-f", "lavfi",
                "-i", "sine=frequency=1000:duration=1",
                "-i", str(srt_path),
                "-c:v", "libx264",
                "-c:a", "aac",
                "-c:s", "mov_text",
                "-metadata:s:s:0", "language=por",
                "-metadata", "title=1080p MP4 Test",
                str(mp4_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        probe_cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            str(mp4_path),
        ]
        probe_res = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
        probe_data = json.loads(probe_res.stdout)

        streams = probe_data.get("streams", [])
        types = [s.get("codec_type") for s in streams]
        self.assertIn("video", types)
        self.assertIn("audio", types)
        self.assertIn("subtitle", types)

        v_stream = next(s for s in streams if s.get("codec_type") == "video")
        self.assertEqual(v_stream.get("height"), 1080)
        self.assertEqual(v_stream.get("width"), 1920)

        # Check MP4 container
        fmt = probe_data.get("format", {}).get("format_name", "")
        self.assertIn("mp4", fmt.lower())

    def test_history_management_and_sanitization(self):
        from backend.downloader import DownloadManager, format_size_bytes

        mgr = DownloadManager()
        # Seed test history entries
        mgr.history = [
            {
                "id": "t1",
                "media_key": "song1_mp3",
                "title": "Song 1",
                "mode": "audio",
                "total_size": "NA",
                "download_count": 1,
            },
            {
                "id": "t2",
                "media_key": "song2_mp4",
                "title": "Song 2",
                "mode": "video",
                "total_size": "5.4 MiB",
                "download_count": 3,
            },
        ]

        # Verify format_size_bytes
        self.assertEqual(format_size_bytes(1024), "1.0 KiB")
        self.assertEqual(format_size_bytes(10485760), "10.0 MiB")

        # Delete single item by media_key
        deleted = mgr.delete_history_item("song1_mp3")
        self.assertTrue(deleted)
        self.assertEqual(len(mgr.get_history()), 1)
        self.assertEqual(mgr.get_history()[0]["media_key"], "song2_mp4")

        # Clear all history
        cleared = mgr.clear_history()
        self.assertTrue(cleared)
        self.assertEqual(len(mgr.get_history()), 0)

        # Active tasks cancellation test
        mgr.cancel_all_active_tasks()
        self.assertFalse(mgr.is_download_active())

    def test_purge_partial_download_artifacts(self):
        from backend.core.ytdlp_wrapper import purge_partial_download_artifacts

        # Create mock partial files
        part1 = self.test_dir / "VENERE VAI VENUS - Anjos.opus.part"
        part2 = self.test_dir / "VENERE VAI VENUS - Anjos.ytdl"
        part3 = self.test_dir / "Other Song.mp3.part"
        final_file = self.test_dir / "VENERE VAI VENUS - Anjos.opus"

        part1.touch()
        part2.touch()
        part3.touch()
        final_file.touch()

        # Purge only artifacts matching the media title
        purge_partial_download_artifacts(self.test_dir, "VENERE VAI VENUS - Anjos")

        self.assertFalse(part1.exists(), ".part file should have been deleted")
        self.assertFalse(part2.exists(), ".ytdl file should have been deleted")
        self.assertTrue(part3.exists(), "Unrelated partial file should not have been touched")
        self.assertTrue(final_file.exists(), "Completed media file must not be deleted")

    def test_purge_orphan_thumbnails(self):
        from backend.core.ytdlp_wrapper import purge_orphan_thumbnails

        # Create mock audio file and orphan image files
        audio_file = self.test_dir / "Pink Floyd - Time.opus"
        orphan_webp = self.test_dir / "Pink Floyd - Time.webp"
        orphan_png = self.test_dir / "Pink Floyd - Time.png"
        orphan_intermediate = self.test_dir / "Pink Floyd - Time.webm"
        unrelated_image = self.test_dir / "Other Album Cover.jpg"

        audio_file.touch()
        orphan_webp.touch()
        orphan_png.touch()
        orphan_intermediate.touch()
        unrelated_image.touch()

        purge_orphan_thumbnails(audio_file)

        self.assertTrue(audio_file.exists(), "Audio file must be preserved")
        self.assertFalse(orphan_webp.exists(), "Orphan webp should be deleted")
        self.assertFalse(orphan_png.exists(), "Orphan png should be deleted")
        self.assertFalse(orphan_intermediate.exists(), "Intermediate webm should be deleted")
        self.assertTrue(unrelated_image.exists(), "Unrelated image should be preserved")

    def test_build_single_file_audio_args(self):
        from backend.core.ytdlp_wrapper import build_single_file_audio_args

        cmd = build_single_file_audio_args(
            url="https://youtube.com/watch?v=mock456",
            target_directory=self.test_dir,
            format="original",
            embed_thumbnail=True,
            embed_metadata=True,
        )
        self.assertIn("-x", cmd)
        self.assertIn("--audio-format", cmd)
        self.assertIn("best", cmd)
        self.assertIn("--no-keep-video", cmd)
        self.assertIn("--embed-thumbnail", cmd)
        self.assertIn("--add-metadata", cmd)
        self.assertNotIn("--write-thumbnail", cmd)

    def test_no_continue_flags_in_download_command(self):
        cmd = build_download_command(
            url="https://youtube.com/watch?v=mock123",
            mode="audio",
            output_dir=self.test_dir,
            is_original_quality=True,
        )
        self.assertIn("--no-continue", cmd)
        self.assertIn("--concurrent-fragments", cmd)
        self.assertIn("1", cmd)
        self.assertIn("--no-part", cmd)
        self.assertNotIn("--http-chunk-size", " ".join(cmd))

    def test_electron_bootstrap_and_asset_integrity(self):
        root = Path(__file__).resolve().parent.parent
        main_js = root / "src" / "main" / "main.js"
        preload_js = root / "src" / "main" / "preload.js"
        index_html = root / "src" / "renderer" / "index.html"

        self.assertTrue(main_js.exists(), "src/main/main.js must exist")
        self.assertTrue(preload_js.exists(), "src/main/preload.js must exist")
        self.assertTrue(index_html.exists(), "src/renderer/index.html must exist")

        # Verify index.html does not contain root-relative file:/// links
        content = index_html.read_text(encoding="utf-8")
        self.assertNotIn('href="/styles/', content, "Stylesheets must not use absolute root paths")
        self.assertNotIn('src="/js/', content, "Scripts must not use absolute root paths")
        self.assertIn('href="./styles/', content, "Stylesheets must use relative paths")
        self.assertIn('src="./js/', content, "Scripts must use relative paths")

        # Verify Node syntax check passes
        res_main = subprocess.run(["node", "-c", str(main_js)], capture_output=True, text=True)
        self.assertEqual(res_main.returncode, 0, f"main.js syntax error: {res_main.stderr}")

        res_preload = subprocess.run(["node", "-c", str(preload_js)], capture_output=True, text=True)
        self.assertEqual(res_preload.returncode, 0, f"preload.js syntax error: {res_preload.stderr}")

    def test_packaging_and_binary_resolution(self):
        root = Path(__file__).resolve().parent.parent
        package_json_path = root / "package.json"
        self.assertTrue(package_json_path.exists(), "package.json must exist")

        with open(package_json_path, "r", encoding="utf-8") as f:
            pkg = json.load(f)

        self.assertIn("build", pkg, "package.json must have 'build' field")
        bld = pkg["build"]
        self.assertTrue(bld.get("asar"), "asar must be true")
        self.assertIn("**/bin/*", bld.get("asarUnpack", []), "asarUnpack must contain '**/bin/*'")
        self.assertEqual(bld.get("compression"), "normal")
        self.assertEqual(bld.get("appId"), "com.vitrola.app")
        self.assertEqual(bld.get("productName"), "Vitrola")
        self.assertIn("linux", bld)
        self.assertEqual(bld["linux"]["category"], "AudioVideo")

        # Test local bin binaries existence and execution bits
        bin_dir = root / "bin"
        self.assertTrue(bin_dir.is_dir(), "bin directory must exist")
        yt_bin = bin_dir / "yt-dlp"
        ff_bin = bin_dir / "ffmpeg"
        self.assertTrue(yt_bin.exists(), "bin/yt-dlp must exist")
        self.assertTrue(ff_bin.exists(), "bin/ffmpeg must exist")
        self.assertTrue(os.access(yt_bin, os.X_OK), "bin/yt-dlp must be executable")
        self.assertTrue(os.access(ff_bin, os.X_OK), "bin/ffmpeg must be executable")

        # Test getExecutableBinaryPath in Node.js
        check_script = (
            "const { getExecutableBinaryPath } = require('./src/main/downloader/core');"
            "const ytdlp = getExecutableBinaryPath('yt-dlp');"
            "const ffmpeg = getExecutableBinaryPath('ffmpeg');"
            "if (!ytdlp || !ffmpeg) process.exit(1);"
            "console.log('SUCCESS');"
        )
        res_bin = subprocess.run(["node", "-e", check_script], cwd=str(root), capture_output=True, text=True)
        self.assertEqual(res_bin.returncode, 0, f"getExecutableBinaryPath failed: {res_bin.stderr}")
        self.assertIn("SUCCESS", res_bin.stdout)

        # Test bootstrapOptimizedWindow export
        check_bootstrap = (
            "const main = require('./src/main/main');"
            "if (typeof main.bootstrapOptimizedWindow !== 'function') process.exit(1);"
            "if (typeof main.windowController.minimizeWindow !== 'function') process.exit(2);"
            "if (typeof main.windowController.forceTeardown !== 'function') process.exit(3);"
            "console.log('BOOTSTRAP_OK');"
        )
        res_boot = subprocess.run(["node", "-e", check_bootstrap], cwd=str(root), capture_output=True, text=True)
        self.assertEqual(res_boot.returncode, 0, f"bootstrap export check failed: {res_boot.stderr}")
        self.assertIn("BOOTSTRAP_OK", res_boot.stdout)


if __name__ == "__main__":
    unittest.main()


