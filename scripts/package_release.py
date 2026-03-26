from __future__ import annotations

import json
import shutil
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RELEASE_DIR = ROOT / "release"

REQUIRED_PATHS = [
    ROOT / "dist" / "index.js",
    ROOT / "package.json",
    ROOT / "plugin.json",
    ROOT / "main.py",
]

OPTIONAL_PATHS = [
    ROOT / "README.md",
    ROOT / "LICENSE",
    ROOT / "dist" / "index.js.map",
    ROOT / "bin",
]


def main() -> int:
    package_json = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    plugin_slug = package_json["name"]
    version = package_json["version"]

    missing = [path for path in REQUIRED_PATHS if not path.exists()]
    if missing:
        formatted = ", ".join(str(path.relative_to(ROOT)) for path in missing)
        raise SystemExit(f"Missing files for release packaging: {formatted}")

    staging_root = RELEASE_DIR / plugin_slug
    archive_path = RELEASE_DIR / f"{plugin_slug}-v{version}.zip"

    if RELEASE_DIR.exists():
        shutil.rmtree(RELEASE_DIR)
    staging_root.mkdir(parents=True, exist_ok=True)

    for path in REQUIRED_PATHS + OPTIONAL_PATHS:
        if not path.exists():
            continue

        destination = staging_root / path.relative_to(ROOT)
        if path.is_dir():
            shutil.copytree(path, destination)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)

    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(staging_root.rglob("*")):
            if file_path.is_dir():
                continue
            archive.write(file_path, arcname=str(file_path.relative_to(RELEASE_DIR)))

    print(f"Created {archive_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
