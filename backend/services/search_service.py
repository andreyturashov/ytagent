import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.knowledge_item import KnowledgeItem
from db.models.video import Video
from services.embedding_service import EmbeddingService


@dataclass
class SearchResult:
    video: Video
    knowledge_item: KnowledgeItem
    score: float
    vector_score: float
    text_score: float


def parse_relative_date_range(
    query: str,
    now: datetime | None = None,
) -> tuple[datetime | None, datetime | None, str]:
    """
    Parse relative date expressions from user natural language query.

    Args:
        query (str): Natural language query string
        now (datetime | None): Reference current datetime (defaults to UTC now)

    Returns:
        tuple[datetime | None, datetime | None, str]: (start_date, end_date, cleaned_query)
    """
    ref_now = now or datetime.now(UTC)
    query_lower = query.lower()
    cleaned_query = query

    # 1. "yesterday"
    if "yesterday" in query_lower:
        yesterday = ref_now - timedelta(days=1)
        start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        cleaned = re.sub(r"\byesterday\b", "", cleaned_query, flags=re.IGNORECASE).strip()
        return start, end, cleaned

    # 2. "today"
    if "today" in query_lower:
        start = ref_now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = ref_now
        cleaned = re.sub(r"\btoday\b", "", cleaned_query, flags=re.IGNORECASE).strip()
        return start, end, cleaned

    # 3. "last N days" / "N days ago"
    match_n = re.search(
        r"\b(last|past)\s+(\d+)\s+days?\b|\b(\d+)\s+days?\s+ago\b",
        query_lower,
    )
    if match_n:
        n_str = match_n.group(2) or match_n.group(3)
        days = int(n_str) if n_str else 7
        start = ref_now - timedelta(days=days)
        end = ref_now
        cleaned = re.sub(match_n.group(0), "", cleaned_query, flags=re.IGNORECASE).strip()
        return start, end, cleaned

    # 4. "last week" / "past week"
    if "last week" in query_lower or "past week" in query_lower:
        start = ref_now - timedelta(days=7)
        end = ref_now
        cleaned = re.sub(
            r"\b(last|past)\s+week\b",
            "",
            cleaned_query,
            flags=re.IGNORECASE,
        ).strip()
        return start, end, cleaned

    # 5. "recently" / "last month" / "past month"
    if any(k in query_lower for k in ["recently", "last month", "past month"]):
        start = ref_now - timedelta(days=30)
        end = ref_now
        cleaned = re.sub(
            r"\b(recently|last month|past month)\b",
            "",
            cleaned_query,
            flags=re.IGNORECASE,
        ).strip()
        return start, end, cleaned

    return None, None, query


class SearchService:
    """
    Hybrid search engine combining temporal date filtering, full-text search,
    pgvector cosine similarity, and recency decay reranking.
    """

    def __init__(
        self,
        session: AsyncSession,
        embedding_service: EmbeddingService | None = None,
    ) -> None:
        self.session = session
        self.embedding_service = embedding_service or EmbeddingService()

    async def search(
        self,
        query: str,
        user_id: int,
        limit: int = 10,
        reference_now: datetime | None = None,
    ) -> list[SearchResult]:
        """
        Execute hybrid search over user's watched knowledge items.

        Args:
            query (str): Natural language search query
            user_id (int): ID of the user performing search
            limit (int): Max number of results to return
            reference_now (datetime | None): Optional reference datetime for relative parsing

        Returns:
            list[SearchResult]: List of scored and ranked search results
        """
        if not query or not query.strip():
            return []

        ref_now = reference_now or datetime.now(UTC)
        start_date, end_date, cleaned_query = parse_relative_date_range(query, now=ref_now)

        # Generate query vector embedding
        query_vector = await self.embedding_service.embed_text(cleaned_query or query)

        # Base query joining KnowledgeItem and Video
        stmt = (
            select(KnowledgeItem, Video)
            .join(Video, KnowledgeItem.video_id == Video.id)
            .where(KnowledgeItem.user_id == user_id)
        )

        # Apply temporal range filter if relative date was parsed
        if start_date and end_date:
            stmt = stmt.where(
                KnowledgeItem.accessed_at >= start_date,
                KnowledgeItem.accessed_at <= end_date,
            )

        result = await self.session.execute(stmt)
        rows: list[tuple[KnowledgeItem, Video]] = list(result.tuples().all())

        if not rows:
            return []

        search_results: list[SearchResult] = []
        search_terms = (cleaned_query or query).lower().split()

        for ki, video in rows:
            # 1. Vector similarity calculation (cosine distance -> similarity in [0, 1])
            vector_score = 0.0
            if query_vector and video.embedding is not None:
                try:
                    v1 = list(query_vector)
                    v2 = list(video.embedding)
                    dot = sum(a * b for a, b in zip(v1, v2, strict=False))
                    norm1 = math.sqrt(sum(a * a for a in v1))
                    norm2 = math.sqrt(sum(b * b for b in v2))
                    if norm1 > 0 and norm2 > 0:
                        vector_score = max(0.0, dot / (norm1 * norm2))
                except Exception:
                    vector_score = 0.0

            # 2. Text match calculation (keyword match over title, summary, transcript)
            text_score = 0.0
            video_text = (
                f"{video.title or ''} {video.summary or ''} {video.transcript or ''}"
            ).lower()
            if search_terms and video_text:
                matches = sum(1 for term in search_terms if term in video_text)
                text_score = min(1.0, matches / len(search_terms))

            # 3. Hybrid base score
            if query_vector and video.embedding is not None:
                hybrid_score = (0.7 * vector_score) + (0.3 * text_score)
            else:
                hybrid_score = text_score if text_score > 0 else 0.1

            # 4. Time decay penalty: exp(-lambda * days_ago)
            days_ago = max(0.0, (ref_now - ki.accessed_at).total_seconds() / 86400.0)
            decay = math.exp(-0.05 * days_ago)
            final_score = hybrid_score * decay

            search_results.append(
                SearchResult(
                    video=video,
                    knowledge_item=ki,
                    score=final_score,
                    vector_score=vector_score,
                    text_score=text_score,
                )
            )

        # Sort by final score descending
        search_results.sort(key=lambda x: x.score, reverse=True)

        return search_results[:limit]
