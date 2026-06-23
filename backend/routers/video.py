from fastapi import APIRouter, HTTPException

from agents.youtube_agent import app as agent_app
from dependencies import DbSession
from services.video_service import VideoService

router = APIRouter()


@router.get("/transcript/{video_id}")
async def get_transcript(video_id: str, db: DbSession) -> dict[str, str]:
    try:
        service = VideoService(db)
        transcript = await service.get_transcript(video_id)

        if not transcript:
            raise HTTPException(status_code=404, detail="Transcript not found")

        return {
            "video_id": video_id,
            "transcript": transcript,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/summary/{video_id}")
async def get_summary(video_id: str, db: DbSession) -> dict[str, str]:
    try:
        result = await agent_app.ainvoke({"video_id": video_id})

        return {
            "video_id": video_id,
            "summary": result["summary"],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
