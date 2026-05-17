.PHONY: api backend-dev backend-lint backend-format frontend-dev frontend-build frontend-types frontend-lint qdrant-up qdrant-down qdrant-reset qdrant-status reset-demo-data

api: backend-dev

backend-dev:
	cd backend && uv run uvicorn app.main:app --reload

backend-lint:
	cd backend && uv run ruff check .

backend-format:
	cd backend && uv run ruff format .

frontend-dev:
	cd frontend && pnpm dev

frontend-build:
	cd frontend && pnpm build

frontend-types:
	cd frontend && pnpm openapi:gen

frontend-lint:
	cd frontend && pnpm lint

qdrant-up:
	docker compose up -d qdrant

qdrant-down:
	docker compose down

qdrant-reset:
	docker compose down -v
	docker compose up -d qdrant

qdrant-status:
	@curl -s http://localhost:6333/collections | python3 -m json.tool

reset-demo-data:
	./scripts/reset-demo-data.sh
