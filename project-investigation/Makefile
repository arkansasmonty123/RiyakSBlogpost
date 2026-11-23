# THE INVESTIGATION — development helpers

install: ## npm install (root workspace with frontend workspace)
	npm install

dev: ## run frontend dev server (Vite, :5173)
	npm run dev:frontend

dev-frontend: ## run frontend dev server (Vite, :5173)
	npm run dev:frontend

dev-backend: ## run backend API server (Express, :3000)
	npm run dev:backend

dev-all: ## run frontend (5173) + backend (3000)
	$(MAKE) dev:backend >/tmp/the-investigation-backend.log 2>&1 &
	$(MAKE) dev:frontend

build: ## backend typecheck
	npm run typecheck

test: ## backend tests (smoke + http)
	npm run typecheck
	npm run test:smoke
	npm run test:http

test-frontend: ## frontend build + lint
	npm run build --workspace frontend
	npm run lint --workspace frontend

ci: ## run local equivalent of GitHub CI
	npm run typecheck
	npm run test:smoke
	npm run test:http
	npm run build --workspace frontend
