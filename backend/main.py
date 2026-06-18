from integrations.youtube import YouTubeIntegration
from fastapi import FastAPI, HTTPException
from agents.youtube_agent import app as agent_app
from routers.chat import router as chat_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.include_router(
    chat_router,
    prefix="/api",
    tags=["chat"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/transcript/{video_id}")
async def get_transcript(video_id: str):
    try:
        youtube_integration = YouTubeIntegration()

        result = await youtube_integration.fetch_transcript_text(video_id=video_id)

        if not result:
            raise HTTPException(status_code=404, detail="Transcript not found")

        return {
            "video_id": video_id,
            "transcript": result,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/summary/{video_id}")
async def get_summary(video_id: str):
    try:
        result = await agent_app.ainvoke({"video_id": video_id})

        return {
            "video_id": video_id,
            "summary": result["summary"],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
