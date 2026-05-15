# ADR-013: nginx SPA Proxy + Traefik External Reverse Proxy

## Status
Accepted

## Context
The app needs HTTPS, domain routing, and API proxying. Traefik handles external HTTPS/DuckDNS routing. nginx inside the frontend container handles SPA serving and API proxying to backend.

## Decision
Frontend container runs nginx which:
- Proxies `/api/v1/` to `http://backend:8000`
- Serves SPA with `try_files $uri $uri/ /index.html`

External Traefik (outside this repo) handles TLS/HTTPS via Let's Encrypt with Docker labels. Frontend build uses `VITE_API_URL=/api/v1` (relative path) — API URL resolved by nginx at runtime.

## Consequences
- ✅ Same build works on any domain — API URL resolved at runtime, not build time
- ✅ Traefik handles TLS — app doesn't manage certificates
- ✅ Backend exposed only internally (port 8000 not mapped to host)
- ✅ All external traffic: Traefik → nginx → backend
- ⚠️ SPA fallback needed even though app uses Zustand view switching (direct URL access)
- ⚠️ Changing domain requires updating `DUCK_DOMAIN` env var and rebuilding

## Implementation
- `frontend/nginx.conf` — proxy `/api/v1/` to `http://backend:8000`, SPA fallback
- `frontend/Dockerfile` — build arg `VITE_API_URL=/api/v1`
- `docker-compose.yml` — Traefik labels on backend and frontend services
- `backend` service — `expose: ["8000"]` (not `ports:`), internal only
