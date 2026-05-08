<h1 align="center">SyntaxisAI</h1>

<p align="center">
  <strong>AI-powered invoice extraction platform for turning invoice PDFs into structured Excel/CSV data.</strong><br>
  <em>Version 0.2.0 with secure file handling, real-time processing status, role-based access, and export-ready accounting workflows.</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#development">Development</a> •
  <a href="#testing">Testing</a> •
  <a href="#license">License</a>
</p>
## Features

- **AI-Powered Extraction**: Intelligent parsing of invoice data using machine learning
- **Multi-Format Support**: Process various invoice formats and layouts
- **Real-Time Processing**: Live status updates during document processing
- **Export Options**: Download extracted data as Excel or CSV files
- **Secure File Handling**: Strict validation and secure storage of uploaded documents
- **User Management**: Role-based access control and authentication

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Development](#development)
4. [Testing](#testing)
5. [Documentation](#documentation)
6. [Security](#security)
7. [License](#license)

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/georgekgr12/SyntaxisAI.git
cd SyntaxisAI
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

4. Start development servers:
```bash
npm run dev
```

### Usage

Once the development servers are running:

1. Open http://localhost:3000 in your browser
2. Create an account or log in
3. Upload PDF invoices using the drag-and-drop interface
4. Monitor processing status in real-time
5. Download extracted data as Excel/CSV files

## Project Structure

```
SyntaxisAI/
├── frontend/          # React.js web application
├── backend/           # Node.js/Express API server
├── database/          # Database schemas and migrations
├── docs/              # Project documentation
├── scripts/           # Build and setup scripts
├── services/          # Microservices
├── apps/              # Additional applications
└── shared/            # Shared utilities and types
```

## Development

### Available Scripts

```bash
# Start all development servers
npm run dev

# Start frontend only
npm run dev:frontend

# Start backend only
npm run dev:backend

# Build all workspaces
npm run build

# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check

# Run all validation
npm run validate
```

### Docker Support

```bash
# Start containers
npm run docker:up

# Stop containers
npm run docker:down

# View logs
npm run docker:logs
```

## Testing

```bash
# Run all tests
npm test

# Run frontend tests
npm test --workspace=frontend

# Run backend tests
npm test --workspace=backend
```

## Documentation

- [API Documentation](./docs/api/README.md)
- [Development Guide](./docs/development/README.md)
- [Testing Guidelines](./docs/testing/README.md)

## Security

This project implements security best practices:

- Regular dependency audits
- JWT-based authentication with secure token handling
- Strict file upload validation
- Rate limiting on all API endpoints
- Environment-based configuration

## Tech Stack

- **Frontend**: React.js, TypeScript
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT
- **Build Tools**: Vite, ESLint, Prettier

## License

MIT License - see [LICENSE](LICENSE) for details
