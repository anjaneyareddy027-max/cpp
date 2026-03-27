"""
Formatting module for StudyHub.

Provides helpers to render tasks, projects, deadlines, and activity
feeds into human-readable text and CSV.
"""

import csv
import io


class TaskFormatter:
    """Formats tasks, projects, and activity data for display or export."""

    # ------------------------------------------------------------------ #
    #  Single task
    # ------------------------------------------------------------------ #

    @staticmethod
    def format_task_summary(task: dict) -> str:
        """
        Return a one-line summary of a task.

        Args:
            task: Task dict with title, status, priority, deadline.

        Returns:
            Formatted summary string.
        """
        title = task.get("title", "Untitled")
        status = task.get("status", "N/A")
        priority = task.get("priority", "N/A")
        deadline = task.get("deadline", "No deadline")

        return (
            f"Task: {title} | Status: {status} | "
            f"Priority: {priority} | Due: {deadline}"
        )

    # ------------------------------------------------------------------ #
    #  Project report
    # ------------------------------------------------------------------ #

    @staticmethod
    def format_project_report(project: dict, tasks: list) -> str:
        """
        Generate a multi-line text report for a project.

        Args:
            project: Dict with at least 'name' and 'members' (list).
            tasks: List of task dicts belonging to the project.

        Returns:
            Multi-line report string.
        """
        name = project.get("name", "Unnamed Project")
        members = project.get("members", [])
        total = len(tasks)

        # Count tasks by status
        by_status = {}
        for task in tasks:
            status = task.get("status", "unknown")
            by_status[status] = by_status.get(status, 0) + 1

        completed = by_status.get("done", 0)
        percentage = round((completed / total) * 100, 1) if total > 0 else 0.0

        lines = [
            f"=== Project Report: {name} ===",
            f"Members: {len(members)}",
            f"Total Tasks: {total}",
            f"Completed: {completed} ({percentage}%)",
            "",
            "Task Breakdown by Status:",
        ]

        for status, count in sorted(by_status.items()):
            lines.append(f"  - {status}: {count}")

        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    #  Deadline alerts
    # ------------------------------------------------------------------ #

    @staticmethod
    def format_deadline_alert(tasks: list) -> str:
        """
        Format an alert message listing tasks with approaching deadlines.

        Args:
            tasks: List of task dicts that are approaching their deadline.

        Returns:
            Formatted alert string.
        """
        if not tasks:
            return "No upcoming deadlines."

        lines = [f"DEADLINE ALERT: {len(tasks)} task(s) approaching deadline!", ""]

        for i, task in enumerate(tasks, start=1):
            title = task.get("title", "Untitled")
            deadline = task.get("deadline", "N/A")
            assigned = task.get("assignedTo", "Unassigned")
            lines.append(f"  {i}. {title} — Due: {deadline} (Assigned: {assigned})")

        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    #  CSV export
    # ------------------------------------------------------------------ #

    @staticmethod
    def to_csv(tasks: list) -> str:
        """
        Export tasks to a CSV-formatted string.

        Headers: title, status, priority, deadline, assignedTo

        Args:
            tasks: List of task dicts.

        Returns:
            CSV string including header row.
        """
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["title", "status", "priority", "deadline", "assignedTo"])

        for task in tasks:
            writer.writerow([
                task.get("title", ""),
                task.get("status", ""),
                task.get("priority", ""),
                task.get("deadline", ""),
                task.get("assignedTo", ""),
            ])

        return output.getvalue()

    # ------------------------------------------------------------------ #
    #  Activity feed
    # ------------------------------------------------------------------ #

    @staticmethod
    def format_activity_feed(messages: list, limit: int = 10) -> str:
        """
        Format recent activity/messages into a readable feed.

        Args:
            messages: List of message dicts with 'username', 'content',
                      and optional 'timestamp'.
            limit: Maximum number of entries to display.

        Returns:
            Formatted activity feed string.
        """
        if not messages:
            return "No recent activity."

        recent = messages[:limit]
        lines = [f"=== Recent Activity ({len(recent)} items) ===", ""]

        for msg in recent:
            user = msg.get("username", "Unknown")
            content = msg.get("content", "")
            timestamp = msg.get("timestamp", "")
            ts_part = f" [{timestamp}]" if timestamp else ""
            lines.append(f"  {user}{ts_part}: {content}")

        return "\n".join(lines)
