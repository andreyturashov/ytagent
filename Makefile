# Environment variables
export PYTHONPATH="."

# Project variables
PROJECT_NAME=backend
APP_MODULE=$(PROJECT_NAME).main

.PHONY: backend

backend:
	@echo "Starting FastAPI backend for $(PROJECT_NAME)..."
	.venv/bin/uvicorn $(APP_MODULE):app --reload --host 127.0.0.1 --port 8000