# Matter Acc V1

Matter Acc V1 is a full-stack accounting web application with a Next.js frontend and a Flask backend. The repository is organized so both apps can be uploaded together to GitHub and run locally or with Docker Compose.

## Tech Stack

- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS
- Backend: Flask 3, SQLAlchemy, Flask-Login, Flask-Migrate
- Local database: SQLite
- Package managers: npm for frontend, pip for backend

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── config/
│   │   ├── domain/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   ├── storage/
│   │   ├── generated/
│   │   └── uploads/
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── app/
│   ├── assets/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── public/
│   ├── styles/
│   ├── views/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## What Is Ignored From Git

The `.gitignore` keeps source files in Git and excludes local/runtime files:

- dependency folders such as `node_modules/` and `.venv/`
- build output such as `frontend/.next/`, `dist/`, and `*.tsbuildinfo`
- logs and test caches
- Python `__pycache__` and `*.pyc`
- local `.env` files
- backend runtime data in `backend/storage/`, including SQLite databases, generated PDFs/CSVs/TXT files, and uploaded files

The storage directories include `.gitkeep` placeholders so the folder structure is present after cloning.

## Environment Files

Copy the examples before running locally:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

Important variables:

- `FLASK_SECRET_KEY`: change this for non-local environments
- `FRONTEND_ORIGINS`: comma-separated frontend URLs allowed by Flask CORS
- `DATABASE_URL`: backend database URL
- `NEXT_PUBLIC_API_BASE_URL`: frontend API base URL, usually `http://127.0.0.1:5000`

## Run Locally

### Backend

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

The backend starts at `http://127.0.0.1:5000`.

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

### Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:3000`.

## Run With Docker Compose

From the repository root:

```powershell
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

Docker Compose mounts `backend/storage` so local runtime data persists between container restarts.

## Verification

Run these checks before pushing:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run build
```

```powershell
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests
.\backend\.venv\Scripts\python.exe -m compileall backend\app
```

## Upload To GitHub

If this folder is not already a Git repository:

```powershell
git init
git add .
git status
git commit -m "Initial full-stack app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Before committing, confirm that `git status` does not include runtime files such as:

- `backend/storage/app.db`
- `backend/storage/database.json`
- `backend/storage/generated/*`
- `backend/storage/uploads/*`
- `frontend/.next/*`
- `frontend/*.log`
- `backend/*.log`

## Backend API

Main endpoints include:

- `GET /api/health`
- `GET /api/bootstrap`
- `GET|POST|DELETE /api/auth/session`
- `GET|PUT /api/onboarding/draft`
- `POST /api/onboarding/complete`
- `GET /api/invoices`
- `GET /api/expenses`
- `GET /api/customers`
- `GET /api/products`
- `GET /api/finance/accounts`
- `GET /api/reports`

Additional routes for documents, purchases, inventory, payroll, tax, settings, imports, attachments, and support are implemented in `backend/app/routes/api.py`.
