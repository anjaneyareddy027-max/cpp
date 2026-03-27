# StudyHub NCI Library

Authentication, validation, scheduling, and formatting library for cloud-based student collaboration platforms.

## Installation

```bash
pip install studyhub-nci
```

## Modules

- **AuthManager** — Password hashing (PBKDF2-SHA256), JWT-like token generation, password strength validation
- **InputValidator** — User, project, task, and message validation with HTML sanitization
- **DeadlineChecker** — Deadline monitoring, overdue detection, task prioritization, progress tracking
- **TaskFormatter** — Task summaries, project reports, deadline alerts, CSV export, activity feeds

## Quick Start

```python
from studyhub_lib import AuthManager, InputValidator, DeadlineChecker, TaskFormatter

# Hash a password
hashed, salt = AuthManager.hash_password("SecurePass1")

# Validate user input
valid, errors = InputValidator.validate_user({
    "username": "alice",
    "email": "alice@example.com",
    "password": "SecurePass1"
})

# Check deadlines
approaching = DeadlineChecker.check_deadlines(tasks, hours_threshold=24)

# Format output
summary = TaskFormatter.format_task_summary(task)
```

## Requirements

- Python 3.8+
- No external dependencies (stdlib only)

## Author

Anjaneya Reddy
