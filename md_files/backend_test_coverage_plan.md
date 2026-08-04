# Backend Test Coverage Report & Improvement Plan

## 📊 Current Coverage Summary

- **Overall Coverage**: **`57%`** (374 / 653 statements covered, 279 missing lines)
- **Total Test Cases**: 5 passing tests (`test_chat_router.py`, `test_db_imports.py`, `test_knowledge_service.py`, `test_sample.py`)

### Module Breakdown

| Module / Component                  | Coverage      | Missing Lines / Untested Areas                                                                                        |
| :---------------------------------- | :------------ | :-------------------------------------------------------------------------------------------------------------------- |
| **`agents/youtube_agent_graph.py`** | **0%**        | Full LangGraph agent orchestration (`1-221`)                                                                          |
| **`routers/video.py`**              | **0%**        | All FastAPI endpoints for video management (`1-39`)                                                                   |
| **`admin/`** (`setup.py`, views)    | **0%**        | SQLAdmin configuration and admin endpoints                                                                            |
| **`main.py`**                       | **0%**        | FastAPI application lifecycle setup and routing                                                                       |
| **`agents/tools/`**                 | **28% - 45%** | `knowledge_tools.py` (`20-39`), `video_tools.py` (`15-25`)                                                            |
| **`services/`**                     | **36% - 59%** | `message_service` (36%), `video_service` (40%), `user_service` (42%), `chat_service` (52%), `knowledge_service` (59%) |
| **`integrations/youtube.py`**       | **50%**       | YouTube transcript extraction error handling & formatting (`29-38`, `51-54`, `66-68`)                                 |
| **`db/models/`**                    | **100%**      | SQLAlchemy ORM Models                                                                                                 |
| **`routers/chat.py`**               | **81%**       | Chat router endpoints                                                                                                 |

---

## 🎯 Implementation Plan (Target: 85%+ Coverage)

### Phase 1: Business Logic & Services (High Priority)

_Target: Boost `services/` coverage to >90%_

1. **`services/message_service.py` (36% → 90%+)**
   - Unit tests for message history retrieval, user/assistant message creation, and error handling for missing chats.
2. **`services/video_service.py` (40% → 90%+)**
   - Tests for CRUD operations on video metadata, transcript persistence logic, and duplicate video handling.
3. **`services/user_service.py` (42% → 90%+)**
   - Tests for user creation, fetching, and field updates using async session fixtures.
4. **`services/chat_service.py` & `knowledge_service.py` (52-59% → 90%+)**
   - Add tests for bulk deletion, knowledge linking, and edge cases when querying missing entities.

### Phase 2: API Routers & App Entrypoint (Medium Priority)

_Target: Boost `routers/` coverage to >90%_

1. **`routers/video.py` (0% → 95%)**
   - Use `httpx.AsyncClient` / FastAPI `TestClient` to test `POST /video/process`, `GET /video/{id}`, and HTTP error responses (400, 404).
2. **`main.py` & `dependencies.py`**
   - Test application startup lifecycle and database session dependency injection.

### Phase 3: Agent Orchestration & Tools (Medium/High Complexity)

1. **`agents/tools/` (`knowledge_tools.py`, `video_tools.py`)**
   - Unit test tool execution with mocked service responses.
2. **`agents/youtube_agent_graph.py` (0% → 75%+)**
   - Mock LLM responses (`langchain_ollama`) to test graph transitions and execution paths without live model calls.

### Phase 4: Integrations & Admin

1. **`integrations/youtube.py`**
   - Mock `youtube-transcript-api` to test unavailable transcripts, API timeouts, and error handling.
2. **`admin/`**
   - Add basic smoke tests verifying SQLAdmin routing setup.

---

## 🛠️ Configuration & Workflow Enhancements

1. **Set Pytest Coverage Threshold**:
   Enforce coverage threshold in [backend/pyproject.toml](file:///Users/andreyturashov/Pet/ytagent/backend/pyproject.toml):

   ```toml
   [tool.coverage.report]
   fail_under = 80
   show_missing = true
   ```

2. **Add Makefile Target**:
   Add convenience target to run backend test coverage:
   ```make
   test-cov:
   	cd backend && .venv/bin/pytest --cov=. --cov-report=term-missing
   ```
