# r_hcm

HCM Redevelopment project built with Django and Django REST Framework.

## Stack

- Python
- Django 5.2.8
- Django REST Framework 3.16.1
- SQLite for the default local database
- PostgreSQL for Docker-based local development
- Server-rendered Django templates plus static JavaScript/CSS assets

## Prerequisites

- Python 3.x installed and available in `py` or `python`
- PowerShell on Windows
- Docker Desktop if you want to use the containerized setup

The current checked-in local environment uses `Python 3.14.0`. Use one shared Python version across the team to avoid environment drift.

## First-Time Setup

1. Create a virtual environment:

```powershell
py -3.14 -m venv venv
```

2. Activate the virtual environment:

```powershell
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

3. Install dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

4. Create a local environment file:

```powershell
Copy-Item .env.example .env
```

5. Apply database migrations:

```powershell
python manage.py migrate
```

6. Run validation checks:

```powershell
python manage.py check
python manage.py test
```

7. Start the development server:

```powershell
python manage.py runserver
```

The app will be available at `http://127.0.0.1:8000/`.

## Optional Admin User

Create a superuser if you need Django admin access:

```powershell
python manage.py createsuperuser
```

Admin URL:

- `http://127.0.0.1:8000/admin/`

## Environment Variables

The project now reads overrides from a local `.env` file if present.

Current supported variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_TIME_ZONE`
- `DJANGO_DB_ENGINE`
- `DJANGO_DB_NAME`
- `DJANGO_DB_USER`
- `DJANGO_DB_PASSWORD`
- `DJANGO_DB_HOST`
- `DJANGO_DB_PORT`

Notes:

- `DJANGO_ALLOWED_HOSTS` should be a comma-separated list.
- For SQLite, `DJANGO_DB_NAME` may be a relative path such as `db.sqlite3`.
- If `.env` is missing, the project falls back to local-development defaults from `r_hcm/settings.py`.

## Common Commands

```powershell
python manage.py migrate
python manage.py check
python manage.py test
python manage.py runserver
```

If you do not want to activate the virtual environment, you can run:

```powershell
venv\Scripts\python.exe manage.py runserver
```

## Docker Setup

Use Docker when you want a consistent team setup with the app and database running in containers.

Files included for Docker local development:

- `Dockerfile`
- `compose.yaml`
- `.dockerignore`
- `.env.docker.example`

### First-Time Docker Setup

1. Copy the Docker env file:

```powershell
Copy-Item .env.docker.example .env.docker
```

2. Build and start the containers:

```powershell
docker compose up --build -d
```

3. Apply migrations inside the web container:

```powershell
docker compose exec web python manage.py migrate
```

4. Create a superuser if needed:

```powershell
docker compose exec web python manage.py createsuperuser
```

5. Open the app:

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/admin/`

### Daily Docker Commands

Start:

```powershell
docker compose up -d
```

Stop:

```powershell
docker compose down
```

Stop and delete the PostgreSQL volume:

```powershell
docker compose down -v
```

View app logs:

```powershell
docker compose logs -f web
```

Run tests:

```powershell
docker compose exec web python manage.py test
```

Run Django checks:

```powershell
docker compose exec web python manage.py check
```

### Docker Notes

- The Docker setup uses PostgreSQL instead of SQLite.
- The Django app container mounts the project directory, so code changes are reflected immediately.
- The PostgreSQL data is stored in the named volume `postgres_data`.
- If you change Docker-related environment variables, restart the containers.

## Local Database

The repository currently includes a local SQLite database snapshot at `db.sqlite3`.

If you want your own isolated local database file, set this in `.env`:

```env
DJANGO_DB_NAME=local_dev.sqlite3
```

Then run:

```powershell
python manage.py migrate
```

## Documentation

- [API_CONTRACT.md](./API_CONTRACT.md)
- [docs/SYSTEM_OVERVIEW.md](./docs/SYSTEM_OVERVIEW.md)
- [docs/RECRUITMENT_CENTRAL_DATA.md](./docs/RECRUITMENT_CENTRAL_DATA.md)
