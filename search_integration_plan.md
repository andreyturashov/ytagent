# Backend Search Engine & Chrome Extension Integration Plan

This document outlines the detailed architecture and integration plan for introducing natural language search, watch history tracking, and retrieval-augmented generation (RAG) capabilities into the `ytagent` backend and Chrome extension.

---

## 1. Overview & Requirements

The goal is to allow users to ask natural language questions in the Chrome extension chat/search interface about videos they watched or content inside those videos:

1. **Temporal & Watch History Queries**:
   - *Example*: *"What video I looked yesterday"*
   - *Requirement*: The system must record when videos were watched (`watched_at` timestamp), store video titles and channel metadata, and parse relative dates ("yesterday", "2 days ago", "last week") to return matching watched videos.

2. **Semantic Content & RAG Queries**:
   - *Example*: *"Recently I saw a video about MCP servers. What was it about?"*
   - *Requirement*: The system must search over existing video transcripts (`Video.transcript`), video titles, and summaries, identify the relevant video, and use the agent to answer questions about the video's content.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                        │
│  ┌────────────────────────────┐ ┌────────────────────────┐  │
│  │ Auto Watch Track (Bkgd)   │ │ Popup Search & Chat    │  │
│  └─────────────┬──────────────┘ └───────────┬────────────┘  │
└────────────────┼────────────────────────────┼───────────────┘
                 │ POST /api/videos/track     │ POST /api/chat
                 ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                        │
│  ┌────────────────────────────┐ ┌────────────────────────┐  │
│  │ VideoService & Ingestion  │ │ ConversationService    │  │
│  │  - Metadata (oEmbed)       │ │  - LangGraph Agent     │  │
│  │  - Transcript Fetch        │ │  - Tools & RAG Engine  │  │
│  │  - Vector Embedding        │ │                        │  │
│  └─────────────┬──────────────┘ └───────────┬────────────┘  │
│                └─────────────┬──────────────┘               │
│                              ▼                              │
│                    Search & Vector Service                  │
│       (Temporal SQL Filter + Hybrid Text/Vector Search)     │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               PostgreSQL Database + pgvector                │
│            [videos] (pgvector + GIN tsvector)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Technical Deep-Dive: Hybrid Search Architecture

### 3.1 Database Layer (PostgreSQL + `pgvector` + FTS)

To enable fast, exact keyword, and semantic hybrid search, PostgreSQL is configured with:

1. **`pgvector` Extension**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. **Table Schema Additions (`backend/db/models/video.py`)**:
   - `title`: `VARCHAR(500)`
   - `channel_title`: `VARCHAR(255)`
   - `description`: `TEXT`
   - `summary`: `TEXT` (LLM-generated summary)
   - `thumbnail_url`: `VARCHAR(1000)`
   - `watched_at`: `TIMESTAMP WITH TIME ZONE` (Indexed)
   - `embedding`: `Vector(768)` (768-dim embeddings from Ollama `nomic-embed-text`)
   - `search_vector`: `tsvector` (Full-Text Search generated column from title + summary + transcript)

3. **Postgres Indexing Strategy**:
   - **HNSW Vector Index**: `CREATE INDEX idx_videos_embedding ON videos USING hnsw (embedding vector_cosine_ops);` for fast sub-millisecond ANN vector search.
   - **GIN Text Search Index**: `CREATE INDEX idx_videos_fts ON videos USING gin(search_vector);` for keyword matching.
   - **B-Tree Time Index**: `CREATE INDEX idx_videos_watched_at ON videos (watched_at DESC);` for fast temporal range queries.

4. **Alembic Migration (`backend/alembic/versions/`)**:
   - Migration script creating `pgvector` extension, adding columns, and building indices.

---

### 3.2 SQLAlchemy Layer (`backend/services/search_service.py`)

Using `pgvector.sqlalchemy` integration inside SQLAlchemy 2.0 async session:

```python
from pgvector.sqlalchemy import Vector
from sqlalchemy import func, select, or_, and_

# 1. Temporal Range Filter
stmt = select(
    Video,
    (1 - Video.embedding.cosine_distance(query_vector)).label("vector_sim"),
    func.ts_rank(Video.search_vector, func.plainto_tsquery('english', query_text)).label("fts_rank")
).where(
    Video.watched_at >= start_datetime,
    Video.watched_at <= end_datetime
)

# 2. Score Combination & Recency Decay Reranking
# Score = (alpha * Vector_Sim + beta * FTS_Rank) * exp(-lambda * days_ago)
```

