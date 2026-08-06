from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from agents.youtube_agent import app as agent_app
from db.models.knowledge_item import KnowledgeItem, KnowledgeType
from dependencies import DbSession
from schemas.video import (
    SearchVideoItem,
    SearchVideoResponse,
    TrackVideoRequest,
    TrackVideoResponse,
)
from services.search_service import SearchService
from services.video_service import VideoService

router = APIRouter()


@router.get("/transcript/{video_id}")
async def get_transcript(video_id: str, db: DbSession) -> dict[str, str]:
    try:
        service = VideoService(db)
        transcript = await service.get_or_create_transcript(video_id)

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


@router.post("/track", response_model=TrackVideoResponse)
async def track_video(payload: TrackVideoRequest, db: DbSession) -> TrackVideoResponse:
    """
    Track a watched video, creating or updating KnowledgeItem access timestamp.
    """
    try:
        video_service = VideoService(db)
        video = await video_service.get_video_by_youtube_id(payload.youtube_video_id)

        if not video:
            transcript = await video_service.youtube.fetch_transcript_text(payload.youtube_video_id)
            video = await video_service.create_video(
                youtube_video_id=payload.youtube_video_id,
                transcript=transcript,
            )
        else:
            # Update accessed_at timestamp on KnowledgeItem for user
            stmt = select(KnowledgeItem).where(
                KnowledgeItem.video_id == video.id,
                KnowledgeItem.user_id == payload.user_id,
            )
            ki_res = await db.execute(stmt)
            ki = ki_res.scalar_one_or_none()
            now = datetime.now(UTC)

            if ki:
                ki.accessed_at = now
                db.add(ki)
            else:
                new_ki = KnowledgeItem(
                    user_id=payload.user_id,
                    knowledge_type=KnowledgeType.VIDEO,
                    video_id=video.id,
                    source_url=payload.url
                    or f"https://www.youtube.com/watch?v={payload.youtube_video_id}",
                    accessed_at=now,
                )
                db.add(new_ki)

            await db.commit()
            await db.refresh(video)

        return TrackVideoResponse(
            success=True,
            video_id=video.id,
            youtube_video_id=video.youtube_video_id,
            title=video.title,
            channel_title=video.channel_title,
            thumbnail_url=video.thumbnail_url,
            summary=video.summary,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/search", response_model=SearchVideoResponse)
async def search_videos(
    db: DbSession,
    q: str = Query(..., description="Natural language search query"),
    user_id: int = Query(1, description="User ID"),
    limit: int = Query(10, description="Max results limit"),
) -> SearchVideoResponse:
    """
    Search watched video history using hybrid vector+text search with relative date parsing.
    """
    try:
        search_service = SearchService(db)
        results = await search_service.search(query=q, user_id=user_id, limit=limit)

        items = [
            SearchVideoItem(
                video_id=r.video.id,
                youtube_video_id=r.video.youtube_video_id,
                title=r.video.title,
                channel_title=r.video.channel_title,
                thumbnail_url=r.video.thumbnail_url,
                summary=r.video.summary,
                source_url=r.knowledge_item.source_url,
                accessed_at=r.knowledge_item.accessed_at,
                score=r.score,
            )
            for r in results
        ]

        return SearchVideoResponse(query=q, results=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
