#!/usr/bin/env python3
"""Validate an untrusted CI archive before extracting it as root."""
import sys
import tarfile


def validate(archive_path):
    allowed_exact = {"package.json", "package-lock.json", "config/categories.txt"}
    seen = set()
    try:
        with tarfile.open(archive_path, "r:*") as archive:
            for member in archive.getmembers():
                name = member.name
                parts = name.rstrip("/").split("/")
                if name.startswith("/") or "\\" in name or any(part in ("", ".", "..") for part in parts):
                    raise ValueError("Invalid archive path")
                if not member.isfile():
                    raise ValueError("Archive may contain regular files only")
                if name in seen:
                    raise ValueError("Duplicate archive member")
                seen.add(name)
                if any(part.lower() in {"data", ".env", ".ssh"} for part in parts):
                    raise ValueError("Archive contains a forbidden private-data path")
                if not (name in allowed_exact or name.startswith("dist/") or name.startswith("site-dist/")):
                    raise ValueError("Unexpected archive member: " + name)
    except (tarfile.TarError, OSError) as error:
        raise ValueError("Invalid release archive") from error
    required = allowed_exact
    if not required <= seen or not any(name.startswith("dist/") for name in seen) or not any(name.startswith("site-dist/") for name in seen):
        raise ValueError("Archive is missing required application files")


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Usage: validate-release.py ARCHIVE")
        validate(sys.argv[1])
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
