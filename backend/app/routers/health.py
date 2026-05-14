from fastapi import APIRouter
from app.schemas.health import HealthResponse

router = APIRouter()

@router.get("", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        message="Trading Journal v3 is running"
    )