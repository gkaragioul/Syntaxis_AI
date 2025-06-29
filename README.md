# SyntaxisAI - Invoice Extraction Platform

A specialized SaaS tool that converts invoice PDFs into clean Excel/CSV data with 100% accuracy.

## Table of Contents

1. [Quick Start](#-quick-start)
2. [Project Structure](#️-project-structure)
3. [Testing](#-testing)
4. [Documentation](#-documentation)
5. [Security](#-security)
6. [License](#-license)

## 🚀 Quick Start

### Getting Started

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL >= 14
- Git

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/syntaxis-ai.git
cd syntaxis-ai
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy example env files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

4. Start development servers:
```bash
npm run dev
```

### Usage Instructions

Once the development servers are running:
1. Open http://localhost:3000 in your browser
2. Create an account or log in
3. Upload PDF invoices using the drag-and-drop interface
4. Monitor processing status in real-time
5. Download extracted data as Excel/CSV files

## 🏗️ Project Structure

```
syntaxis-ai/
├── frontend/                 # React.js application
├── backend/                  # Node.js/Express API
├── database/                 # Database scripts
└── docs/                     # Documentation
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run frontend tests
npm test --workspace=frontend

# Run backend tests
npm test --workspace=backend
```

## 📚 Documentation

- [API Documentation](./docs/api/README.md)
- [Development Guide](./docs/development/README.md)
- [Testing Guidelines](./docs/testing/README.md)

## 🔒 Security

This project follows strict security practices:
- All dependencies are regularly audited
- Authentication uses JWT with secure practices
- File uploads are strictly validated
- Rate limiting is implemented on all endpoints

## 📄 License

MIT License - see [LICENSE](LICENSE) for details 