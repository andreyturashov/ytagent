from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.chat import router as chat_router
from routers.video import router as video_router

app = FastAPI()

app.include_router(
    chat_router,
    prefix="/api",
    tags=["chat"],
)

app.include_router(
    video_router,
    prefix="/api",
    tags=["video"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
