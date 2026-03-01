# Apartment Helpdesk

Minimal, server-rendered ticketing system (Django).

## Deploy to Render (recommended)

This repo is set up so Render can build and run it with just a few settings.

### 1) Create the database

1. Render dashboard → **New** → **PostgreSQL**
2. Name: `helpdesk-db` (any name is fine)
3. Region: pick closest
4. Create

Copy the **Internal Database URL** (or External if you prefer). Render will expose it as a connection string like `postgres://...`.

### 2) Create the web service

1. Render dashboard → **New** → **Web Service**
2. Connect GitHub and select the repo
3. Branch: `main`
4. Environment: **Python**

**Build command**

`./render-build.sh`

**Start command**

`gunicorn helpdesk.wsgi:application`

### 3) Set environment variables (Render → Web Service → Environment)

- `DATABASE_URL`: paste from the Render Postgres instance
- `DJANGO_SECRET_KEY`: click “Generate” and paste a long random string
- `DJANGO_DEBUG`: `0`
- `DJANGO_ALLOWED_HOSTS`: the Render hostname (e.g. `your-service.onrender.com`)
- `DJANGO_CSRF_TRUSTED_ORIGINS`: `https://your-service.onrender.com`

### 4) Deploy

Click **Deploy latest commit**. Then open the service URL.

## Local dev (optional)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

