# SyntaxisAI Frontend

Modern React.js application for the SyntaxisAI invoice processing platform. Built with TypeScript, React Query, and Tailwind CSS for a responsive and accessible user interface.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn package manager

### Development Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Configure environment variables in `.env`:
   ```bash
   VITE_API_URL=http://localhost:3001/api/v1
   VITE_APP_NAME=SyntaxisAI
   VITE_APP_VERSION=1.0.0
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000 in your browser

## 🏗️ Architecture

### Technology Stack
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **React Query** - Server state management and caching
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Modern icon library
- **React Hook Form** - Performant form handling

### Project Structure
```
frontend/src/
├── components/          # Reusable UI components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── services/           # API services and utilities
├── utils/              # Helper functions
├── types/              # TypeScript type definitions
├── contexts/           # React contexts
└── __tests__/          # Test files
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- InvoiceList.test.tsx
```

### Testing Strategy
- **Unit Tests** - Component logic and utilities
- **Integration Tests** - Component interactions
- **Accessibility Tests** - WCAG compliance
- **Visual Regression Tests** - UI consistency

## 🎨 UI Components

### Core Components
- **InvoiceList** - Paginated invoice listing with filtering
- **InvoiceDetail** - Detailed invoice view with editing
- **FileUpload** - Drag-and-drop file upload with progress
- **Login/Register** - Authentication forms
- **Dashboard** - Main application dashboard

### Design System
- **Colors** - Consistent color palette
- **Typography** - Readable font hierarchy
- **Spacing** - Consistent spacing scale
- **Components** - Reusable UI components

## 🔧 Build and Deployment

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Environment Configuration
- **Development** - `.env.development`
- **Staging** - `.env.staging`
- **Production** - `.env.production`

## 📱 Features

### Invoice Management
- Upload invoices via drag-and-drop
- View invoice processing status
- Edit extracted invoice data
- Export to Excel/CSV formats

### User Interface
- Responsive design for all devices
- Dark/light theme support
- Accessibility compliance (WCAG 2.1)
- Real-time updates via WebSocket

### Authentication
- JWT-based authentication
- Secure login/logout
- Password reset functionality
- Session management

## 🔒 Security

### Frontend Security Measures
- **XSS Protection** - Content Security Policy
- **CSRF Protection** - Token-based protection
- **Input Validation** - Client-side validation
- **Secure Storage** - Encrypted local storage

## 📚 Documentation

- [Component Documentation](./src/components/README.md)
- [API Integration](./src/services/README.md)
- [Testing Guide](./src/__tests__/README.md)
- [Deployment Guide](../docs/deployment/frontend.md)

## Project Status

SyntaxisAI has been cancelled and archived. This frontend remains available as historical source code, but it is not actively maintained or production-supported.

## 🤝 Contributing

1. Follow the coding standards
2. Write tests for new features
3. Update documentation
4. Submit pull requests

## 📄 License

Original SyntaxisAI source code is MIT licensed. See [LICENSE](../LICENSE) for details. Third-party dependencies keep their own licenses; see [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
