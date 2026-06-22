SHELL := /bin/zsh

BACKEND_PORT ?= 8000

.PHONY: backend frontend app

backend:
	cd backend && uv run uvicorn main:app --reload --port $(BACKEND_PORT)

frontend:
	cd frontend && npm run dev

app:
	$(MAKE) -j2 backend frontend

check:
	cd backend && uv run ruff check . --fix
