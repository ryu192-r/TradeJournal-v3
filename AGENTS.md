# Trading Journal v3 — Agent Guide

## Stack
- **Frontend**: React 19, Vite 8, TypeScript 6, Tailwind 3, Zustand (UI state), TanStack React Query (server state)
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0 **sync**, PostgreSQL
- **Infra**: Docker Compose (postgres + backend + frontend + bot), Traefik HTTPS via DuckDNS, nginx serves frontend

## Quick commands
```bash
# Full stack
docker compose up -d --build
docker compose logs -f backend
docker compose logs -f frontend

# Backend tests (uses SQLite, no Docker needed)
cd backend && python3 -m pytest tests/ -v

# Frontend
cd frontend && npm run dev
cd frontend && npx vitest run       # unit tests
cd frontend && npx tsc --noEmit     # typecheck before build
cd frontend && npm run build        # tsc -b && vite build
```

## Key architecture
- **Auth gate**: App.tsx checks `isAuthenticated` — all pages require login
- **View switching**: Zustand `appStore.activeView` (not URL router)
- **Routes**: Register in `backend/app/routers/base.py`, prefix `/api/v1`
- **Models**: Define in `backend/app/models/`, import in `__init__.py` so `Base.metadata.create_all` picks them up
- **Schemas**: Pydantic v2 in `backend/app/schemas/`
- **Monetary values**: All returned as **strings** from backend (Decimal serialization)
- **DB**: Tables auto-created on startup (`main.py:15`). Prod = PostgreSQL, tests override to SQLite (`conftest.py:7`)
- **Theme**: CSS variables via `data-theme="dark"|"light"` attr on root. Fonts: Newsreader (display), Inter (body), JetBrains Mono (data/mono)

## Testing quirks
- Backend tests use SQLite with fresh DB per test (`conftest.py` drops/creates all tables)
- `auth_user_token` fixture registers a user and returns JWT
- Frontend: Vitest with jsdom, setup in `src/test/setup.ts`

## Repo conventions
- **Git**: conventional commits (`feat:`, `fix:`, `docs:`)
- **CSS**: Tailwind utility classes + CSS variables (var(--accent), var(--bg-card), etc.)
- **Don't**: create new files unless necessary — prefer editing existing ones
- **Design**: dark discipline theme, border radius `rounded-2xl = 14px`, card-in animation (`.animate-card-in`)

## Services
| Service | Port | Notes |
|---------|------|-------|
| Postgres | 5432 | user: `trading_journal` |
| Backend | 8000 | uvicorn, health at `/health` |
| Frontend | 3000 | nginx, proxies `/api/v1` to backend |
| Bot | - | Telegram bot, depends on postgres |

## AI Coach providers
Ollama, OpenAI, DeepSeek, Anthropic, Google — configured via Settings page or `ai_config.json`.
