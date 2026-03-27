"""
StudyHub NCI Library
====================

Authentication, validation, scheduling, and formatting library
for cloud-based student collaboration platforms.

Author: Anjaneya Reddy
Version: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "Anjaneya Reddy"

from studyhub_lib.auth import AuthManager
from studyhub_lib.validator import InputValidator
from studyhub_lib.scheduler import DeadlineChecker
from studyhub_lib.formatter import TaskFormatter

__all__ = [
    "AuthManager",
    "InputValidator",
    "DeadlineChecker",
    "TaskFormatter",
]
