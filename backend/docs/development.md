# Development Guide

This guide explains how to set up and contribute to the SyntaxisAI backend.

## Development Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Copy `.env.example` to `.env` and set environment variables.
4. Start the development server:
   ```bash
   npm run dev
   ```

## Docker Development

### Prerequisites
- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)

### Services
The project includes Docker services for:
- **PostgreSQL** - Database server (port 5432)
- **Redis** - Cache and session store (port 6379)
- **MailHog** - Email testing tool (SMTP: 1025, Web UI: 8025)

### Docker Commands

Start all services:
```bash
docker-compose up -d
```

Stop all services:
```bash
docker-compose down
```

View service logs:
```bash
docker-compose logs -f
```

Check service status:
```bash
docker-compose ps
```

### Available Scripts for Docker

- `npm run docker:up` – Start Docker services
- `npm run docker:down` – Stop Docker services  
- `npm run docker:logs` – View service logs

## Available Scripts

See the table in the main README for full details. Common commands:

- `npm run dev` – Live-reload server using **nodemon**
- `npm run lint` – Lint codebase with ESLint
- `npm run format` – Format code with Prettier
- `npm test` – Run unit, integration, and e2e tests
- `npm run build` – Build TypeScript project to `dist`

## Code Style

This project follows the Airbnb/Prettier style guides enforced by ESLint and Prettier. Run `npm run lint:fix` before committing.

## Git Hooks

Git hooks are configured with Husky to automatically lint and test code before commits and pushes. 