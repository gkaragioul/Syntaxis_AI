# SyntaxisAI Electron Desktop App - Build Guide

This guide explains how to build and deploy SyntaxisAI as a standalone Windows desktop application using Electron.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Windows 10/11 (for building Windows executables)
- Git (for version control)

## Project Structure

```
frontend/
├── electron/
│   ├── main.ts          # Main Electron process
│   ├── preload.ts       # Preload script for IPC
│   ├── utils.ts         # Utility functions
│   └── logger.ts        # Logging utility
├── src/                 # React application source
├── assets/              # Application icons and assets
├── dist/                # Built React app (generated)
├── dist-electron/       # Compiled Electron files (generated)
└── dist-app/            # Final packaged app (generated)
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Prepare Application Icons

The app requires two icon files in the `frontend/assets/` directory:

- **icon.png** (512x512 or larger, PNG format)
- **icon.ico** (256x256 or larger, ICO format)

#### Generate Icons

Option A: Using an online tool
1. Visit https://www.favicon-generator.org/
2. Create or upload your icon
3. Download icon.png and icon.ico
4. Place them in `frontend/assets/`

Option B: Using ImageMagick
```bash
# First create icon.png (512x512)
# Then convert to ICO:
magick convert frontend/assets/icon.png -define icon:auto-resize=256,128,96,64,48,32,16 frontend/assets/icon.ico
```

Option C: Using the generation script
```bash
cd frontend
npm run generate:icon
```

### 3. Build the Backend

```bash
cd backend
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

## Building the Application

### Development Mode

Run the app in development with hot reload:

```bash
cd frontend
npm run electron:dev
```

This will:
- Start the Vite dev server on http://localhost:5174
- Launch the Electron app
- Open DevTools for debugging

### Production Build - Portable Executable (Recommended)

Build a standalone portable executable that doesn't require installation:

```bash
cd frontend
npm run electron:build:portable
```

Output: `frontend/dist-app/SyntaxisAI-x.x.x-portable.exe`

**Advantages:**
- Single executable file
- No installation required
- Can be run from USB drive or any location
- Easy to distribute

### Production Build - NSIS Installer

Build a Windows installer:

```bash
cd frontend
npm run electron:build:installer
```

Output: `frontend/dist-app/SyntaxisAI-x.x.x.exe` (installer)

**Advantages:**
- Professional installer experience
- Desktop shortcuts
- Start menu entries
- Uninstall support

### Production Build - Both Formats

Build both portable and installer versions:

```bash
cd frontend
npm run electron:build:all
```

## Build Output

After building, you'll find the packaged app in `frontend/dist-app/`:

```
dist-app/
├── SyntaxisAI-x.x.x-portable.exe    # Portable executable
├── SyntaxisAI-x.x.x.exe             # Installer
└── builder-effective-config.yaml    # Build configuration (debug)
```

## Deployment

### Portable Executable

1. Copy `SyntaxisAI-x.x.x-portable.exe` to your distribution location
2. Users can run it directly without installation
3. Can be placed on USB drives or network shares

### NSIS Installer

1. Distribute `SyntaxisAI-x.x.x.exe`
2. Users run the installer
3. App is installed to Program Files
4. Desktop and Start Menu shortcuts are created

## Configuration

### Environment Variables

The app uses `.env.production` for production configuration:

```
NODE_ENV=production
PORT=3001
DATABASE_URL=file:./data/syntaxis.db
CORS_ORIGIN=http://localhost:5174,file://
```

### Backend Port

The backend runs on port 3001 by default. To change:

1. Edit `frontend/electron/main.ts` - change `BACKEND_PORT`
2. Edit `backend/.env.production` - change `PORT`

### Database

By default, SQLite is used for portability:
- Database file: `./data/syntaxis.db`
- Located in the app's user data directory

## Troubleshooting

### Build Fails

1. Ensure all dependencies are installed: `npm install`
2. Check Node.js version: `node --version` (should be 18+)
3. Clear cache: `npm run clean` (if available)
4. Rebuild: `npm run build`

### Icons Not Showing

1. Verify icon files exist in `frontend/assets/`
2. Check file names: `icon.png` and `icon.ico`
3. Ensure icon.ico is in proper ICO format
4. Rebuild the app

### Backend Not Starting

1. Check backend build: `cd backend && npm run build`
2. Verify `.env.production` exists and is configured
3. Check logs in app's user data directory
4. Run backend separately to test: `cd backend && npm start`

### Port Already in Use

If port 3001 is already in use:
1. Change `BACKEND_PORT` in `frontend/electron/main.ts`
2. Update `PORT` in `backend/.env.production`
3. Rebuild the app

## Development Tips

### Enable DevTools in Production

Edit `frontend/electron/main.ts` and change:
```typescript
if (isDev) {
  mainWindow.webContents.openDevTools();
}
```

To:
```typescript
mainWindow.webContents.openDevTools();
```

### View Application Logs

Logs are stored in the app's user data directory:
- Windows: `%APPDATA%/SyntaxisAI/logs/`

### Debug Backend

The backend logs are printed to the console when running in development mode.

## Version Management

Update the version in `frontend/package.json`:

```json
{
  "version": "1.0.0"
}
```

The version is automatically included in the executable name.

## Next Steps

1. Customize the app icon
2. Update the app name and version
3. Configure backend settings
4. Test the portable executable
5. Distribute to users

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Electron documentation: https://www.electronjs.org/docs
3. Check electron-builder docs: https://www.electron.build/

