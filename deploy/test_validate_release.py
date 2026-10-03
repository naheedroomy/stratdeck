import io
import os
import tarfile
import tempfile
import unittest
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_release import validate


class ReleaseArchiveTests(unittest.TestCase):
    def make_archive(self, members):
        temp = tempfile.NamedTemporaryFile(delete=False)
        temp.close()
        with tarfile.open(temp.name, "w") as archive:
            for name, kind in members:
                info = tarfile.TarInfo(name)
                if kind == "symlink":
                    info.type = tarfile.SYMTYPE
                    info.linkname = "../../etc/passwd"
                    archive.addfile(info)
                else:
                    data = b"fixture"
                    info.size = len(data)
                    archive.addfile(info, io.BytesIO(data))
        return temp.name

    def test_accepts_release_artifact_members(self):
        path = self.make_archive([
            ("package.json", "file"),
            ("package-lock.json", "file"),
            ("config/categories.txt", "file"),
            ("dist/src/server.js", "file"),
            ("site-dist/index.html", "file"),
        ])
        try:
            validate(path)
        finally:
            os.unlink(path)

    def test_rejects_traversal_private_extra_root_and_symlinks(self):
        required = [("package.json", "file"), ("package-lock.json", "file"), ("config/categories.txt", "file"), ("dist/src/server.js", "file"), ("site-dist/index.html", "file")]
        for malicious in [("dist/../../etc/passwd", "file"), ("data/password.json", "file"), ("extra/payload", "file"), ("dist/.env", "file"), ("dist/link", "symlink")]:
            path = self.make_archive(required + [malicious])
            try:
                with self.assertRaises(ValueError):
                    validate(path)
            finally:
                os.unlink(path)


if __name__ == "__main__":
    unittest.main()
