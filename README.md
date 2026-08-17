# Log Delivery Management System V2

Professional local-first version of the working Log Delivery demo.

## Architecture

- Backend: Django + Django REST Framework + SQLite
- Frontend: React + Vite
- Git: GitPython
- Email: simulation first; SMTP/Graph adapter can be added next
- Core workflow: repository → logs → validation → archive → delivery → audit

## Run backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

## Seed the demo repository/config

The easiest path is to use the repository from V1 at `../demo/demo_repository`, or create a Git repo with a `logs` folder containing fake `.log` files. Then create a repository through the API or Django admin.

For a quick API seed in PowerShell:

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/repositories/ -H "Content-Type: application/json" -d '{"name":"Demo ASP.NET Core","local_path":"../demo/demo_repository","branch":"main","log_directory":"logs","extensions":[".log",".txt",".rag"],"recipients":["demo@example.com"],"email_mode":"SIMULATION","active":true}'
```

## Run frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Important

This V2 intentionally keeps email in simulation mode. Credentials should be provided through environment/secret management later. Do not connect this to a real company repository or mailbox until security and access controls are reviewed.
