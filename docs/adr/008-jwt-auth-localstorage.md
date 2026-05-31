# ADR-008: JWT Auth with localStorage and Force-Logout on 401

## Status
Accepted

## Context
Single-user trading journal needs simple auth without HTTP-only cookies or complex session management. Token-based auth with localStorage is straightforward but has XSS trade-offs.

## Decision
JWT access + refresh tokens stored in `localStorage` (`auth_token`, `refresh_token`). Axios response interceptor force-logs out user via `window.location.reload()` on any 401. Zustand `persist` middleware stores only `token` field; `onRehydrateStorage` calls `fetchMe()` to restore session.

## Consequences
- ✅ Simple implementation — no cookie management, no CSRF tokens
- ✅ 401 triggers full page reload — clears all in-memory state, forces re-auth
- ✅ `fetchMe()` on startup validates token before granting access
- ⚠️ Tokens accessible to JavaScript — XSS risk (acceptable for single-user app)
- ⚠️ Frontend does NOT auto-refresh tokens — logs out on expiry (30 min access token)
- ⚠️ Refresh token endpoint exists (`/auth/refresh`) but is not called by frontend
- ⚠️ bcrypt used for passwords (not passlib, due to Python 3.12 incompatibility)

## Security Follow-up
TODO: migrate browser token storage from `localStorage` to `httpOnly`, `Secure`, `SameSite` cookies. That migration should add CSRF protection for cookie-authenticated mutation routes, rotate refresh cookies server-side, and remove persisted access tokens from Zustand/localStorage. Until then, any XSS bug can read `auth_token` and `refresh_token`, so keep the CSP/sanitization posture tight and avoid rendering untrusted HTML.

## Implementation
- `frontend/src/lib/api.ts` — axios interceptor: 401 → `localStorage.removeItem('auth_token')` + `window.location.reload()`
- `frontend/src/store/authStore.ts` — `persist({ name: 'auth-storage', partialize: (state) => ({ token: state.token }) })`
- `backend/app/routers/auth.py` — access token (30 min), refresh token (7 days)
- `backend/app/core/security.py` — JWT via `python-jose`, bcrypt for passwords
