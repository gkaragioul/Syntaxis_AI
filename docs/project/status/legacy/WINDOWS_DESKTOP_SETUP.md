# SyntaxisAI - Windows Desktop Application Setup

This guide explains how to run SyntaxisAI as a standalone Windows desktop application that can be moved to any PC.

## Prerequisites

You need to install **Node.js** on your Windows PC. This is a one-time setup.

### Step 1: Install Node.js

1. Download Node.js from: https://nodejs.org/
2. Choose the **LTS (Long Term Support)** version
3. Run the installer and follow the default installation steps
4. Verify installation by opening Command Prompt and typing:
   ```
   node --version
   npm --version
   ```

## Running the Application

### Option 1: Using the Batch File (Easiest)

1. Navigate to the `frontend` folder
2. Double-click `start-app.bat`
3. Two command windows will open:
   - One for the backend server
   - One for the frontend application
4. Wait 10-15 seconds for the application to fully load
5. Your default browser will open to `http://localhost:5174`

### Option 2: Using PowerShell Script

1. Open PowerShell as Administrator
2. Navigate to the `frontend` folder
3. Run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   .\start-app.ps1
   ```
4. Two PowerShell windows will open
5. Wait for the application to load

### Option 3: Manual Start (Advanced)

If the batch/PowerShell scripts don't work:

1. Open Command Prompt (or PowerShell)
2. Navigate to the backend folder:
   ```
   cd backend
   npm run dev
   ```
3. Open another Command Prompt window
4. Navigate to the frontend folder:
   ```
   cd frontend
   npm run dev
   ```
5. Wait for both to start, then open your browser to `http://localhost:5174`

## Accessing the Application

Once running, the application is available at:
- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3000

## Stopping the Application

Simply close the command windows where the servers are running.

## Moving to Another PC

To run this application on another Windows PC:

1. Copy the entire `SyntaxisAI` folder to the new PC
2. Install Node.js on the new PC (if not already installed)
3. Run `start-app.bat` or `start-app.ps1` from the `frontend` folder
4. The application will work exactly the same way

## Troubleshooting

### "Node.js is not installed"
- Install Node.js from https://nodejs.org/
- Restart your computer after installation
- Try running the script again

### Port Already in Use
If you get an error about ports 3000 or 5174 being in use:
- Close any other applications using those ports
- Or modify the port numbers in the scripts

### Application Won't Start
1. Open Command Prompt
2. Navigate to the `frontend` folder
3. Run: `npm install`
4. Then try running `start-app.bat` again

### Slow to Load
- The first time you run the app, it may take 30-60 seconds to fully load
- Subsequent runs will be faster
- Make sure you have at least 2GB of free disk space

## System Requirements

- **OS**: Windows 10 or Windows 11
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: 2GB for Node.js and dependencies
- **Internet**: Not required after initial setup (app runs locally)

## Features

- ✅ Runs completely offline (no internet required)
- ✅ Portable - copy to any Windows PC
- ✅ No installation required
- ✅ Easy to start and stop
- ✅ Full access to all features

## Support

If you encounter issues:
1. Check the command window output for error messages
2. Ensure Node.js is properly installed
3. Try running `npm install` in both `backend` and `frontend` folders
4. Restart your computer and try again

