# 🔨 SyntaxisAI - Build & Deployment Guide

## 📦 CURRENT BUILD STATUS

**Latest Build:** ✅ COMPLETE AND TESTED
- **Location**: `frontend/dist-app-build/win-unpacked/SyntaxisAI.exe`
- **Size**: ~210 MB
- **Status**: Fully functional with all features
- **Last Built**: 2025-11-05

---

## 🏗️ BUILD PROCESS

### Prerequisites
```bash
# Install Node.js (v18+)
# Install npm (comes with Node.js)
```

### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

### Step 2: Build Frontend
```bash
npm run build
```

### Step 3: Build Electron
```bash
npm run build:electron
```

### Step 4: Create Executable

**Option A: Win-Unpacked (Recommended for Testing)**
```bash
npm run electron:build:unpacked
```
Output: `frontend/dist-app-build/win-unpacked/SyntaxisAI.exe`

**Option B: Portable Executable**
```bash
npm run electron:build:portable
```
Output: `frontend/dist-app-build/SyntaxisAI-0.1.0-portable.exe`

**Option C: Full Build (All Formats)**
```bash
npm run electron:build
```

---

## 📋 BUILD SCRIPTS REFERENCE

```json
{
  "build": "tsc && vite build",
  "build:electron": "npm run build && tsc --project tsconfig.electron.json",
  "dev": "vite",
  "electron:dev": "npm run build:electron && electron .",
  "electron:build:unpacked": "npm run build:electron && electron-builder --win --dir",
  "electron:build:portable": "npm run build:electron && electron-builder --win portable",
  "electron:build": "npm run build:electron && electron-builder --win"
}
```

---

## 🎯 DEPLOYMENT OPTIONS

### Option 1: Direct Distribution (Recommended)
**File**: `frontend/dist-app-build/win-unpacked/SyntaxisAI.exe`

**Advantages:**
- Single executable file
- No installation required
- Works on any Windows PC
- Easy to move between computers

**Distribution:**
1. Copy `win-unpacked` folder to USB drive
2. User double-clicks `SyntaxisAI.exe`
3. App runs immediately

### Option 2: Portable Executable
**File**: `frontend/dist-app-build/SyntaxisAI-0.1.0-portable.exe`

**Advantages:**
- Single .exe file (compressed)
- Smaller file size
- No folder dependencies

**Distribution:**
1. Copy .exe file to USB drive
2. User double-clicks .exe
3. App runs immediately

### Option 3: Windows Installer (Future)
```bash
npm run electron:build:msi
```
Creates: `SyntaxisAI-0.1.0.msi`

---

## 🔄 REBUILD INSTRUCTIONS

### Quick Rebuild (After Code Changes)
```bash
cd frontend
npm run build:electron
npm run electron:build:unpacked
```

### Full Clean Rebuild
```bash
cd frontend
rm -r dist dist-electron dist-app-build node_modules
npm install
npm run build:electron
npm run electron:build:unpacked
```

### Rebuild Portable Only
```bash
cd frontend
npm run electron:build:portable
```

---

## 📊 BUILD OUTPUT STRUCTURE

```
frontend/dist-app-build/
├── win-unpacked/                    # Unpacked app (recommended)
│   ├── SyntaxisAI.exe              # Main executable
│   ├── resources/
│   │   ├── app/                    # App files
│   │   │   ├── dist/               # React build
│   │   │   ├── dist-electron/      # Electron build
│   │   │   └── package.json
│   │   └── ...
│   └── ...
├── SyntaxisAI-0.1.0-portable.exe   # Portable executable
└── builder-effective-config.yaml   # Build configuration
```

---

## 🔍 VERIFICATION CHECKLIST

After building, verify:

- [ ] Executable file exists
- [ ] File size is reasonable (~200+ MB)
- [ ] App launches without errors
- [ ] Sample data loads
- [ ] Data directory created at `%APPDATA%/@syntaxis-ai/frontend/`
- [ ] All features work (upload, export, etc.)
- [ ] Logs are created at `%APPDATA%/@syntaxis-ai/frontend/logs/app.log`

---

## 🐛 TROUBLESHOOTING BUILD ISSUES

### Issue: "Cannot find module" errors
**Solution:**
```bash
npm install
npm run build:electron
```

### Issue: TypeScript compilation errors
**Solution:**
```bash
npx tsc --project tsconfig.electron.json
```

### Issue: Electron-builder fails
**Solution:**
```bash
npm install -g electron-builder
npm run electron:build:unpacked
```

### Issue: Port already in use
**Solution:**
- Kill existing SyntaxisAI processes
- Restart your computer

---

## 📈 PERFORMANCE OPTIMIZATION

### Current Optimizations
- ✅ Vite for fast builds
- ✅ Tree-shaking for smaller bundle
- ✅ Code splitting for faster loading
- ✅ Tailwind CSS purging
- ✅ Electron asar disabled for faster startup

### Future Optimizations
- [ ] Enable asar for smaller package
- [ ] Add code minification
- [ ] Implement lazy loading
- [ ] Add service workers for offline support

---

## 🚀 DISTRIBUTION CHECKLIST

Before distributing:

- [ ] Test on clean Windows PC
- [ ] Verify all features work
- [ ] Check data persistence
- [ ] Test file upload with real PDFs
- [ ] Verify export functionality
- [ ] Check error handling
- [ ] Review logs for warnings
- [ ] Document any known issues

---

## 📝 VERSION MANAGEMENT

**Current Version**: 0.1.0

To update version:
1. Edit `frontend/package.json` - change `"version": "0.1.0"`
2. Rebuild with `npm run electron:build`
3. New executable will have updated version

---

## 🎓 BUILD NOTES

- **Build Time**: ~2-5 minutes (first build longer)
- **Disk Space**: ~500 MB for build artifacts
- **Node Version**: v18+ recommended
- **Windows Version**: Windows 10+ required

---

**Ready to deploy! 🚀**

