# Matter Acc V1

Matter Acc V1 is a local full-stack accounting web application with a Next.js frontend and a Flask backend. It is intended to run from source on a developer machine.

## Tech Stack

- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS
- Backend: Flask 3, SQLAlchemy, Flask-Login, Flask-Migrate
- Local database: SQLite
- Package managers: npm for frontend, pip for backend

## Project Structure

```text
.
|-- backend/
|   |-- app/
|   |   |-- config/
|   |   |-- domain/
|   |   |-- models/
|   |   |-- routes/
|   |   `-- services/
|   |-- tests/
|   |-- requirements.txt
|   `-- run.py
|-- frontend/
|   |-- app/
|   |-- assets/
|   |-- components/
|   |-- hooks/
|   |-- lib/
|   |-- public/
|   |-- styles/
|   |-- views/
|   `-- package.json
`-- README.md
```

Runtime files are created locally and ignored by Git. The backend recreates `backend/storage/` automatically when it starts.

## Environment Files

Copy the example environment files before running locally:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

Important variables:

- `FLASK_SECRET_KEY`: local Flask secret key
- `FRONTEND_ORIGINS`: comma-separated frontend URLs allowed by Flask CORS
- `DATABASE_URL`: backend database URL, usually SQLite under `backend/storage/app.db`
- `NEXT_PUBLIC_API_BASE_URL`: frontend API base URL, usually `http://127.0.0.1:5000`

## Run Locally

Open one terminal for the backend:

```powershell
cd "C:\Users\Matee\Desktop\NotScan\DataFlowXcel OCR\MainWebsite\entrepreneur\matter-acc-V1"
backend\.venv\Scripts\activate
python backend\run.py
```

If the backend virtual environment does not exist yet:

```powershell
cd "C:\Users\Matee\Desktop\NotScan\DataFlowXcel OCR\MainWebsite\entrepreneur\matter-acc-V1\backend"
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

Open a second terminal for the frontend:

```powershell
cd "C:\Users\Matee\Desktop\NotScan\DataFlowXcel OCR\MainWebsite\entrepreneur\matter-acc-V1\frontend"
npm install
npm run dev
```

The frontend starts at `http://localhost:3000`.

## Verification

Run these checks before pushing:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run build
```

```powershell
cd ..
.\backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests
.\backend\.venv\Scripts\python.exe -m compileall backend\app
```

## GitHub Workflow

This project is connected to:

```text
https://github.com/mateelonggpt-dev/entrepreneur-webapp
```

Common workflow:

```powershell
git status
git add .
git commit -m "Describe your change"
git push
```

To create and push a feature branch:

```powershell
git switch -c your-branch-name
git add .
git commit -m "Describe your change"
git push -u origin your-branch-name
```

Before committing, confirm that `git status` does not include runtime or local files such as:

- `backend/.env`
- `frontend/.env.local`
- `backend/.venv/`
- `backend/storage/`
- `frontend/.next/`
- `frontend/node_modules/`

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
