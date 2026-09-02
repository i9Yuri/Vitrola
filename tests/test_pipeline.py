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


class TestMediaForgeCore(unittest.TestCase):
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
        self.assertNotIn("-x", cmd)
        self.assertNotIn("--audio-format", cmd)
        self.assertNotIn("mp3", cmd_str)

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
        self.assertIn("--merge-output-format mp4", cmd_str)
        self.assertIn("--write-subs", cmd)
        self.assertIn("--sub-langs", cmd)
        self.assertIn("pt,en", cmd)
        self.assertIn("--embed-subs", cmd)
        self.assertIn("height<=1080", cmd_str)

    def test_parse_inspection_data(self):
        mock_dump = {
            "id": "mock_id",
            "title": "Industrial Sound Machine - Track 01",
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

        # Audio streams
        audio = parsed["audio_streams"]
        self.assertEqual(len(audio), 2)
        # Opus should be sorted first (preferred)
        self.assertEqual(audio[0]["codec_name"], "Opus")
        self.assertEqual(audio[0]["format_id"], "251")
        self.assertEqual(audio[1]["codec_name"], "AAC / M4A")

        # Video presets
        video_presets = parsed["video_presets"]
        self.assertTrue(any(p["height"] == 1080 for p in video_presets))

        # Subtitles
        subs = parsed["subtitles"]
        self.assertTrue(any(s["code"] == "pt" for s in subs))
        self.assertTrue(any(s["code"] == "en" for s in subs))

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
                "-metadata", "artist=MediaForge Tester",
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
        self.assertEqual(combined_tags.get("artist"), "MediaForge Tester")

    def test_ffprobe_mp4_video_with_subtitles(self):
        """Generate test MP4 container with video, audio and subtitle stream and verify with ffprobe."""
        mp4_path = self.test_dir / "test_video_1080p.mp4"
        srt_path = self.test_dir / "test_sub.srt"
        srt_path.write_text(
            "1\n00:00:00,000 --> 00:00:01,000\nLegenda de Teste MediaForge\n",
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


if __name__ == "__main__":
    unittest.main()
