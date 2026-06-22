SHELL := /bin/zsh

BACKEND_PORT ?= 8000

.PHONY: backend frontend app check postgres makemigrations migrate

backend:
	cd backend && uv run uvicorn main:app --reload --port $(BACKEND_PORT)

frontend:
	cd frontend && npm run dev

app:
	$(MAKE) -j2 backend frontend

check:
	cd backend && uv run ruff check . --fix

postgres:
	uv run psql postgres

makemigrations:
	@read -p "Migration name: " msg; \
	cd backend && uv run alembic revision --autogenerate -m "$$msg"

migrate:
	cd backend && uv run alembic upgrade head
