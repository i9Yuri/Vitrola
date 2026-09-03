import unittest
from pathlib import Path
from backend.core.updater import YtDlpUpdater
from backend.core.system import get_resource_path


class MockDownloadManager:
    def __init__(self, is_active: bool):
        self._is_active = is_active

    def is_download_active(self) -> bool:
        return self._is_active


class TestYtDlpUpdater(unittest.TestCase):
    def test_version_detection(self):
        updater = YtDlpUpdater()
        self.assertIsNotNone(updater.current_version)
        self.assertNotEqual(updater.current_version, "")

    def test_updater_state_dict(self):
        updater = YtDlpUpdater()
        d = updater.to_dict()
        self.assertIn("current_version", d)
        self.assertIn("status", d)
        self.assertIn("update_available", d)
        self.assertIn("message", d)

    def test_concurrency_protection_during_active_download(self):
        updater = YtDlpUpdater()
        mock_active_manager = MockDownloadManager(is_active=True)

        res = updater.perform_update(mock_active_manager)
        self.assertFalse(res.get("success"))
        self.assertIn("download está em andamento", res.get("error", "").lower())

    def test_resource_path_resolution(self):
        fe_path = get_resource_path("frontend/index.html")
        self.assertTrue(fe_path.exists())

        cfg_path = get_resource_path("config/config.json")
        self.assertTrue(cfg_path.exists())


if __name__ == "__main__":
    unittest.main()
