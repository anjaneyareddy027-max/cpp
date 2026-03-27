"""
Deadline and scheduling module for StudyHub.

Provides utilities for checking deadlines, identifying overdue tasks,
generating reminders, and prioritising task lists.
"""

from datetime import datetime, timezone


class DeadlineChecker:
    """Manages deadline-related operations for tasks."""

    # Priority ordering (lower number = higher urgency)
    PRIORITY_ORDER = {"urgent": 0, "high": 1, "medium": 2, "low": 3}

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _parse_deadline(deadline_str: str) -> datetime:
        """
        Parse an ISO-format deadline string into a timezone-aware datetime.

        Supports strings with or without timezone info; naive datetimes
        are assumed to be UTC.
        """
        try:
            dt = datetime.fromisoformat(deadline_str)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid deadline format: {deadline_str}")

        # Ensure timezone-aware (assume UTC if naive)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    # ------------------------------------------------------------------ #
    #  Deadline checks
    # ------------------------------------------------------------------ #

    @staticmethod
    def check_deadlines(tasks: list, hours_threshold: int = 24) -> list:
        """
        Return tasks whose deadline falls within *hours_threshold* hours
        from now (but are not yet overdue).

        Args:
            tasks: List of task dicts (must contain 'deadline' key).
            hours_threshold: Number of hours to look ahead.

        Returns:
            List of tasks approaching their deadline.
        """
        now = datetime.now(timezone.utc)
        approaching = []

        for task in tasks:
            deadline_str = task.get("deadline")
            if not deadline_str:
                continue
            deadline = DeadlineChecker._parse_deadline(deadline_str)
            diff_hours = (deadline - now).total_seconds() / 3600

            if 0 < diff_hours <= hours_threshold:
                approaching.append(task)

        return approaching

    @staticmethod
    def get_overdue_tasks(tasks: list) -> list:
        """
        Return tasks that are past their deadline.

        Args:
            tasks: List of task dicts.

        Returns:
            List of overdue tasks.
        """
        now = datetime.now(timezone.utc)
        overdue = []

        for task in tasks:
            deadline_str = task.get("deadline")
            if not deadline_str:
                continue
            deadline = DeadlineChecker._parse_deadline(deadline_str)
            if deadline < now:
                overdue.append(task)

        return overdue

    # ------------------------------------------------------------------ #
    #  Reminders
    # ------------------------------------------------------------------ #

    @staticmethod
    def generate_reminder(task: dict) -> str:
        """
        Generate a human-readable reminder string for a task.

        Args:
            task: Task dict with title, deadline, and assignedTo.

        Returns:
            Formatted reminder string.
        """
        title = task.get("title", "Untitled")
        deadline = task.get("deadline", "No deadline")
        assigned = task.get("assignedTo", "Unassigned")

        return (
            f"REMINDER: '{title}' is due on {deadline}. "
            f"Assigned to: {assigned}. Please take action."
        )

    # ------------------------------------------------------------------ #
    #  Prioritisation
    # ------------------------------------------------------------------ #

    @staticmethod
    def prioritize_tasks(tasks: list) -> list:
        """
        Sort tasks by urgency.

        Ordering rules (highest priority first):
            1. Overdue tasks come first.
            2. Then by priority level (urgent > high > medium > low).
            3. Then by deadline (earliest first).

        Args:
            tasks: List of task dicts.

        Returns:
            New list sorted by urgency.
        """
        now = datetime.now(timezone.utc)

        def sort_key(task):
            deadline_str = task.get("deadline")
            if deadline_str:
                deadline = DeadlineChecker._parse_deadline(deadline_str)
            else:
                # Tasks without a deadline go to the end
                deadline = datetime.max.replace(tzinfo=timezone.utc)

            is_overdue = 0 if deadline < now else 1
            priority_rank = DeadlineChecker.PRIORITY_ORDER.get(
                task.get("priority", "low"), 3
            )
            return (is_overdue, priority_rank, deadline)

        return sorted(tasks, key=sort_key)

    # ------------------------------------------------------------------ #
    #  Progress
    # ------------------------------------------------------------------ #

    @staticmethod
    def calculate_project_progress(tasks: list) -> dict:
        """
        Calculate overall project progress from a task list.

        Args:
            tasks: List of task dicts.

        Returns:
            Dict with total, completed, percentage, and by_status counts.
        """
        total = len(tasks)
        by_status = {}

        for task in tasks:
            status = task.get("status", "unknown")
            by_status[status] = by_status.get(status, 0) + 1

        completed = by_status.get("done", 0)
        percentage = round((completed / total) * 100, 1) if total > 0 else 0.0

        return {
            "total": total,
            "completed": completed,
            "percentage": percentage,
            "by_status": by_status,
        }
