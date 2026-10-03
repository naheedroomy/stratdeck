#!/usr/bin/python3
"""Install a GitHub-provided hash record; never accept or print plaintext passwords."""
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile

ROOT = Path('/opt/stratdeck')


def validate(record):
    if not isinstance(record, dict) or set(record) != {'version', 'salt', 'hash'}:
        raise ValueError('Invalid password record')
    if type(record['version']) is not int or not 1 <= record['version'] < 2**53:
        raise ValueError('Invalid password version')
    for key, size in [('salt', 32), ('hash', 128)]:
        if not isinstance(record[key], str) or not re.fullmatch('[a-f0-9]{' + str(size) + '}', record[key]):
            raise ValueError('Invalid password record')
    return record


def select_record(incoming, current):
    validate(incoming)
    if current is None:
        return incoming
    validate(current)
    if incoming['salt'] == current['salt'] and incoming['hash'] == current['hash']:
        return current  # Repeated deployments must not invalidate sessions.
    return validate({**incoming, 'version': current['version'] + 1})


def main():
    if os.geteuid() != 0 or len(sys.argv) != 1:
        raise ValueError('Root and no arguments required')
    os.umask(0o077)
    with open('/run/lock/stratdeck-deploy.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        upload = ROOT / 'incoming/password.json'
        fd = os.open(upload, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, 'rb') as source:
            info = os.fstat(source.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_size > 4096:
                raise ValueError('Invalid password upload')
            raw = source.read(4097)
            if len(raw) > 4096:
                raise ValueError('Invalid password upload')
        incoming = validate(json.loads(raw))
        target = ROOT / 'shared/data/password.json'
        current = validate(json.loads(target.read_text())) if target.exists() else None
        record = select_record(incoming, current)
        fd, temporary = tempfile.mkstemp(prefix='.password-', dir=target.parent)
        try:
            with os.fdopen(fd, 'w') as output:
                json.dump(record, output)
                output.flush()
                os.fsync(output.fileno())
                os.fchown(output.fileno(), 0, 1000)
                os.fchmod(output.fileno(), 0o640)
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        upload.unlink(missing_ok=True)
        print('Password record installed securely.')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Never expose input JSON, password hashes, or decoder diagnostics.
        print('Password record installation failed.', file=sys.stderr)
        sys.exit(1)
