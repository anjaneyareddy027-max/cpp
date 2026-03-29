"""
StudyHub Student Collaboration Platform - Lambda Backend
=========================================================
Single AWS Lambda function handling all API routes.
Region: eu-west-1
DynamoDB: Single table 'studyhub-prod' with PK 'id' (String)
Each item has an 'entityType' field: user, project, task, message, file
"""

import json
import os
import uuid
import time
import hashlib
import hmac
import base64
import secrets
from decimal import Decimal
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Environment variables
# ---------------------------------------------------------------------------
DYNAMODB_TABLE = os.environ.get('DYNAMODB_TABLE', 'studyhub-prod')
S3_BUCKET = os.environ.get('S3_BUCKET', 'studyhub-files-prod-anjaneyareddy')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN', '')
REGION = os.environ.get('REGION', 'eu-west-1')
JWT_SECRET = os.environ.get('JWT_SECRET', 'studyhub-secret-key-2026')

# ---------------------------------------------------------------------------
# AWS clients
# ---------------------------------------------------------------------------
dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(DYNAMODB_TABLE)
s3_client = boto3.client('s3', region_name=REGION)
sns_client = boto3.client('sns', region_name=REGION)

# ---------------------------------------------------------------------------
# CORS headers — applied to every response
# ---------------------------------------------------------------------------
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
}


# ===========================================================================
# Helper utilities
# ===========================================================================

def build_response(status_code, body):
    """Build an API Gateway-compatible response with CORS headers."""
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, default=str)
    }


def parse_body(event):
    """Safely parse the JSON body from the event."""
    body = event.get('body')
    if not body:
        return {}
    if isinstance(body, str):
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}
    return body


def to_decimal(obj):
    """Recursively convert floats and ints to Decimal for DynamoDB."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, int) and not isinstance(obj, bool):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_decimal(i) for i in obj]
    return obj


def now_iso():
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.utcnow().isoformat() + 'Z'


# ===========================================================================
# Password hashing (hashlib.pbkdf2_hmac + random salt)
# ===========================================================================

def hash_password(password):
    """Hash a plaintext password. Returns salt:hash (both hex-encoded)."""
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100_000
    )
    return f"{salt}:{pw_hash.hex()}"


def verify_password(password, stored):
    """Verify a password against the stored salt:hash string."""
    try:
        salt, expected_hash = stored.split(':')
        pw_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100_000
        )
        return pw_hash.hex() == expected_hash
    except Exception:
        return False


# ===========================================================================
# JWT-like token helpers (hmac + base64 + json, no external deps)
# ===========================================================================

def _b64_encode(data):
    """URL-safe base64 encode without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def _b64_decode(s):
    """URL-safe base64 decode (re-add padding)."""
    padding = 4 - len(s) % 4
    s += '=' * padding
    return base64.urlsafe_b64decode(s)


def create_token(payload, expires_in=86400):
    """
    Create a JWT-like token.
    payload: dict with at minimum {userId, username}
    expires_in: seconds until expiry (default 24 h)
    """
    header = {'alg': 'HS256', 'typ': 'JWT'}
    now = int(time.time())
    payload['iat'] = now
    payload['exp'] = now + expires_in

    # Encode header and payload
    header_b64 = _b64_encode(json.dumps(header).encode('utf-8'))
    payload_b64 = _b64_encode(json.dumps(payload, default=str).encode('utf-8'))

    # Create signature
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        JWT_SECRET.encode('utf-8'),
        signing_input.encode('utf-8'),
        hashlib.sha256
    ).digest()
    sig_b64 = _b64_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_token(token):
    """
    Decode and verify a JWT-like token.
    Returns the payload dict or raises an exception.
    """
    parts = token.split('.')
    if len(parts) != 3:
        raise ValueError('Invalid token format')

    header_b64, payload_b64, sig_b64 = parts

    # Verify signature
    signing_input = f"{header_b64}.{payload_b64}"
    expected_sig = hmac.new(
        JWT_SECRET.encode('utf-8'),
        signing_input.encode('utf-8'),
        hashlib.sha256
    ).digest()
    actual_sig = _b64_decode(sig_b64)

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError('Invalid token signature')

    # Decode payload
    payload = json.loads(_b64_decode(payload_b64))

    # Check expiry
    if payload.get('exp', 0) < int(time.time()):
        raise ValueError('Token expired')

    return payload


