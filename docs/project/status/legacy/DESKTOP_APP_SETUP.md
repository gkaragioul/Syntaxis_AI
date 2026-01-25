# SyntaxisAI - Standalone Windows Desktop Application

This document explains how to build and deploy SyntaxisAI as a standalone Windows desktop application using Electron.

## Overview

SyntaxisAI has been converted to a modern Electron-based desktop application that:
- Runs as a standalone Windows executable
- Includes both frontend (React) and backend (Node.js) in a single package
- Requires no external dependencies or setup
- Can be distributed as a portable executable or installer
- Works offline with local SQLite database

## Quick Start

### Prerequisites

1. **Node.js 18+** - Download from https://nodejs.org/
2. **Windows 10/11** - For building and running the app
3. **Git** (optional) - For version control

### Build Steps

1. **Install Dependencies**
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. **Prepare Icons** (Optional but recommended)
   - Place `icon.png` (512x512) and `icon.ico` (256x256) in `frontend/assets/`
   - Or run: `cd frontend && npm run generate:icon`

3. **Build Backend**
   ```bash
   cd backend
   npm run build
   ```

4. **Build Desktop App**
   ```bash
   cd frontend
   npm run electron:build:portable
   ```

5. **Find Your App**
   - Output: `frontend/dist-app/SyntaxisAI-x.x.x-portable.exe`
   - This is a standalone executable - no installation needed!

## Build Options

### Portable Executable (Recommended)
```bash
cd frontend
npm run electron:build:portable
```
- Single `.exe` file
- No installation required
- Can run from USB drive
- Easy to distribute

### NSIS Installer
```bash
cd frontend
npm run electron:build:installer
```
- Professional installer experience
- Desktop shortcuts
- Start menu entries
- Uninstall support

### Both Formats
```bash
cd frontend
npm run electron:build:all
```

### Interactive Build Menu
```bash
cd frontend
# Windows Command Prompt
build-desktop.bat

# Or PowerShell
.\build-desktop.ps1
```

## Development

### Run in Development Mode
```bash
cd frontend
npm run electron:dev
```

This starts:
- Vite dev server on http://localhost:5174
- Electron app with hot reload
- DevTools for debugging

### Project Structure
```
frontend/
├── electron/
│   ├── main.ts          # Main Electron process
│   ├── preload.ts       # IPC bridge
│   ├── utils.ts         # Utilities
│   └── logger.ts        # Logging
├── src/                 # React app
├── assets/              # Icons
└── dist-app/            # Built app (output)

backend/
├── src/                 # Express server
├── dist/                # Compiled backend
└── .env.production      # Production config
```

## Configuration

### Backend Port
Default: 3001

To change:
1. Edit `frontend/electron/main.ts` - change `BACKEND_PORT`
2. Edit `backend/.env.production` - change `PORT`

### Database
- Type: SQLite (for portability)
- Location: `./data/syntaxis.db`
- Stored in app's user data directory

### Environment Variables
Edit `backend/.env.production`:
```
NODE_ENV=production
PORT=3001
DATABASE_URL=file:./data/syntaxis.db
CORS_ORIGIN=http://localhost:5174,file://
```

## Deployment

### For End Users

1. **Portable Executable**
   - Download `SyntaxisAI-x.x.x-portable.exe`
   - Double-click to run
   - No installation needed

2. **Installer**
   - Download `SyntaxisAI-x.x.x.exe`
   - Run installer
   - App installed to Program Files
   - Desktop shortcut created

### Distribution

- Host the `.exe` file on your website
- Use cloud storage (Google Drive, OneDrive, etc.)
- Distribute via USB drive
- Include in software packages

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
cd frontend
npm run clean
npm install
npm run build
npm run electron:build:portable
```

### Icons Not Showing
1. Verify `frontend/assets/icon.png` exists (512x512)
2. Verify `frontend/assets/icon.ico` exists (256x256)
3. Rebuild the app

### Backend Won't Start
1. Check backend build: `cd backend && npm run build`
2. Verify `.env.production` exists
3. Check logs in `%APPDATA%/SyntaxisAI/logs/`

### Port Already in Use
1. Change `BACKEND_PORT` in `frontend/electron/main.ts`
2. Update `PORT` in `backend/.env.production`
3. Rebuild

## Features

✅ Standalone executable - no installation required
✅ Portable - works from USB drive
✅ Offline capable - uses local SQLite database
✅ Modern UI - React with Tailwind CSS
✅ Powerful backend - Express.js with OCR support
✅ Logging - comprehensive application logs
✅ Error handling - graceful error recovery
✅ Professional installer - NSIS support

## File Locations

### Application Data
- Windows: `%APPDATA%/SyntaxisAI/`

### Logs
- Windows: `%APPDATA%/SyntaxisAI/logs/app.log`

### Database
- Windows: `%APPDATA%/SyntaxisAI/data/syntaxis.db`

### Uploads
- Windows: `%APPDATA%/SyntaxisAI/uploads/`

## Version Management

Update version in `frontend/package.json`:
```json
{
  "version": "1.0.0"
}
```

Version is automatically included in executable name.

## Next Steps

1. ✅ Customize app icon
2. ✅ Update app name and version
3. ✅ Configure backend settings
4. ✅ Test portable executable
5. ✅ Build installer
6. ✅ Distribute to users

## Documentation

- **Build Guide**: `frontend/ELECTRON_BUILD_GUIDE.md`
- **Icon Setup**: `frontend/assets/README.md`
- **Main Process**: `frontend/electron/main.ts`
- **Backend Config**: `backend/.env.production`

## Support

For detailed information:
- Electron docs: https://www.electronjs.org/docs
- electron-builder: https://www.electron.build/
- Express.js: https://expressjs.com/
- React: https://react.dev/

## License

See LICENSE file in the root directory.

