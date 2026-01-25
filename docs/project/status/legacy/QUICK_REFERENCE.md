# SyntaxisAI Desktop App - Quick Reference

## Build Commands

### Development
```bash
cd frontend
npm run electron:dev
```
Starts dev server + Electron with hot reload

### Production - Portable (Recommended)
```bash
cd frontend
npm run electron:build:portable
```
Output: `dist-app/SyntaxisAI-x.x.x-portable.exe`

### Production - Installer
```bash
cd frontend
npm run electron:build:installer
```
Output: `dist-app/SyntaxisAI-x.x.x.exe`

### Production - Both
```bash
cd frontend
npm run electron:build:all
```

### Interactive Menu (Windows)
```bash
cd frontend
build-desktop.bat          # Command Prompt
.\build-desktop.ps1        # PowerShell
```

## Setup Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed: `npm install`
- [ ] Backend built: `cd backend && npm run build`
- [ ] Icons added: `frontend/assets/icon.png` + `icon.ico`
- [ ] Version updated: `frontend/package.json`
- [ ] Backend config: `backend/.env.production`

## File Locations

| Item | Location |
|------|----------|
| Main Process | `frontend/electron/main.ts` |
| Preload Script | `frontend/electron/preload.ts` |
| Utilities | `frontend/electron/utils.ts` |
| Logger | `frontend/electron/logger.ts` |
| Icons | `frontend/assets/` |
| Build Output | `frontend/dist-app/` |
| Backend Config | `backend/.env.production` |
| Build Guide | `frontend/ELECTRON_BUILD_GUIDE.md` |
| Setup Guide | `DESKTOP_APP_SETUP.md` |

## Configuration

### Backend Port
- File: `frontend/electron/main.ts`
- Variable: `BACKEND_PORT`
- Default: 3001

### Database
- Type: SQLite
- File: `./data/syntaxis.db`
- Location: `%APPDATA%/SyntaxisAI/data/`

### Logs
- Location: `%APPDATA%/SyntaxisAI/logs/app.log`
- Max Size: 10MB
- Rotation: 5 files

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | `npm install` + `npm run build` |
| Icons missing | Add `icon.png` + `icon.ico` to `frontend/assets/` |
| Backend won't start | Check `backend/.env.production` + `npm run build` |
| Port in use | Change `BACKEND_PORT` in `main.ts` |
| App won't launch | Check logs in `%APPDATA%/SyntaxisAI/logs/` |

## Key Files Modified

- ✅ `frontend/electron/main.ts` - Enhanced main process
- ✅ `frontend/electron/preload.ts` - Updated IPC
- ✅ `frontend/package.json` - Build config
- ✅ `frontend/tsconfig.node.json` - TypeScript config
- ✅ `backend/.env.production` - Desktop config

## Key Files Created

- ✅ `frontend/electron/utils.ts` - Utilities
- ✅ `frontend/electron/logger.ts` - Logger
- ✅ `frontend/build-desktop.bat` - Build script
- ✅ `frontend/build-desktop.ps1` - Build script
- ✅ `frontend/scripts/generate-icon.js` - Icon generator
- ✅ `frontend/assets/README.md` - Icon guide
- ✅ `frontend/ELECTRON_BUILD_GUIDE.md` - Build guide
- ✅ `DESKTOP_APP_SETUP.md` - Setup guide
- ✅ `ELECTRON_CONVERSION_SUMMARY.md` - Summary

## Environment Variables

### Production (.env.production)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=file:./data/syntaxis.db
CORS_ORIGIN=http://localhost:5174,file://
```

## Build Output Structure

```
frontend/dist-app/
├── SyntaxisAI-1.0.0-portable.exe    # Portable executable
├── SyntaxisAI-1.0.0.exe             # Installer
└── builder-effective-config.yaml    # Build config
```

## Distribution

### Portable Executable
- Single file: `SyntaxisAI-x.x.x-portable.exe`
- No installation needed
- Works from USB drive
- Easy to distribute

### Installer
- Single file: `SyntaxisAI-x.x.x.exe`
- Professional installer
- Desktop shortcuts
- Start menu entries

## Performance Tips

1. **Reduce Backend Workers**
   - Edit: `backend/.env.production`
   - Set: `OCR_WORKER_COUNT=2`

2. **Optimize Database**
   - Use SQLite for portability
   - Regular backups recommended

3. **Minimize App Size**
   - Remove unused dependencies
   - Use production builds

## Security Notes

- ✅ Context isolation enabled
- ✅ Node integration disabled
- ✅ Sandbox enabled
- ✅ Preload script for IPC
- ✅ No remote module access

## Version Management

Update in `frontend/package.json`:
```json
{
  "version": "1.0.0"
}
```

Version appears in:
- Executable name
- About dialog
- File properties

## Useful Links

- Electron: https://www.electronjs.org/
- electron-builder: https://www.electron.build/
- Express.js: https://expressjs.com/
- React: https://react.dev/
- Prisma: https://www.prisma.io/

## Support

For detailed information, see:
- `DESKTOP_APP_SETUP.md` - Quick start
- `frontend/ELECTRON_BUILD_GUIDE.md` - Build guide
- `ELECTRON_CONVERSION_SUMMARY.md` - Full summary

