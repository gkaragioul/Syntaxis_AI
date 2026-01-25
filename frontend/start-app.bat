@echo off
REM SyntaxisAI Desktop Application Launcher
REM This script starts both the backend and frontend servers

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set ROOT_DIR=%SCRIPT_DIR%..

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SyntaxisAI Desktop Application
echo ========================================
echo.

REM Start backend server
echo Starting backend server...
cd /d "%ROOT_DIR%\backend"
start "SyntaxisAI Backend" cmd /k npm run dev

REM Wait for backend to start
timeout /t 5 /nobreak

REM Start frontend
echo Starting frontend application...
cd /d "%SCRIPT_DIR%"
start "SyntaxisAI Frontend" cmd /k npm run dev

REM Wait a moment for frontend to start
timeout /t 3 /nobreak

echo.
echo ========================================
echo   Application Started!
echo ========================================
echo.
echo Frontend: http://localhost:5174
echo Backend:  http://localhost:3000
echo.
echo The application windows will open automatically.
echo Close these command windows to stop the application.
echo.
pause