def get_authenticated_user(event):
    """Extract and verify JWT token from Authorization header."""
    headers = event.get('headers', {}) or {}
    auth = headers.get('Authorization') or headers.get('authorization') or ''
    if not auth.startswith('Bearer '):
        return None
    token = auth[7:]
    try:
        payload = decode_token(token)
        return payload  # {userId, username, exp, iat}
    except Exception:
        return None


# ===========================================================================
# Route helpers — extract path parameters
# ===========================================================================

def extract_path_param(path, prefix):
    """
    Extract the ID segment after a known prefix.
    e.g. extract_path_param('/projects/abc-123/tasks', '/projects/') -> 'abc-123'
    """
    after = path[len(prefix):]
    return after.split('/')[0] if after else None


# ===========================================================================
# AUTH ROUTES
# ===========================================================================

def handle_register(event):
    """POST /auth/register — create a new user account and return a token."""
    body = parse_body(event)
    username = body.get('username', '').strip()
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')

    # Validate required fields
    if not username or not email or not password:
        return build_response(400, {'error': 'username, email, and password are required'})

    if len(password) < 6:
        return build_response(400, {'error': 'Password must be at least 6 characters'})

    try:
        # Check if email already exists
        result = table.scan(
            FilterExpression=Attr('entityType').eq('user') & Attr('email').eq(email)
        )
        if result.get('Items'):
            return build_response(400, {'error': 'Email already registered'})

        # Create user record
        user_id = str(uuid.uuid4())
        hashed = hash_password(password)
        user_item = to_decimal({
            'id': user_id,
            'entityType': 'user',
            'username': username,
            'email': email,
            'password': hashed,
            'createdAt': now_iso()
        })
        table.put_item(Item=user_item)

        # Generate token
        token = create_token({'userId': user_id, 'username': username})

        return build_response(201, {
            'message': 'User registered successfully',
            'token': token,
            'user': {
                'id': user_id,
                'username': username,
                'email': email
            }
        })

    except ClientError as e:
        print(f"DynamoDB error in register: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_login(event):
    """POST /auth/login — authenticate user and return a token."""
    body = parse_body(event)
    email = body.get('email', '').strip().lower()
    password = body.get('password', '')

    if not email or not password:
        return build_response(400, {'error': 'email and password are required'})

    try:
        # Look up user by email (scan with filter)
        result = table.scan(
            FilterExpression=Attr('entityType').eq('user') & Attr('email').eq(email)
        )
        items = result.get('Items', [])

        if not items:
            return build_response(401, {'error': 'Invalid email or password'})

        user = items[0]

        # Verify password
        if not verify_password(password, user.get('password', '')):
            return build_response(401, {'error': 'Invalid email or password'})

        # Generate token
        token = create_token({'userId': user['id'], 'username': user['username']})

        return build_response(200, {
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'email': user['email']
            }
        })

    except ClientError as e:
        print(f"DynamoDB error in login: {e}")
        return build_response(500, {'error': 'Internal server error'})


# ===========================================================================
# PROJECT ROUTES
# ===========================================================================

