"""Transfer validated menu JSON between the read-only build and the writer job.

The writer checks out the original source commit and executes this trusted copy.
It never runs a script, package manager or shell command from the build artifact.
"""

import argparse
import json
import os
from pathlib import Path
import re
import stat
import subprocess


ALLOWED_PATH = re.compile(
    r"src/data/(?:menu-snapshot\.json|menu-weeks\.json|recipe-details-index\.json|recipes/[0-9a-f]{24}\.json)"
)
MAX_PACKET_BYTES = 32 * 1024 * 1024


def git(*args):
    return subprocess.check_output(["git", *args])


def validate_file(path, content):
    if not isinstance(path, str) or not ALLOWED_PATH.fullmatch(path):
        raise ValueError("Only the existing menu JSON paths and recipe JSON are allowed")
    if not isinstance(content, str):
        raise ValueError("JSON content must be UTF-8 text")
    json.loads(content)
    target = Path(path)
    for part in (target, *target.parents):
        if part.is_symlink():
            raise ValueError("Symbolic links are not allowed")
    if target.exists() and not stat.S_ISREG(target.stat().st_mode):
        raise ValueError("Data targets must be regular files")
    return target


def package(output):
    changed = set(filter(None, git("diff", "--name-only", "-z", "HEAD", "--", "src/data").decode().split("\0")))
    changed.update(filter(None, git("ls-files", "--others", "--exclude-standard", "-z", "--", "src/data").decode().split("\0")))
    files = []
    for path in sorted(changed):
        target = validate_file(path, "null")
        # Deletions must be investigated; never remove stored recipes or weeks.
        content = target.read_text(encoding="utf-8")
        validate_file(path, content)
        files.append({"path": path, "content": content})
    packet = {"version": 1, "base_sha": git("rev-parse", "HEAD").decode().strip(), "files": files}
    raw = json.dumps(packet, ensure_ascii=False).encode("utf-8")
    if len(raw) > MAX_PACKET_BYTES:
        raise ValueError("Data handoff exceeds the size limit; review before raising it")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(raw)
    changed_value = bool(files)
    deploy = changed_value or os.environ.get("GITHUB_EVENT_NAME") != "schedule"
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as handle:
        handle.write(f"changed={str(changed_value).lower()}\nshould_deploy={str(deploy).lower()}\n")


def apply(packet_path):
    if packet_path.stat().st_size > MAX_PACKET_BYTES:
        raise ValueError("Data handoff exceeds the size limit")
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    if not isinstance(packet, dict) or set(packet) != {"version", "base_sha", "files"}:
        raise ValueError("Unexpected data handoff format")
    if packet["version"] != 1 or packet["base_sha"] != git("rev-parse", "HEAD").decode().strip():
        raise ValueError("Data handoff belongs to a different source commit")
    if not isinstance(packet["files"], list) or not packet["files"]:
        raise ValueError("Data handoff must contain changed JSON files")
    if git("status", "--porcelain", "--untracked-files=all"):
        raise ValueError("Writer checkout must be clean")
    validated = []
    seen = set()
    for item in packet["files"]:
        if not isinstance(item, dict) or set(item) != {"path", "content"}:
            raise ValueError("Unexpected file entry")
        path, content = item["path"], item["content"]
        target = validate_file(path, content)
        if path in seen:
            raise ValueError("Duplicate data path")
        seen.add(path)
        validated.append((target, content))
    # Validate the entire packet before touching any file.
    for target, content in validated:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        target.chmod(0o644)
    subprocess.run(["git", "add", "--", *sorted(seen)], check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("package", "apply"))
    parser.add_argument("packet", type=Path)
    args = parser.parse_args()
    if args.mode == "package":
        package(args.packet)
    else:
        apply(args.packet)
