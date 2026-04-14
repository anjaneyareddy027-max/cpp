"""Seed demo data for StudyHub — idempotent."""
import os, uuid, hashlib, boto3
from datetime import datetime, timezone, timedelta
from decimal import Decimal

REGION = os.environ.get("REGION", "eu-west-1")
TABLE = os.environ.get("DYNAMODB_TABLE", "studyhub-prod")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE)


def hash_password(pw):
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 100000)
    return salt.hex() + ":" + key.hex()


def user_exists(email):
    r = table.scan(
        FilterExpression="entityType = :et AND email = :e",
        ExpressionAttributeValues={":et": "user", ":e": email},
    )
    return r.get("Items", [])


def seed():
    now = datetime.now(timezone.utc)

    # --- Users ---
    users = [
        {"username": "admin", "email": "admin@anji.com", "password": "admin123"},
        {"username": "demo_user", "email": "user@anji.com", "password": "user123"},
    ]
    user_ids = {}
    for u in users:
        existing = user_exists(u["email"])
        if existing:
            user_ids[u["email"]] = existing[0]["id"]
            print(f"  User {u['email']} exists, skipping")
            continue
        uid = str(uuid.uuid4())
        user_ids[u["email"]] = uid
        table.put_item(Item={
            "id": uid, "entityType": "user",
            "username": u["username"], "email": u["email"],
            "password": hash_password(u["password"]),
            "createdAt": now.isoformat(),
        })
        print(f"  Created user: {u['email']}")

    admin_id = user_ids["admin@anji.com"]
    user_id = user_ids["user@anji.com"]

    # --- Check if projects exist ---
    existing_projects = table.scan(
        FilterExpression="entityType = :et",
        ExpressionAttributeValues={":et": "project"},
    ).get("Items", [])
    if len(existing_projects) >= 2:
        print("  Projects already seeded, skipping")
        return

    # --- Projects ---
    projects = [
        {"name": "Cloud Platform Assignment", "description": "CPP module group project — build and deploy a cloud-native app on AWS with CI/CD pipeline"},
        {"name": "Data Analytics Report", "description": "Semester 2 data analytics module — analyse Dublin housing dataset and present findings"},
        {"name": "Mobile App Prototype", "description": "UX Design module — design and prototype a campus navigation app in Figma + React Native"},
    ]
    project_ids = []
    for p in projects:
        pid = str(uuid.uuid4())
        project_ids.append(pid)
        table.put_item(Item={
            "id": pid, "entityType": "project",
            "name": p["name"], "description": p["description"],
            "members": [admin_id, user_id],
            "createdBy": admin_id,
            "createdAt": now.isoformat(),
        })
        print(f"  Created project: {p['name']}")

    # --- Tasks for Project 1 (Cloud Platform) ---
    tasks_p1 = [
        {"title": "Set up GitHub repository", "status": "done", "assignee": admin_id, "days_ago": 10},
        {"title": "Configure AWS credentials", "status": "done", "assignee": admin_id, "days_ago": 9},
        {"title": "Build Flask backend API", "status": "done", "assignee": user_id, "days_ago": 7},
        {"title": "Create DynamoDB tables", "status": "done", "assignee": admin_id, "days_ago": 6},
        {"title": "Build React frontend", "status": "in_progress", "assignee": user_id, "days_ago": 4},
        {"title": "Set up CI/CD pipeline", "status": "in_progress", "assignee": admin_id, "days_ago": 3},
        {"title": "Write unit tests", "status": "review", "assignee": user_id, "days_ago": 2},
        {"title": "Deploy to production", "status": "todo", "assignee": admin_id, "days_ago": 0, "deadline_days": 3},
        {"title": "Write IEEE report", "status": "todo", "assignee": user_id, "days_ago": 0, "deadline_days": 5},
    ]

    # --- Tasks for Project 2 (Data Analytics) ---
    tasks_p2 = [
        {"title": "Download housing dataset", "status": "done", "assignee": user_id, "days_ago": 8},
        {"title": "Clean and preprocess data", "status": "done", "assignee": admin_id, "days_ago": 6},
        {"title": "Exploratory data analysis", "status": "done", "assignee": user_id, "days_ago": 4},
        {"title": "Build regression model", "status": "in_progress", "assignee": admin_id, "days_ago": 2},
        {"title": "Create visualisations", "status": "todo", "assignee": user_id, "days_ago": 0, "deadline_days": 4},
        {"title": "Write analysis report", "status": "todo", "assignee": admin_id, "days_ago": 0, "deadline_days": 7},
    ]

    # --- Tasks for Project 3 (Mobile App) ---
    tasks_p3 = [
        {"title": "User research interviews", "status": "done", "assignee": user_id, "days_ago": 12},
        {"title": "Create wireframes", "status": "done", "assignee": admin_id, "days_ago": 8},
        {"title": "Design high-fidelity mockups", "status": "in_progress", "assignee": user_id, "days_ago": 3},
        {"title": "Build navigation prototype", "status": "todo", "assignee": admin_id, "days_ago": 0, "deadline_days": 6},
    ]

    all_tasks = [
        (project_ids[0], tasks_p1),
        (project_ids[1], tasks_p2),
        (project_ids[2], tasks_p3),
    ]

    for pid, tasks in all_tasks:
        for t in tasks:
            deadline = None
            if t.get("deadline_days"):
                deadline = (now + timedelta(days=t["deadline_days"])).strftime("%Y-%m-%d")
            table.put_item(Item={
                "id": str(uuid.uuid4()),
                "entityType": "task",
                "projectId": pid,
                "title": t["title"],
                "description": "",
                "status": t["status"],
                "assignee": t["assignee"],
                "deadline": deadline or "",
                "createdAt": (now - timedelta(days=t["days_ago"])).isoformat(),
            })
        print(f"  Created {len(tasks)} tasks for project {pid[:8]}")

    print("Seed complete.")


if __name__ == "__main__":
    seed()