#### Hybrid Score Calculation Formula
For each candidate video matching date constraints:
1. **Vector Similarity ($S_{\text{vec}}$)**: Cosine similarity score $\in [0, 1]$.
2. **Text Search Rank ($S_{\text{fts}}$)**: Normalized `ts_rank` score.
3. **Hybrid Base Score**: $S_{\text{hybrid}} = 0.7 \times S_{\text{vec}} + 0.3 \times S_{\text{fts}}$.
4. **Time Decay Penalty**:
   $$S_{\text{final}} = S_{\text{hybrid}} \times \exp\left(-\lambda \cdot \Delta t_{\text{days}}\right)$$
   (where $\lambda \approx 0.05$ so recent videos are prioritized if relevancy scores are close).

---

### 3.3 Temporal Natural Language Parsing (`SearchService`)

`SearchService` includes a deterministic date parser for standard relative queries:

| Natural Query Phrase | Parsed Date Range Filter |
|:---|:---|
| *"yesterday"* | `[00:00:00 yesterday, 23:59:59 yesterday]` |
| *"today"* | `[00:00:00 today, now]` |
| *"last 3 days"* / *"2 days ago"* | `[now - 3 days, now]` |
| *"last week"* | `[now - 7 days, now]` |
| *"recently"* | `[now - 14 days, now]` |

If no date keyword is present, default filter searches all watched videos with time-decay ranking.

---

### 3.4 LangGraph Agent & Tool Execution Flow (`backend/agents/`)

#### System Prompt Updates ([youtube_agent.py](file:///Users/andreyturashov/Pet/ytagent/backend/agents/youtube_agent.py))
Inject current datetime dynamically:
```python
def build_system_prompt(video_id: str | None) -> str:
    now_str = datetime.now().strftime("%A, %B %d, %Y %H:%M")
    return f"""
    You are a YouTube Knowledge Assistant.
    Current Time: {now_str}

    When answering user questions:
    - Use 'search_watch_history' to find videos by date or topic (e.g. "yesterday", "MCP servers").
    - Use 'search_video_content' or 'get_transcript' to dive into video content to explain what a video was about.
    """
```

#### LangGraph Tools ([knowledge_tools.py](file:///Users/andreyturashov/Pet/ytagent/backend/agents/tools/knowledge_tools.py))

1. **`search_watch_history(query: str, relative_date: str | None = None)`**:
   - Executes hybrid PostgreSQL query with temporal bounds.
   - Returns markdown list of matching videos: Title, Channel, Watched Date/Time, YouTube URL, Summary.

2. **`search_video_content(query: str, video_id: str | None = None)`**:
   - Retrieves full transcript and summary for the specified video.
   - Allows agent to answer "What was it about?" with precise context.

---

### 3.5 Chrome Extension Ingestion & UI (`chrome-extension/`)

1. **Background Auto-Track (`background.js`)**:
   - Automatically sends `POST /api/videos/track` with `{ youtube_video_id, url, watched_at }` when navigating YouTube.
2. **Popup Chat Interface (`popup.js` & `popup.html`)**:
   - Natural language input bar.
   - Formatted video cards for search responses showing thumbnail, title, channel, watched timestamp, and summary.

---

## 4. Summary of Component Changes

| Layer | Component / File | What Needs To Change |
|:---|:---|:---|
| **Database** | PostgreSQL & Alembic | Enable `pgvector` extension; add `embedding`, `search_vector`, `watched_at`, `summary` columns; build HNSW & GIN indices. |
| **ORM / Models** | `backend/db/models/video.py` | Add `Vector` and metadata columns to SQLAlchemy `Video` model. |
| **Ingestion** | `backend/services/video_service.py` | Add oEmbed metadata fetching, Ollama embedding generation (`nomic-embed-text`), LLM video summarization. |
| **Search Engine** | `backend/services/search_service.py` | Implement relative date parser + SQLAlchemy hybrid `pgvector` + `tsvector` query with time-decay ranking. |
| **Agent Tools** | `backend/agents/tools/knowledge_tools.py` | Update `search_watch_history` & `search_video_content` tools to call `SearchService`. |
| **Agent Prompt** | `backend/agents/youtube_agent.py` | Dynamically inject system time into prompt so LLM understands temporal references ("yesterday"). |
| **Chrome Extension** | `chrome-extension/background.js` | Track visited YouTube tabs automatically via `chrome.tabs.onUpdated`. |
