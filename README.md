# StudyHub - Student Collaboration Platform

A serverless platform that enables students to collaborate on projects, manage tasks, share files, and communicate in real time.

## Tech Stack

**Frontend:** React + Vite (hosted on S3 static website)
**Backend:** AWS Lambda (Python 3.11)
**Database:** Amazon DynamoDB
**Storage:** Amazon S3
**API:** Amazon API Gateway (REST)
**Notifications:** Amazon SNS

## AWS Services

1. **AWS Lambda** - Serverless backend API
2. **Amazon DynamoDB** - NoSQL database for users, projects, tasks, and messages
3. **Amazon S3** - File storage and frontend static hosting
4. **Amazon API Gateway** - REST API with CORS support
5. **Amazon SNS** - Push notifications for project updates
6. **AWS IAM** - Role-based access control for services

## Features

- **Authentication** - JWT-based user registration and login
- **Projects** - Create and manage collaborative study projects
- **Tasks** - Assign, track, and update project tasks
- **Chat** - Real-time messaging within project groups
- **Files** - Upload and share documents via S3
- **Notifications** - SNS alerts for project activity and deadlines

## Project Structure


```
studyhub/
  backend/          # Lambda function (Python)
  frontend/         # React + Vite application
  library/          # Shared Python library
  .github/workflows # CI/CD pipeline
```

## Setup Instructions

### Prerequisites

- Python 3.11+
- Node.js 20+
- AWS CLI configured with appropriate credentials

### Library

```bash
cd library
pip install -e .
pip install pytest
pytest tests/ -v
```

### Backend

The backend is deployed as an AWS Lambda function via the CI/CD pipeline. For local development:

```bash
cd backend
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` to point to your API Gateway endpoint.

### Deployment

Push to the `main` branch to trigger the GitHub Actions pipeline. The pipeline requires two repository secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

The pipeline will:
1. Run library tests
2. Deploy the backend (DynamoDB, S3, Lambda, API Gateway, SNS)
3. Build and deploy the frontend to S3 static hosting

### Live URL

Frontend: http://studyhub-frontend-prod-anjaneyareddy.s3-website-eu-west-1.amazonaws.com
