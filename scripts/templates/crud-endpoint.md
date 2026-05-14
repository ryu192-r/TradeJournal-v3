---
name: crud-endpoint
description: Template for creating CRUD API endpoints for a resource.
---

Create FastAPI CRUD endpoints for **`{resource}`**. Files:

- `backend/app/routers/{resource}.py` — router with POST/GET/PUT/DELETE endpoints
- `backend/app/schemas/{resource}.py` — Pydantic v2 request/response schemas
- `backend/app/services/{resource}_service.py` — domain service (business logic, duplicate checks)

**Endpoints:**
- `POST /api/v1/{resource_path}/` — create new resource, return 201 with `{resource}Response`
- `GET /api/v1/{resource_path}/` — list with pagination (skip, limit), return `{resource}ListResponse`
- `GET /api/v1/{resource_path}/{{id}}` — read single resource
- `PUT /api/v1/{resource_path}/{{id}}` — update with status transition validation
- `DELETE /api/v1/{resource_path}/{{id}}` — soft delete (set status='deleted'), return 204

**Model:** `backend/app/models/{model_file}.py` → use existing `{ModelClass}` SQLAlchemy model
**Database:** `backend/app/db/database.py` → use `get_db` dependency (sync Session)
**Router registration:** `backend/app/routers/base.py` → import router and include in `api_router`

**Validation:** Status transitions must be checked BEFORE mutation. Use helper function:
```python
VALID_TRANSITIONS = {
    "draft": ["reviewed", "deleted"],
    "reviewed": ["analytics", "draft", "deleted"],
    "analytics": ["draft", "reviewed", "deleted"],
    "deleted": ["draft"],
}
```

**Schemas:** Use Decimal strings (not float) for monetary fields. Use `field_validator` on direction/status enums. Include `created_at`, `updated_at` in response.

**Tests:** Create `backend/app/tests/test_{resource}.py` with at least:
- Create resource and verify it persists
- List resources returns non-empty list
- Update with invalid status transition → 400
- Soft delete changes status to 'deleted'
