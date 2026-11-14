"""Exercise the real CI handoff against temporary Git repositories."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "ci/data_handoff.py"
RECIPE = "src/data/recipes/0123456789abcdef01234567.json"


class DataHandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "CI test")
        self.git("config", "user.email", "ci@example.invalid")
        self.write("src/data/menu-weeks.json", '{"weeks": []}\n')
        self.git("add", ".")
        self.git("commit", "-qm", "baseline")
        self.sha = self.git("rev-parse", "HEAD").stdout.strip()
        self.packet = self.root / "handoff.json"
        self.output = self.root / "output"

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.repo, text=True, capture_output=True, check=True)

    def write(self, path, content):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)

    def run_helper(self, mode, event="schedule", success=True):
        result = subprocess.run(
            ["python3", str(SCRIPT), mode, str(self.packet)], cwd=self.repo,
            env={**os.environ, "GITHUB_EVENT_NAME": event, "GITHUB_OUTPUT": str(self.output)},
            text=True, capture_output=True,
        )
        self.assertEqual(result.returncode == 0, success, result.stderr)
        return result

    def make_packet(self, files, **overrides):
        self.packet.write_text(json.dumps({"version": 1, "base_sha": self.sha, "files": files, **overrides}))

    def test_scheduled_no_change_skips_deploy(self):
        self.run_helper("package")
        self.assertEqual(self.output.read_text(), "changed=false\nshould_deploy=false\n")

    def test_push_without_data_changes_still_deploys(self):
        self.run_helper("package", event="push")
        self.assertIn("should_deploy=true", self.output.read_text())

    def test_manual_run_without_data_changes_still_deploys(self):
        self.run_helper("package", event="workflow_dispatch")
        self.assertIn("should_deploy=true", self.output.read_text())

    def test_round_trip_includes_new_recipes_and_modified_weeks(self):
        self.write("src/data/menu-weeks.json", '{"weeks": ["2026-W47"]}\n')
        self.write(RECIPE, '{"name": "Küche", "servings": 2}\n')
        self.run_helper("package")
        self.assertIn("changed=true\nshould_deploy=true", self.output.read_text())
        self.git("reset", "--hard", "HEAD")
        self.git("clean", "-fd")
        self.run_helper("apply")
        paths = self.git("diff", "--cached", "--name-only").stdout.splitlines()
        self.assertEqual(set(paths), {RECIPE, "src/data/menu-weeks.json"})
        self.assertEqual(json.loads((self.repo / RECIPE).read_text())["name"], "Küche")

    def test_package_rejects_deleted_data(self):
        (self.repo / "src/data/menu-weeks.json").unlink()
        self.run_helper("package", success=False)

    def test_package_rejects_non_json(self):
        self.write(RECIPE, "not json")
        self.run_helper("package", success=False)

    def test_package_rejects_code_inside_data_directory(self):
        self.write("src/data/setup.sh", "echo unsafe")
        self.run_helper("package", success=False)

    def test_apply_rejects_other_source_commit(self):
        self.make_packet([{"path": RECIPE, "content": "{}"}], base_sha="0" * 40)
        self.run_helper("apply", success=False)

    def test_apply_validates_all_entries_before_writing(self):
        for path in ("../outside.json", ".github/workflows/inject.yml", "src/data/../app.json", "src/data/recipes/not-an-id.json"):
            with self.subTest(path=path):
                self.make_packet([{"path": RECIPE, "content": "{}"}, {"path": path, "content": "{}"}])
                self.run_helper("apply", success=False)
                self.assertFalse((self.repo / RECIPE).exists())
                self.assertEqual(self.git("status", "--porcelain").stdout, "")

    def test_apply_rejects_invalid_json_before_writing(self):
        self.make_packet([{"path": RECIPE, "content": "{}"}, {"path": "src/data/menu-weeks.json", "content": "invalid"}])
        self.run_helper("apply", success=False)
        self.assertFalse((self.repo / RECIPE).exists())

    def test_apply_rejects_duplicate_paths(self):
        self.make_packet([{"path": RECIPE, "content": "{}"}] * 2)
        self.run_helper("apply", success=False)

    def test_package_rejects_symlink(self):
        outside = self.root / "outside.json"
        outside.write_text('{}')
        (self.repo / "src/data/recipes").mkdir()
        (self.repo / RECIPE).symlink_to(outside)
        self.run_helper("package", success=False)

    def test_apply_rejects_tracked_symlink_parent(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.repo / "src/data/recipes").symlink_to(outside)
        self.git("add", ".")
        self.git("commit", "-qm", "symlink fixture")
        self.sha = self.git("rev-parse", "HEAD").stdout.strip()
        self.make_packet([{"path": RECIPE, "content": "{}"}])
        self.run_helper("apply", success=False)
        self.assertEqual(list(outside.iterdir()), [])

    def test_apply_rejects_dirty_writer(self):
        self.write("unexpected.txt", "content")
        self.make_packet([{"path": RECIPE, "content": "{}"}])
        self.run_helper("apply", success=False)

    def test_apply_rejects_oversized_handoff(self):
        with self.packet.open("wb") as packet:
            packet.truncate(32 * 1024 * 1024 + 1)
        self.run_helper("apply", success=False)


if __name__ == "__main__":
    unittest.main()
