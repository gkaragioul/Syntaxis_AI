# SyntaxisAI - Windows Desktop Application Setup Guide

## Overview

SyntaxisAI is now configured to run as a standalone Windows desktop application. You can copy it to any Windows PC and it will work without any additional setup (except Node.js).

## What You Get

✅ **Portable Application** - Copy to any Windows PC  
✅ **No Installation Required** - Just run the batch file  
✅ **Offline Capable** - Works without internet  
✅ **Easy to Use** - Double-click to start  
✅ **Movable** - Works on any PC with Node.js  

## Initial Setup (First Time Only)

### Step 1: Install Node.js

1. Go to https://nodejs.org/
2. Download the **LTS (Long Term Support)** version
3. Run the installer
4. Accept default settings
5. Restart your computer

### Step 2: Verify Installation

Open Command Prompt and type:
```
node --version
npm --version
```

You should see version numbers. If not, Node.js wasn't installed correctly.

## Running the Application

### Method 1: Batch File (Recommended)

1. Navigate to the `frontend` folder
2. Double-click `start-app.bat`
3. Two command windows will open
4. Wait 10-15 seconds
5. Your browser will open to http://localhost:5174

### Method 2: PowerShell Script

1. Open PowerShell as Administrator
2. Navigate to the `frontend` folder
3. Run: `.\start-app.ps1`
4. Follow the prompts

### Method 3: Desktop Shortcut

1. In the `frontend` folder, right-click `create-shortcut.vbs`
2. Select "Run with CScript"
3. A shortcut will appear on your desktop
4. Double-click it anytime to launch the app

## File Structure

```
SyntaxisAI/
├── frontend/
│   ├── start-app.bat              ← Main launcher
│   ├── start-app.ps1              ← PowerShell launcher
│   ├── create-shortcut.vbs         ← Creates desktop shortcut
│   ├── DESKTOP_APP_README.md       ← Quick start guide
│   ├── src/                        ← React application code
│   ├── dist/                       ← Built frontend (created on first run)
│   └── node_modules/               ← Dependencies
├── backend/
│   ├── src/                        ← Backend code
│   ├── dist/                       ← Built backend
│   └── node_modules/               ← Dependencies
└── WINDOWS_DESKTOP_SETUP.md        ← Detailed setup guide
```

## How It Works

When you run `start-app.bat`:

1. **Backend Server** starts on port 3000
   - Handles invoice processing
   - Manages data storage
   - Provides API endpoints

2. **Frontend Server** starts on port 5174
   - Serves the user interface
   - Handles file uploads
   - Displays results

3. **Browser** opens automatically
   - Shows the application interface
   - Ready to use

## Accessing the Application

- **Main App**: http://localhost:5174
- **Backend API**: http://localhost:3000/health

## Stopping the Application

Simply close the command windows. Both servers will stop.

## Moving to Another PC

### On the New PC:

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/
   - Install with default settings

2. **Copy the SyntaxisAI folder**
   - Copy the entire folder to the new PC
   - Can be on Desktop, Documents, or anywhere

3. **Run the Application**
   - Double-click `start-app.bat` in the `frontend` folder
   - That's it!

## Troubleshooting

### Issue: "Node.js is not installed"
**Solution**: 
- Install Node.js from https://nodejs.org/
- Restart your computer
- Try again

### Issue: "Port 3000 or 5174 already in use"
**Solution**:
- Close other applications using those ports
- Or modify the port numbers in the batch file

### Issue: Application won't start
**Solution**:
1. Open Command Prompt
2. Navigate to `frontend` folder
3. Run: `npm install`
4. Try `start-app.bat` again

### Issue: Slow to load first time
**Solution**:
- First run takes 30-60 seconds
- Subsequent runs are faster
- Make sure you have 2GB free disk space

### Issue: Browser doesn't open automatically
**Solution**:
- Manually open http://localhost:5174 in your browser
- The app should be running in the command windows

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | Windows 10 | Windows 11 |
| RAM | 4GB | 8GB |
| Disk Space | 2GB | 5GB |
| Internet | Not required | Not required |

## Features

- 🚀 **Fast** - Runs locally, no network latency
- 🔒 **Secure** - Your data stays on your computer
- 📦 **Portable** - Works on any Windows PC
- 🔌 **Offline** - No internet connection needed
- 💾 **Persistent** - Data saved locally
- 🎯 **Easy** - Just double-click to start

## Advanced: Customization

### Change Default Port

Edit `start-app.bat` and modify:
```batch
set PORT=3000
```

### Run in Background

Use Task Scheduler to run `start-app.bat` automatically on startup.

### Create Installer

Use electron-builder (already configured) to create an installer:
```
cd frontend
npm run electron:build
```

## Support

For detailed information, see:
- `frontend/DESKTOP_APP_README.md` - Quick start
- `WINDOWS_DESKTOP_SETUP.md` - Detailed setup
- Main `README.md` - Project overview

## Next Steps

1. ✅ Install Node.js
2. ✅ Run `start-app.bat`
3. ✅ Start using the application
4. ✅ Copy to other PCs as needed

---

**You're all set!** 🎉 Your SyntaxisAI desktop application is ready to use.