def handle_get_projects(event, user):
    """GET /projects — return projects where the user is a member."""
    try:
        result = table.scan(
            FilterExpression=Attr('entityType').eq('project')
        )
        # Filter projects where the authenticated user is in the members list
        projects = [
            p for p in result.get('Items', [])
            if user['userId'] in p.get('members', [])
        ]
        return build_response(200, {'projects': projects})

    except ClientError as e:
        print(f"DynamoDB error in get_projects: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_create_project(event, user):
    """POST /projects — create a new project."""
    body = parse_body(event)
    name = body.get('name', '').strip()
    description = body.get('description', '').strip()

    if not name:
        return build_response(400, {'error': 'Project name is required'})

    try:
        project_id = str(uuid.uuid4())
        project_item = to_decimal({
            'id': project_id,
            'entityType': 'project',
            'name': name,
            'description': description,
            'members': [user['userId']],
            'createdBy': user['userId'],
            'createdAt': now_iso()
        })
        table.put_item(Item=project_item)

        return build_response(201, {
            'message': 'Project created successfully',
            'project': project_item
        })

    except ClientError as e:
        print(f"DynamoDB error in create_project: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_get_project(event, user, project_id):
    """GET /projects/{id} — get a single project by id."""
    try:
        result = table.get_item(Key={'id': project_id})
        item = result.get('Item')

        if not item or item.get('entityType') != 'project':
            return build_response(404, {'error': 'Project not found'})

        # Check membership
        if user['userId'] not in item.get('members', []):
            return build_response(403, {'error': 'You are not a member of this project'})

        return build_response(200, {'project': item})

    except ClientError as e:
        print(f"DynamoDB error in get_project: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_update_project(event, user, project_id):
    """PUT /projects/{id} — update project name/description."""
    body = parse_body(event)

    try:
        # Fetch existing project
        result = table.get_item(Key={'id': project_id})
        item = result.get('Item')

        if not item or item.get('entityType') != 'project':
            return build_response(404, {'error': 'Project not found'})

        if user['userId'] not in item.get('members', []):
            return build_response(403, {'error': 'You are not a member of this project'})

        # Build update expression dynamically
        update_parts = []
        expr_values = {}
        expr_names = {}

        if 'name' in body:
            update_parts.append('#n = :name')
            expr_values[':name'] = body['name'].strip()
            expr_names['#n'] = 'name'

        if 'description' in body:
            update_parts.append('#d = :desc')
            expr_values[':desc'] = body['description'].strip()
            expr_names['#d'] = 'description'

        if not update_parts:
            return build_response(400, {'error': 'Nothing to update'})

        # Add updatedAt timestamp
        update_parts.append('updatedAt = :updatedAt')
        expr_values[':updatedAt'] = now_iso()

        updated = table.update_item(
            Key={'id': project_id},
            UpdateExpression='SET ' + ', '.join(update_parts),
            ExpressionAttributeValues=to_decimal(expr_values),
            ExpressionAttributeNames=expr_names if expr_names else None,
            ReturnValues='ALL_NEW'
        )

        return build_response(200, {
            'message': 'Project updated successfully',
            'project': updated.get('Attributes', {})
        })

    except ClientError as e:
        print(f"DynamoDB error in update_project: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_delete_project(event, user, project_id):
    """DELETE /projects/{id} — delete the project and all related items."""
    try:
        # Fetch existing project
        result = table.get_item(Key={'id': project_id})
        item = result.get('Item')

        if not item or item.get('entityType') != 'project':
            return build_response(404, {'error': 'Project not found'})

        if item.get('createdBy') != user['userId']:
            return build_response(403, {'error': 'Only the project creator can delete it'})

        # Delete all related items (tasks, messages, files)
        for entity_type in ['task', 'message', 'file']:
            related = table.scan(
                FilterExpression=Attr('entityType').eq(entity_type) & Attr('projectId').eq(project_id)
            )
            for related_item in related.get('Items', []):
                # If it is a file, also delete from S3
                if entity_type == 'file' and related_item.get('s3Key'):
                    try:
                        s3_client.delete_object(Bucket=S3_BUCKET, Key=related_item['s3Key'])
                    except ClientError:
                        pass  # Best-effort S3 cleanup
                table.delete_item(Key={'id': related_item['id']})

        # Delete the project itself
        table.delete_item(Key={'id': project_id})

        return build_response(200, {'message': 'Project and all related items deleted'})

    except ClientError as e:
        print(f"DynamoDB error in delete_project: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_add_member(event, user, project_id):
    """POST /projects/{id}/members — add a user to the project by email."""
    body = parse_body(event)
    email = body.get('email', '').strip().lower()

    if not email:
        return build_response(400, {'error': 'email is required'})

    try:
        # Fetch project
        result = table.get_item(Key={'id': project_id})
        project = result.get('Item')

        if not project or project.get('entityType') != 'project':
            return build_response(404, {'error': 'Project not found'})

        if user['userId'] not in project.get('members', []):
            return build_response(403, {'error': 'You are not a member of this project'})

        # Find user by email
        user_result = table.scan(
            FilterExpression=Attr('entityType').eq('user') & Attr('email').eq(email)
        )
        users = user_result.get('Items', [])
        if not users:
            return build_response(404, {'error': 'No user found with that email'})

        new_member = users[0]

        # Check if already a member
        if new_member['id'] in project.get('members', []):
            return build_response(400, {'error': 'User is already a member of this project'})

        # Add to members list
        table.update_item(
            Key={'id': project_id},
            UpdateExpression='SET members = list_append(members, :new_member)',
            ExpressionAttributeValues={':new_member': [new_member['id']]}
        )

        return build_response(200, {
            'message': f"User {new_member['username']} added to project",
            'memberId': new_member['id']
        })

    except ClientError as e:
        print(f"DynamoDB error in add_member: {e}")
        return build_response(500, {'error': 'Internal server error'})


# ===========================================================================
# TASK ROUTES
# ===========================================================================

def handle_get_tasks(event, user, project_id):
    """GET /projects/{id}/tasks — list tasks for a project."""
    try:
        result = table.scan(
            FilterExpression=Attr('entityType').eq('task') & Attr('projectId').eq(project_id)
        )
        tasks = result.get('Items', [])
        return build_response(200, {'tasks': tasks})

    except ClientError as e:
        print(f"DynamoDB error in get_tasks: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_create_task(event, user, project_id):
    """POST /projects/{id}/tasks — create a task and notify via SNS."""
    body = parse_body(event)
    title = body.get('title', '').strip()

    if not title:
        return build_response(400, {'error': 'Task title is required'})

    try:
        task_id = str(uuid.uuid4())
        task_item = to_decimal({
            'id': task_id,
            'entityType': 'task',
            'projectId': project_id,
            'title': title,
            'description': body.get('description', '').strip(),
            'priority': body.get('priority', 'medium'),
            'status': body.get('status', 'todo'),
            'deadline': body.get('deadline', ''),
            'assignedTo': body.get('assignedTo', ''),
            'createdBy': user['userId'],
            'createdAt': now_iso()
        })
        table.put_item(Item=task_item)

        # Publish SNS notification about the new task
        if SNS_TOPIC_ARN:
            try:
                sns_client.publish(
                    TopicArn=SNS_TOPIC_ARN,
                    Subject='StudyHub - New Task Created',
                    Message=(
                        f"A new task has been created in StudyHub.\n\n"
                        f"Title: {title}\n"
                        f"Priority: {body.get('priority', 'medium')}\n"
                        f"Created by: {user['username']}\n"
                        f"Project ID: {project_id}"
                    )
                )
            except ClientError as e:
                # Log but do not fail the request if SNS publish fails
                print(f"SNS publish error: {e}")

        return build_response(201, {
            'message': 'Task created successfully',
            'task': task_item
        })

    except ClientError as e:
        print(f"DynamoDB error in create_task: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_update_task(event, user, task_id):
    """PUT /tasks/{id} — update task fields (status, title, etc.)."""
    body = parse_body(event)

    try:
        result = table.get_item(Key={'id': task_id})
        item = result.get('Item')

        if not item or item.get('entityType') != 'task':
            return build_response(404, {'error': 'Task not found'})

        # Build update expression
        update_parts = []
        expr_values = {}
        expr_names = {}
        allowed_fields = ['title', 'description', 'priority', 'status', 'deadline', 'assignedTo']

        for field in allowed_fields:
            if field in body:
                placeholder = f":f_{field}"
                alias = f"#f_{field}"
                update_parts.append(f"{alias} = {placeholder}")
                expr_values[placeholder] = body[field]
                expr_names[alias] = field

        if not update_parts:
            return build_response(400, {'error': 'Nothing to update'})

        update_parts.append('updatedAt = :updatedAt')
        expr_values[':updatedAt'] = now_iso()

        updated = table.update_item(
            Key={'id': task_id},
            UpdateExpression='SET ' + ', '.join(update_parts),
            ExpressionAttributeValues=to_decimal(expr_values),
            ExpressionAttributeNames=expr_names,
            ReturnValues='ALL_NEW'
        )

        return build_response(200, {
            'message': 'Task updated successfully',
            'task': updated.get('Attributes', {})
        })

    except ClientError as e:
        print(f"DynamoDB error in update_task: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_delete_task(event, user, task_id):
    """DELETE /tasks/{id} — delete a task."""
    try:
        result = table.get_item(Key={'id': task_id})
        item = result.get('Item')

        if not item or item.get('entityType') != 'task':
            return build_response(404, {'error': 'Task not found'})

        table.delete_item(Key={'id': task_id})

        return build_response(200, {'message': 'Task deleted successfully'})

    except ClientError as e:
        print(f"DynamoDB error in delete_task: {e}")
        return build_response(500, {'error': 'Internal server error'})


# ===========================================================================
# MESSAGE ROUTES
# ===========================================================================

def handle_get_messages(event, user, project_id):
    """GET /projects/{id}/messages — list messages sorted by createdAt."""
    try:
        result = table.scan(
            FilterExpression=Attr('entityType').eq('message') & Attr('projectId').eq(project_id)
        )
        messages = sorted(result.get('Items', []), key=lambda m: m.get('createdAt', ''))

        return build_response(200, {'messages': messages})

    except ClientError as e:
        print(f"DynamoDB error in get_messages: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_create_message(event, user, project_id):
    """POST /projects/{id}/messages — send a message in a project."""
    body = parse_body(event)
    content = body.get('content', '').strip()

    if not content:
        return build_response(400, {'error': 'Message content is required'})

    try:
        msg_id = str(uuid.uuid4())
        msg_item = to_decimal({
            'id': msg_id,
            'entityType': 'message',
            'projectId': project_id,
            'content': content,
            'senderId': user['userId'],
            'senderName': user['username'],
            'createdAt': now_iso()
        })
        table.put_item(Item=msg_item)

        return build_response(201, {
            'message': 'Message sent',
            'data': msg_item
        })

    except ClientError as e:
        print(f"DynamoDB error in create_message: {e}")
        return build_response(500, {'error': 'Internal server error'})


# ===========================================================================
# FILE ROUTES
# ===========================================================================

def handle_upload_file(event, user, project_id):
    """POST /projects/{id}/files — upload a file to S3 and store metadata."""
    body = parse_body(event)
    file_name = (body.get('fileName') or body.get('file_name', '')).strip()
    file_content_b64 = body.get('fileContent') or body.get('file_content', '')
    file_type = body.get('fileType') or body.get('file_type', 'application/octet-stream')

    if not file_name or not file_content_b64:
        return build_response(400, {'error': 'fileName and fileContent (base64) are required'})

    try:
        # Decode base64 file content
        file_bytes = base64.b64decode(file_content_b64)
    except Exception:
        return build_response(400, {'error': 'Invalid base64 fileContent'})

    try:
        # Upload to S3
        file_id = str(uuid.uuid4())
        s3_key = f"projects/{project_id}/{file_id}_{file_name}"

        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=file_type
        )

        # Store metadata in DynamoDB
        file_item = to_decimal({
            'id': file_id,
            'entityType': 'file',
            'projectId': project_id,
            'fileName': file_name,
            'fileType': file_type,
            'fileSize': len(file_bytes),
            's3Key': s3_key,
            's3Bucket': S3_BUCKET,
            'uploadedBy': user['userId'],
            'uploaderName': user['username'],
            'createdAt': now_iso()
        })
        table.put_item(Item=file_item)

        return build_response(201, {
            'message': 'File uploaded successfully',
            'file': file_item
        })

    except ClientError as e:
        print(f"AWS error in upload_file: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_get_files(event, user, project_id):
    """GET /projects/{id}/files — list file metadata for a project."""
    try:
        result = table.scan(
            FilterExpression=Attr('entityType').eq('file') & Attr('projectId').eq(project_id)
        )
        files = sorted(result.get('Items', []), key=lambda f: f.get('createdAt', ''))

        return build_response(200, {'files': files})

    except ClientError as e:
        print(f"DynamoDB error in get_files: {e}")
        return build_response(500, {'error': 'Internal server error'})


# ===========================================================================
# NOTIFICATION / SNS ROUTES
# ===========================================================================

def handle_subscribe(event, user):
    """POST /subscribe — subscribe an email to the SNS topic."""
    body = parse_body(event)
    email = body.get('email', '').strip().lower()

    if not email:
        return build_response(400, {'error': 'email is required'})

    if not SNS_TOPIC_ARN:
        return build_response(500, {'error': 'SNS topic not configured'})

    try:
        sns_client.subscribe(
            TopicArn=SNS_TOPIC_ARN,
            Protocol='email',
            Endpoint=email
        )
        return build_response(200, {
            'message': f'Subscription request sent to {email}. Please check your inbox to confirm.'
        })

    except ClientError as e:
        print(f"SNS error in subscribe: {e}")
        return build_response(500, {'error': 'Internal server error'})


def handle_get_subscribers(event, user):
    """GET /subscribers — get count of confirmed subscribers."""
    if not SNS_TOPIC_ARN:
        return build_response(500, {'error': 'SNS topic not configured'})

    try:
        attrs = sns_client.get_topic_attributes(TopicArn=SNS_TOPIC_ARN)
        confirmed = attrs.get('Attributes', {}).get('SubscriptionsConfirmed', '0')
        pending = attrs.get('Attributes', {}).get('SubscriptionsPending', '0')

        return build_response(200, {
            'confirmed': int(confirmed),
            'pending': int(pending)
        })

    except ClientError as e:
        print(f"SNS error in get_subscribers: {e}")
        return build_response(500, {'error': 'Internal server error'})


# ===========================================================================
# MAIN ROUTER
# ===========================================================================

def lambda_handler(event, context):
    """
    Main Lambda entry point.
    Routes incoming API Gateway events to the appropriate handler.
    """
    # Extract HTTP method and path
    http_method = event.get('httpMethod', '') or event.get('requestContext', {}).get('http', {}).get('method', '')
    path = event.get('path', '') or event.get('rawPath', '')

    # Strip stage prefix if present (e.g. /prod/projects/... -> /projects/...)
    stage = event.get('requestContext', {}).get('stage', '')
    if stage and path.startswith(f'/{stage}'):
        path = path[len(f'/{stage}'):]
    if not path:
        path = '/'

    # Strip trailing slash for consistency
    if path != '/' and path.endswith('/'):
        path = path.rstrip('/')

    print(f"Request: {http_method} {path}")

    # Handle CORS preflight
    if http_method == 'OPTIONS':
        return build_response(200, {'message': 'OK'})

    # -----------------------------------------------------------------------
    # Public auth routes (no token required)
    # -----------------------------------------------------------------------
    if path == '/auth/register' and http_method == 'POST':
        return handle_register(event)

    if path == '/auth/login' and http_method == 'POST':
        return handle_login(event)

    # Public notification routes (no auth required)
    if path == '/subscribe' and http_method == 'POST':
        return handle_subscribe(event, None)

    if path == '/subscribers' and http_method == 'GET':
        return handle_get_subscribers(event, None)

    # -----------------------------------------------------------------------
    # All remaining routes require authentication
    # -----------------------------------------------------------------------
    user = get_authenticated_user(event)
    if not user:
        return build_response(401, {'error': 'Unauthorized. Please provide a valid token.'})

    # -- Project routes -----------------------------------------------------
    if path == '/projects' and http_method == 'GET':
        return handle_get_projects(event, user)

    if path == '/projects' and http_method == 'POST':
        return handle_create_project(event, user)

    # Routes that start with /projects/{id}
    if path.startswith('/projects/') and path != '/projects/':
        segments = path.split('/')
        # segments: ['', 'projects', '{id}', ...]
        project_id = segments[2] if len(segments) > 2 else None

        if not project_id:
            return build_response(400, {'error': 'Project ID is required'})

        # /projects/{id}/members
        if len(segments) == 4 and segments[3] == 'members' and http_method == 'POST':
            return handle_add_member(event, user, project_id)

        # /projects/{id}/tasks
        if len(segments) == 4 and segments[3] == 'tasks':
            if http_method == 'GET':
                return handle_get_tasks(event, user, project_id)
            if http_method == 'POST':
                return handle_create_task(event, user, project_id)

        # /projects/{id}/messages
        if len(segments) == 4 and segments[3] == 'messages':
            if http_method == 'GET':
                return handle_get_messages(event, user, project_id)
            if http_method == 'POST':
                return handle_create_message(event, user, project_id)

        # /projects/{id}/files
        if len(segments) == 4 and segments[3] == 'files':
            if http_method == 'GET':
                return handle_get_files(event, user, project_id)
            if http_method == 'POST':
                return handle_upload_file(event, user, project_id)

        # /projects/{id} — GET, PUT, DELETE (only if no further sub-path)
        if len(segments) == 3:
            if http_method == 'GET':
                return handle_get_project(event, user, project_id)
            if http_method == 'PUT':
                return handle_update_project(event, user, project_id)
            if http_method == 'DELETE':
                return handle_delete_project(event, user, project_id)

    # -- Task routes (top-level) -------------------------------------------
    if path.startswith('/tasks/'):
        task_id = path.split('/')[2] if len(path.split('/')) > 2 else None
        if not task_id:
            return build_response(400, {'error': 'Task ID is required'})

        if http_method == 'PUT':
            return handle_update_task(event, user, task_id)
        if http_method == 'DELETE':
            return handle_delete_task(event, user, task_id)

    # -- Fallback -----------------------------------------------------------
    return build_response(404, {'error': f'Route not found: {http_method} {path}'})
