# app-docker-k8s-deploy

A small Todo app used as a hands-on playground for **Docker**, **Docker Compose**, and **Kubernetes**.

## Stack

- **Frontend**: React (Vite), served by nginx in production, which reverse-proxies `/api` to the backend.
- **Backend**: FastAPI, talks to Postgres via SQLAlchemy.
- **Database**: PostgreSQL.

```
frontend (nginx:80) --/api--> backend (uvicorn:8000) --> db (postgres:5432)
```

## Project layout

```
backend/            FastAPI app + Dockerfile
frontend/           React app + Dockerfile (multi-stage build -> nginx)
docker-compose.yml  Local dev: all three services + a named volume for Postgres
k8s/                Namespace, ConfigMap, Secret, Deployments, Services
```

## Prerequisites

None of these are currently installed on this machine — install what you need for the stage you're practicing:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes the `docker` CLI and `docker compose`)
- [kubectl](https://kubernetes.io/docs/tasks/tools/#kubectl)
- [minikube](https://minikube.sigs.k8s.io/docs/start/)

On Windows, `winget install Docker.DockerDesktop`, `winget install Kubernetes.kubectl`, and `winget install Kubernetes.minikube` work well.

---

## 0. Run it natively (no Docker)

Useful while Docker Desktop isn't available (e.g. virtualization disabled in firmware), or just to see the app work before adding containers into the mix. Requires a local PostgreSQL instance.

1. Create a database and role matching `backend/.env`'s `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` (or edit `backend/.env` to match an existing role), e.g.:
   ```bash
   createdb -U <role> -h 127.0.0.1 <db-name>
   ```
2. Backend — note `DATABASE_URL` in `backend/.env` must point at `127.0.0.1` (or `localhost`), not `db`, when running outside Docker:
   ```bash
   cd backend
   python -m venv .venv
   .venv/Scripts/activate        # .venv\Scripts\Activate.ps1 in PowerShell
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
   `database.py` loads `backend/.env` itself via `python-dotenv` when run this way. Check http://localhost:8000/api/health.
3. Frontend, in a second terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open http://localhost:5173 — Vite's dev proxy (`vite.config.js`) forwards `/api` to `http://localhost:8000`, so the frontend needs no changes between this mode and Docker.

---

## 1. Run it with Docker Compose

This is the easiest way to see all three containers working together.

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/health
- Postgres: localhost:5432 (`todo_user` / `todo_pass`, see `backend/.env`)

Stop and remove containers:

```bash
docker compose down
```

Stop and also wipe the database volume:

```bash
docker compose down -v
```

### Environment variables

Two `.env` files (gitignored; each has a `.env.example` showing what's needed), both injected into containers at runtime via `env_file:`:

- **`backend/.env`** — `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` (the discrete vars the official postgres image needs to initialize itself - it doesn't accept a connection string), plus a `DATABASE_URL` built from those same values, e.g. `postgresql+psycopg2://todo_user:todo_pass@db:5432/todos`. The `db` service loads this same file for its `POSTGRES_*` vars, so there's exactly one place to edit credentials instead of two files staying in sync.
- **`frontend/.env`** — `VITE_API_BASE_URL` (defaults to `/api`, a relative path so it works behind both the Vite dev proxy and nginx). Vite bakes `VITE_`-prefixed vars into the built JS at build time, so a change here requires `docker compose build frontend` to take effect — it's not read at container runtime like the backend's.

### Things to try here

- `docker compose ps`, `docker compose logs -f backend`
- Scale the backend: `docker compose up --scale backend=3` (note the frontend's nginx only proxies to one `backend` DNS name — this is a good segue into *why* Kubernetes Services exist)
- `docker exec -it <container> sh` to poke around inside a running container

---

## 2. Run it on Kubernetes (minikube)

### Start the cluster

```bash
minikube start
```

### Build the images *inside* minikube's Docker daemon

Minikube runs its own Docker engine. Point your shell at it so `docker build` produces images the cluster can actually see (no registry push needed):

```bash
# PowerShell
& minikube -p minikube docker-env | Invoke-Expression

# bash
eval $(minikube docker-env)
```

Then build:

```bash
docker build -t todo-backend:local ./backend
docker build -t todo-frontend:local ./frontend
```

The manifests in `k8s/` reference these exact image names with `imagePullPolicy: Never`, so Kubernetes uses the local image instead of trying to pull from a registry.

### Create the Secret

`k8s/secret.yaml` is gitignored (it holds plaintext credentials), so create it from the example once:

```bash
cp k8s/secret.yaml.example k8s/secret.yaml
```

Edit it if you want different credentials — just keep it in sync with whatever `backend/.env`'s `DATABASE_URL` uses for the Docker Compose path.

### Apply the manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

(Or just `kubectl apply -f k8s/` to apply everything at once.)

### Check it's up

```bash
kubectl get pods -n todo-app
kubectl get svc -n todo-app
```

### Reach the app

```bash
minikube service frontend -n todo-app
```

This opens the frontend in your browser via a minikube-managed tunnel to the NodePort service.

### Things to try here

- `kubectl logs -n todo-app deploy/backend`
- `kubectl scale -n todo-app deploy/backend --replicas=4` and watch `kubectl get pods -n todo-app -w`
- `kubectl describe pod -n todo-app <pod-name>` when something won't start
- Delete a backend pod and watch the Deployment recreate it: `kubectl delete pod -n todo-app <pod-name>`
- `kubectl exec -n todo-app -it deploy/postgres -- psql -U todo_user -d todos`

### Tear down

```bash
kubectl delete namespace todo-app
minikube stop
```

## Notes on what's intentionally simplified

- Postgres uses an `emptyDir` volume in Kubernetes, not a `PersistentVolumeClaim` — data is lost if the pod is rescheduled. That's fine for learning; swap it for a PVC once you want real persistence.
- No Ingress — the frontend is exposed via a `NodePort` Service instead, kept to the "core" Kubernetes objects (Deployment, Service, ConfigMap, Secret).
- `k8s/secret.yaml` has plaintext credentials in `stringData` for readability. That's fine for a local learning cluster but shouldn't be committed to git in a real project.
