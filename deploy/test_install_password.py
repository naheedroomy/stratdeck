import unittest
from install_password import validate, select_record


def record(version=1, salt='a', digest='b'):
    return {'version': version, 'salt': salt * 32, 'hash': digest * 128}


class PasswordRecordTests(unittest.TestCase):
    def test_initial_record_is_preserved(self):
        self.assertEqual(select_record(record(), None), record())

    def test_unchanged_hash_preserves_session_version(self):
        self.assertEqual(select_record(record(1), record(8)), record(8))

    def test_changed_hash_increments_current_version(self):
        self.assertEqual(select_record(record(99, 'c', 'd'), record(8)), record(9, 'c', 'd'))

    def test_rejects_malformed_and_extra_fields(self):
        for value in [None, {}, {**record(), 'version': True}, {**record(), 'version': 0},
                      {**record(), 'hash': 'invalid'}, {**record(), 'salt': 42},
                      {**record(), 'plaintext': 'never accepted'}]:
            with self.subTest(value_type=type(value).__name__), self.assertRaises(ValueError):
                validate(value)

    def test_rejects_version_overflow(self):
        with self.assertRaises(ValueError):
            select_record(record(1, 'c', 'd'), record(2**53 - 1))


if __name__ == '__main__':
    unittest.main()
