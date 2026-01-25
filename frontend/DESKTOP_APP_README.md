# SyntaxisAI Desktop Application

Welcome to SyntaxisAI! This is a standalone Windows desktop application for invoice extraction and processing.

## Quick Start (3 Steps)

### 1. Install Node.js (One-time setup)
- Download from: https://nodejs.org/ (LTS version)
- Install with default settings
- Restart your computer

### 2. Run the Application
- Double-click `start-app.bat` in this folder
- Wait 10-15 seconds for the app to load
- Your browser will open automatically

### 3. Start Using
- Upload PDF invoices
- Extract data automatically
- Download results

## Files in This Folder

| File | Purpose |
|------|---------|
| `start-app.bat` | Main launcher (double-click to start) |
| `start-app.ps1` | PowerShell launcher (alternative) |
| `create-shortcut.vbs` | Creates a desktop shortcut |
| `DESKTOP_APP_README.md` | This file |

## Creating a Desktop Shortcut

To make it even easier to launch:

1. Right-click `create-shortcut.vbs`
2. Select "Run with CScript"
3. A shortcut will be created on your desktop
4. Double-click the shortcut to launch the app anytime

## How It Works

When you run `start-app.bat`:
1. Backend server starts (processes invoices)
2. Frontend server starts (user interface)
3. Browser opens to the application
4. Everything runs locally on your computer

## Accessing the App

- **Main Application**: http://localhost:5174
- **Backend API**: http://localhost:3000

## Stopping the Application

Simply close the command windows. The application will stop.

## Moving to Another PC

1. Copy the entire `SyntaxisAI` folder to the new PC
2. Install Node.js on the new PC
3. Run `start-app.bat`
4. Done! It works the same way

## System Requirements

- Windows 10 or Windows 11
- 4GB RAM (8GB recommended)
- 2GB free disk space
- Node.js installed

## Troubleshooting

### App won't start
```
cd frontend
npm install
```
Then try `start-app.bat` again.

### Port already in use
Close other applications using ports 3000 or 5174.

### Node.js not found
Install Node.js from https://nodejs.org/ and restart your computer.

## Features

✅ Offline - no internet required  
✅ Portable - works on any Windows PC  
✅ Fast - runs locally  
✅ Secure - your data stays on your computer  
✅ Easy - just double-click to start  

## Support

For issues or questions, check the main README.md in the root folder.

---

**Enjoy using SyntaxisAI!** 🚀

