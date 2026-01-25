# 📁 SyntaxisAI - Project Structure

## 🏗️ COMPLETE PROJECT LAYOUT

```
SyntaxisAI/
├── frontend/                          # Main Electron app
│   ├── electron/                      # Electron main process
│   │   ├── main.ts                   # App initialization, IPC handlers
│   │   ├── preload.ts                # Secure API exposure
│   │   ├── logger.ts                 # Logging system
│   │   └── utils.ts                  # Utility functions
│   │
│   ├── src/                          # React frontend
│   │   ├── components/
│   │   │   ├── FileUpload/
│   │   │   │   ├── FileUploader.tsx  # PDF upload component
│   │   │   │   └── PDFPreview.tsx    # PDF preview display
│   │   │   ├── ErrorBoundary.tsx     # Error handling
│   │   │   └── ...
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx         # Main dashboard
│   │   │   ├── InvoiceList.tsx       # Invoice list view
│   │   │   ├── InvoiceDetail.tsx     # Invoice detail page
│   │   │   ├── InvoiceProcessor.tsx  # File upload page
│   │   │   └── ...
│   │   │
│   │   ├── services/
│   │   │   ├── invoiceStorage.ts     # Local storage operations
│   │   │   ├── localFileUploadService.ts  # File upload via IPC
│   │   │   ├── ocrService.ts         # OCR text extraction
│   │   │   ├── exportService.ts      # CSV/PDF export
│   │   │   └── ...
│   │   │
│   │   ├── utils/
│   │   │   ├── errorHandler.ts       # Error handling utilities
│   │   │   └── ...
│   │   │
│   │   ├── App.tsx                   # Main app component
│   │   ├── main.tsx                  # React entry point
│   │   └── index.css                 # Global styles
│   │
│   ├── dist/                         # React build output
│   │   ├── index.html
│   │   └── assets/
│   │
│   ├── dist-electron/                # Compiled Electron code
│   │   ├── main.js
│   │   ├── preload.js
│   │   └── ...
│   │
│   ├── dist-app-build/               # Final executable
│   │   ├── win-unpacked/             # ✅ RECOMMENDED BUILD
│   │   │   └── SyntaxisAI.exe        # Main executable
│   │   ├── SyntaxisAI-portable/      # Portable version
│   │   └── ...
│   │
│   ├── package.json                  # Dependencies & scripts
│   ├── tsconfig.json                 # TypeScript config
│   ├── tsconfig.electron.json        # Electron TypeScript config
│   ├── vite.config.ts                # Vite build config
│   ├── tailwind.config.cjs           # Tailwind CSS config
│   ├── postcss.config.cjs            # PostCSS config
│   └── index.html                    # HTML entry point
│
├── backend/                          # Backend (not used in desktop app)
│   ├── src/
│   ├── dist/
│   └── package.json
│
├── FINAL_BUILD_SUMMARY.md            # Feature overview
├── QUICK_START.md                    # User guide
├── BUILD_AND_DEPLOYMENT.md           # Build instructions
├── IMPLEMENTATION_COMPLETE.md        # Project completion summary
├── PROJECT_STRUCTURE.md              # This file
└── README.md                         # Main readme
```

---

## 📂 KEY DIRECTORIES EXPLAINED

### `frontend/electron/`
**Purpose**: Electron main process code
- **main.ts**: App initialization, window creation, IPC handlers
- **preload.ts**: Secure API bridge between main and renderer
- **logger.ts**: File-based logging system
- **utils.ts**: Helper functions for paths and utilities

