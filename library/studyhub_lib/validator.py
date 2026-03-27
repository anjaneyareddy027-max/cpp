"""
Input validation module for StudyHub.

Provides validation helpers for users, projects, tasks, and messages,
as well as basic HTML sanitization.
"""

import re

from studyhub_lib.auth import AuthManager


class InputValidator:
    """Validates and sanitizes user-supplied data."""

    # ------------------------------------------------------------------ #
    #  User validation
    # ------------------------------------------------------------------ #

    @staticmethod
    def validate_user(data: dict) -> tuple:
        """
        Validate user registration / update data.

        Checks:
            - username: required, 3-30 alphanumeric characters
            - email: required, must contain '@'
            - password: required, must pass strength check

        Args:
            data: Dictionary with keys username, email, password.

        Returns:
            Tuple of (is_valid: bool, errors: list[str]).
        """
        errors = []

        # Username
        username = data.get("username", "")
        if not username:
            errors.append("Username is required")
        elif len(username) < 3 or len(username) > 30:
            errors.append("Username must be between 3 and 30 characters")
        elif not username.isalnum():
            errors.append("Username must be alphanumeric")

        # Email
        email = data.get("email", "")
        if not email:
            errors.append("Email is required")
        elif "@" not in email:
            errors.append("Email must contain '@'")

        # Password
        password = data.get("password", "")
        if not password:
            errors.append("Password is required")
        else:
            pw_valid, pw_errors = AuthManager.validate_password_strength(password)
            if not pw_valid:
                errors.extend(pw_errors)

        return (len(errors) == 0, errors)

    # ------------------------------------------------------------------ #
    #  Project validation
    # ------------------------------------------------------------------ #

    @staticmethod
    def validate_project(data: dict) -> tuple:
        """
        Validate project creation / update data.

        Checks:
            - name: required, 3-100 characters
            - description: optional, max 500 characters

        Args:
            data: Dictionary with keys name, description.

        Returns:
            Tuple of (is_valid: bool, errors: list[str]).
        """
        errors = []

        name = data.get("name", "")
        if not name:
            errors.append("Project name is required")
        elif len(name) < 3 or len(name) > 100:
            errors.append("Project name must be between 3 and 100 characters")

        description = data.get("description", "")
        if description and len(description) > 500:
            errors.append("Description must not exceed 500 characters")

        return (len(errors) == 0, errors)

    # ------------------------------------------------------------------ #
    #  Task validation
    # ------------------------------------------------------------------ #

    VALID_STATUSES = ["todo", "in_progress", "done", "review"]
    VALID_PRIORITIES = ["low", "medium", "high", "urgent"]

    @staticmethod
    def validate_task(data: dict) -> tuple:
        """
        Validate task creation / update data.

        Checks:
            - title: required
            - status: must be one of todo, in_progress, done, review
            - priority: must be one of low, medium, high, urgent

        Args:
            data: Dictionary with keys title, status, priority.

        Returns:
            Tuple of (is_valid: bool, errors: list[str]).
        """
        errors = []

        title = data.get("title", "")
        if not title:
            errors.append("Task title is required")

        status = data.get("status", "")
        if status and status not in InputValidator.VALID_STATUSES:
            errors.append(
                f"Status must be one of: {', '.join(InputValidator.VALID_STATUSES)}"
            )

        priority = data.get("priority", "")
        if priority and priority not in InputValidator.VALID_PRIORITIES:
            errors.append(
                f"Priority must be one of: {', '.join(InputValidator.VALID_PRIORITIES)}"
            )

        return (len(errors) == 0, errors)

    # ------------------------------------------------------------------ #
    #  Message validation
    # ------------------------------------------------------------------ #

    @staticmethod
    def validate_message(data: dict) -> tuple:
        """
        Validate chat / comment message data.

        Checks:
            - content: required, max 2000 characters

        Args:
            data: Dictionary with key content.

        Returns:
            Tuple of (is_valid: bool, errors: list[str]).
        """
        errors = []

        content = data.get("content", "")
        if not content:
            errors.append("Message content is required")
        elif len(content) > 2000:
            errors.append("Message must not exceed 2000 characters")

        return (len(errors) == 0, errors)

    # ------------------------------------------------------------------ #
    #  Sanitization
    # ------------------------------------------------------------------ #

    @staticmethod
    def sanitize_input(text: str) -> str:
        """
        Strip HTML tags from the input string.

        Args:
            text: Raw input string potentially containing HTML.

        Returns:
            The string with all HTML tags removed.
        """
        return re.sub(r"<[^>]+>", "", text)
