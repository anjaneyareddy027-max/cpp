"""
Unit tests for the studyhub_lib library.

Covers auth, validation, scheduling, and formatting modules.
Run with: python -m pytest tests/ -v
"""

import sys
import os
import time
import unittest
from datetime import datetime, timezone, timedelta

# Ensure the library is importable from the project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from studyhub_lib.auth import AuthManager
from studyhub_lib.validator import InputValidator
from studyhub_lib.scheduler import DeadlineChecker
from studyhub_lib.formatter import TaskFormatter


# ===================================================================== #
#  Auth tests
# ===================================================================== #

class TestAuthManager(unittest.TestCase):
    """Tests for AuthManager."""

    def test_hash_password_returns_hex_strings(self):
        hashed, salt = AuthManager.hash_password("MyP@ss1")
        self.assertIsInstance(hashed, str)
        self.assertIsInstance(salt, str)
        # Both should be valid hex
        int(hashed, 16)
        int(salt, 16)

    def test_hash_password_roundtrip(self):
        password = "SecurePass1"
        hashed, salt = AuthManager.hash_password(password)
        self.assertTrue(AuthManager.verify_password(password, hashed, salt))

    def test_verify_password_wrong(self):
        hashed, salt = AuthManager.hash_password("CorrectPass1")
        self.assertFalse(AuthManager.verify_password("WrongPass1", hashed, salt))

    def test_hash_with_explicit_salt(self):
        salt = os.urandom(32)
        h1, s1 = AuthManager.hash_password("Test1234", salt)
        h2, s2 = AuthManager.hash_password("Test1234", salt)
        self.assertEqual(h1, h2)
        self.assertEqual(s1, s2)

    def test_generate_and_decode_token(self):
        secret = "test-secret-key"
        token = AuthManager.generate_token("u123", "alice", secret, expires_hours=1)
        payload = AuthManager.decode_token(token, secret)
        self.assertEqual(payload["userId"], "u123")
        self.assertEqual(payload["username"], "alice")
        self.assertIn("exp", payload)
        self.assertIn("iat", payload)

    def test_decode_token_invalid_signature(self):
        token = AuthManager.generate_token("u1", "bob", "key1")
        with self.assertRaises(ValueError):
            AuthManager.decode_token(token, "wrong-key")

    def test_decode_token_expired(self):
        secret = "s"
        token = AuthManager.generate_token("u1", "bob", secret, expires_hours=0)
        # Token with 0-hour expiry is effectively already expired after a moment
        time.sleep(0.1)
        with self.assertRaises(ValueError):
            AuthManager.decode_token(token, secret)

    def test_decode_token_malformed(self):
        with self.assertRaises(ValueError):
            AuthManager.decode_token("not.a.valid.token.at.all", "key")

    def test_password_strength_strong(self):
        valid, errors = AuthManager.validate_password_strength("Strong1Pass")
        self.assertTrue(valid)
        self.assertEqual(errors, [])

    def test_password_strength_weak(self):
        valid, errors = AuthManager.validate_password_strength("weak")
        self.assertFalse(valid)
        self.assertTrue(len(errors) >= 2)  # too short + missing uppercase/digit


# ===================================================================== #
#  Validator tests
# ===================================================================== #

class TestInputValidator(unittest.TestCase):
    """Tests for InputValidator."""

    def test_validate_user_valid(self):
        data = {"username": "alice01", "email": "a@b.com", "password": "Passw0rd"}
        valid, errors = InputValidator.validate_user(data)
        self.assertTrue(valid)

    def test_validate_user_missing_fields(self):
        valid, errors = InputValidator.validate_user({})
        self.assertFalse(valid)
        self.assertTrue(len(errors) >= 3)

    def test_validate_user_bad_email(self):
        data = {"username": "alice", "email": "nope", "password": "Passw0rd"}
        valid, errors = InputValidator.validate_user(data)
        self.assertFalse(valid)
        self.assertIn("Email must contain '@'", errors)

    def test_validate_user_short_username(self):
        data = {"username": "ab", "email": "a@b.com", "password": "Passw0rd"}
        valid, errors = InputValidator.validate_user(data)
        self.assertFalse(valid)

    def test_validate_project_valid(self):
        data = {"name": "My Project", "description": "A short desc."}
        valid, errors = InputValidator.validate_project(data)
        self.assertTrue(valid)

    def test_validate_project_no_name(self):
        valid, errors = InputValidator.validate_project({"description": "x"})
        self.assertFalse(valid)

    def test_validate_project_long_description(self):
        data = {"name": "Proj", "description": "x" * 501}
        valid, errors = InputValidator.validate_project(data)
        self.assertFalse(valid)

    def test_validate_task_valid(self):
        data = {"title": "Fix bug", "status": "todo", "priority": "high"}
        valid, errors = InputValidator.validate_task(data)
        self.assertTrue(valid)

    def test_validate_task_invalid_status(self):
        data = {"title": "X", "status": "blocked"}
        valid, errors = InputValidator.validate_task(data)
        self.assertFalse(valid)

    def test_validate_task_invalid_priority(self):
        data = {"title": "X", "priority": "critical"}
        valid, errors = InputValidator.validate_task(data)
        self.assertFalse(valid)

    def test_validate_message_valid(self):
        valid, errors = InputValidator.validate_message({"content": "Hello!"})
        self.assertTrue(valid)

    def test_validate_message_empty(self):
        valid, errors = InputValidator.validate_message({"content": ""})
        self.assertFalse(valid)

    def test_validate_message_too_long(self):
        valid, errors = InputValidator.validate_message({"content": "a" * 2001})
        self.assertFalse(valid)

    def test_sanitize_input_strips_html(self):
        raw = '<script>alert("xss")</script>Hello <b>World</b>'
        clean = InputValidator.sanitize_input(raw)
        self.assertEqual(clean, 'alert("xss")Hello World')


