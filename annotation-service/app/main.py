import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


from fastapi import FastAPI, HTTPException
from sqlalchemy import select

from app.db.database import Base, engine, AsyncSessionLocal
from app.services.annotation_service import AnnotationService
from app.ingestion.stream_manager import StreamManager
from app.api.routes import router as api_router
from app.api.sse import router as sse_router
from app.api.clock_anchors import router as clock_anchors_router

logger = logging.getLogger(__name__)
app = FastAPI(title="Pitchline BE2 -- Annotation Service")


@app.on_event("startup")
async def startup():
    # creates the annotations table if it doesn't exist yet -- safe no-op otherwise
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    annotation_service = AnnotationService()
    app.state.annotation_service = annotation_service
    app.state.stream_manager = StreamManager(annotation_service)


@app.get("/")
async def root():
    return {"status": "running"}


@app.get("/health")
async def health():
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(select(1))
        return {"status": "ok", "db": "connected"}
    except Exception:
        logger.exception("health check failed")
        raise HTTPException(status_code=503, detail="unhealthy")


app.include_router(api_router)
app.include_router(sse_router)
app.include_router(clock_anchors_router)