### `frontend/src/components/`
**Purpose**: React UI components
- **FileUpload/**: PDF upload and preview components
- **ErrorBoundary.tsx**: Error handling wrapper
- Other reusable UI components

### `frontend/src/pages/`
**Purpose**: Full page components
- **Dashboard.tsx**: Main landing page
- **InvoiceList.tsx**: List all invoices
- **InvoiceDetail.tsx**: View/edit single invoice
- **InvoiceProcessor.tsx**: Upload PDF files

### `frontend/src/services/`
**Purpose**: Business logic and data operations
- **invoiceStorage.ts**: Read/write invoice data
- **localFileUploadService.ts**: File upload via IPC
- **ocrService.ts**: Text extraction from PDFs
- **exportService.ts**: CSV/PDF export functionality

### `frontend/dist-app-build/`
**Purpose**: Final executable outputs
- **win-unpacked/**: Uncompressed app (recommended)
- **SyntaxisAI-portable/**: Compressed portable version

---

## 🔄 DATA FLOW

```
User Action
    ↓
React Component (pages/components)
    ↓
Service Layer (services/)
    ↓
IPC Communication (electron/main.ts)
    ↓
File System Operations
    ↓
Local Storage (%APPDATA%/@syntaxis-ai/frontend/)
```

---

## 📊 FILE TYPES

| Type | Location | Purpose |
|------|----------|---------|
| TypeScript | `src/`, `electron/` | Source code |
| JavaScript | `dist/`, `dist-electron/` | Compiled code |
| JSON | `src/services/` | Data storage |
| CSS | `src/styles/`, `index.css` | Styling |
| HTML | `index.html` | Entry point |
| Config | Root directory | Build configuration |

---

## 🔧 BUILD OUTPUTS

### Development
```
npm run dev              → Vite dev server (http://localhost:5174)
npm run electron:dev    → Electron dev mode
```

### Production
```
npm run build           → React build (dist/)
npm run build:electron  → Electron build (dist-electron/)
npm run electron:build  → Full executable (dist-app-build/)
```

---

## 📦 DEPENDENCIES

### Core
- **electron**: Desktop framework
- **react**: UI library
- **typescript**: Type safety
- **vite**: Build tool

### Features
- **tesseract.js**: OCR
- **jspdf**: PDF export
- **papaparse**: CSV export
- **uuid**: ID generation
- **react-hot-toast**: Notifications

### Development
- **electron-builder**: Packaging
- **tailwindcss**: Styling
- **postcss**: CSS processing

---

## 🎯 IMPORTANT FILES

### Configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript settings
- `vite.config.ts` - Build configuration
- `tailwind.config.cjs` - Tailwind settings

### Entry Points
- `frontend/index.html` - HTML entry
- `frontend/src/main.tsx` - React entry
- `frontend/electron/main.ts` - Electron entry

### Main Logic
- `frontend/electron/main.ts` - App initialization
- `frontend/src/App.tsx` - React app root
- `frontend/src/services/invoiceStorage.ts` - Data operations

---

## 🚀 EXECUTABLE LOCATIONS

### Recommended (Win-Unpacked)
```
frontend/dist-app-build/win-unpacked/SyntaxisAI.exe
```

### Alternative (Portable)
```
frontend/dist-app-build/SyntaxisAI-0.1.0-portable.exe
```

---

## 📝 CONFIGURATION FILES

### `package.json`
- App name: `@syntaxis-ai/frontend`
- Version: `0.1.0`
- Main: `dist-electron/main.js`
- Build target: Windows portable

### `tsconfig.electron.json`
- Target: ES2020
- Module: CommonJS
- Output: `dist-electron/`

### `vite.config.ts`
- Base: `./`
- Build target: ES2020
- CSS: Tailwind + PostCSS

---

## 🔐 SECURITY FEATURES

- **Context Isolation**: Enabled
- **Preload Scripts**: Secure API exposure
- **IPC Validation**: Input validation
- **No Remote**: Disabled
- **Sandbox**: Enabled

---

## 📊 PROJECT STATISTICS

- **Total Files**: 100+
- **TypeScript Files**: 20+
- **React Components**: 15+
- **Services**: 5+
- **Lines of Code**: 5000+
- **Build Size**: ~210 MB
- **Dependencies**: 50+

---

## 🎓 ARCHITECTURE NOTES

1. **Separation of Concerns**
   - UI (React components)
   - Business Logic (services)
   - System Integration (Electron)

2. **Data Flow**
   - Unidirectional (React → Services → IPC → File System)
   - No circular dependencies

3. **Error Handling**
   - Try-catch blocks
   - Error boundaries
   - User-friendly messages

4. **Performance**
   - Code splitting
   - Lazy loading
   - Efficient re-renders

---

**Project structure is clean, organized, and production-ready! 🚀**