# ===================================================================== #
#  Scheduler tests
# ===================================================================== #

class TestDeadlineChecker(unittest.TestCase):
    """Tests for DeadlineChecker."""

    def _make_task(self, title, hours_from_now, status="todo", priority="medium"):
        """Helper: create a task with a deadline relative to now."""
        deadline = datetime.now(timezone.utc) + timedelta(hours=hours_from_now)
        return {
            "title": title,
            "deadline": deadline.isoformat(),
            "status": status,
            "priority": priority,
            "assignedTo": "tester",
        }

    def test_check_deadlines_approaching(self):
        tasks = [
            self._make_task("Soon", 5),
            self._make_task("Later", 48),
            self._make_task("Overdue", -2),
        ]
        result = DeadlineChecker.check_deadlines(tasks, hours_threshold=24)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["title"], "Soon")

    def test_get_overdue_tasks(self):
        tasks = [
            self._make_task("Past", -10),
            self._make_task("Future", 10),
        ]
        overdue = DeadlineChecker.get_overdue_tasks(tasks)
        self.assertEqual(len(overdue), 1)
        self.assertEqual(overdue[0]["title"], "Past")

    def test_generate_reminder(self):
        task = {"title": "Write report", "deadline": "2026-04-01", "assignedTo": "Anji"}
        reminder = DeadlineChecker.generate_reminder(task)
        self.assertIn("Write report", reminder)
        self.assertIn("Anji", reminder)

    def test_prioritize_tasks_order(self):
        tasks = [
            self._make_task("Low future", 48, priority="low"),
            self._make_task("Urgent future", 12, priority="urgent"),
            self._make_task("High overdue", -5, priority="high"),
        ]
        ordered = DeadlineChecker.prioritize_tasks(tasks)
        # Overdue first, then urgent, then low
        self.assertEqual(ordered[0]["title"], "High overdue")
        self.assertEqual(ordered[1]["title"], "Urgent future")
        self.assertEqual(ordered[2]["title"], "Low future")

    def test_calculate_project_progress(self):
        tasks = [
            {"status": "done"},
            {"status": "done"},
            {"status": "todo"},
            {"status": "in_progress"},
        ]
        progress = DeadlineChecker.calculate_project_progress(tasks)
        self.assertEqual(progress["total"], 4)
        self.assertEqual(progress["completed"], 2)
        self.assertEqual(progress["percentage"], 50.0)
        self.assertEqual(progress["by_status"]["done"], 2)

    def test_calculate_project_progress_empty(self):
        progress = DeadlineChecker.calculate_project_progress([])
        self.assertEqual(progress["total"], 0)
        self.assertEqual(progress["percentage"], 0.0)


# ===================================================================== #
#  Formatter tests
# ===================================================================== #

class TestTaskFormatter(unittest.TestCase):
    """Tests for TaskFormatter."""

    SAMPLE_TASK = {
        "title": "Deploy API",
        "status": "in_progress",
        "priority": "high",
        "deadline": "2026-04-10",
        "assignedTo": "Anji",
    }

    def test_format_task_summary(self):
        summary = TaskFormatter.format_task_summary(self.SAMPLE_TASK)
        self.assertIn("Deploy API", summary)
        self.assertIn("in_progress", summary)
        self.assertIn("high", summary)

    def test_format_project_report(self):
        project = {"name": "StudyHub", "members": ["A", "B", "C"]}
        tasks = [
            {"status": "done"},
            {"status": "todo"},
            {"status": "todo"},
        ]
        report = TaskFormatter.format_project_report(project, tasks)
        self.assertIn("StudyHub", report)
        self.assertIn("Members: 3", report)
        self.assertIn("Total Tasks: 3", report)

    def test_format_deadline_alert_empty(self):
        result = TaskFormatter.format_deadline_alert([])
        self.assertEqual(result, "No upcoming deadlines.")

    def test_format_deadline_alert_with_tasks(self):
        tasks = [self.SAMPLE_TASK]
        alert = TaskFormatter.format_deadline_alert(tasks)
        self.assertIn("DEADLINE ALERT", alert)
        self.assertIn("Deploy API", alert)

    def test_to_csv(self):
        tasks = [self.SAMPLE_TASK]
        csv_str = TaskFormatter.to_csv(tasks)
        lines = csv_str.strip().split("\n")
        self.assertEqual(len(lines), 2)  # header + 1 row
        self.assertTrue(lines[0].startswith("title,"))
        self.assertIn("Deploy API", lines[1])

    def test_format_activity_feed(self):
        messages = [
            {"username": "alice", "content": "Updated the README", "timestamp": "10:00"},
            {"username": "bob", "content": "Fixed login bug"},
        ]
        feed = TaskFormatter.format_activity_feed(messages, limit=5)
        self.assertIn("alice", feed)
        self.assertIn("bob", feed)
        self.assertIn("10:00", feed)

    def test_format_activity_feed_empty(self):
        result = TaskFormatter.format_activity_feed([])
        self.assertEqual(result, "No recent activity.")


if __name__ == "__main__":
    unittest.main()
