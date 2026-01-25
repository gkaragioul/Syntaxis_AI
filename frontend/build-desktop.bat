@echo off
REM SyntaxisAI Desktop App Build Script
REM This script builds the Electron desktop application

setlocal enabledelayedexpansion

echo.
echo ========================================
echo SyntaxisAI Desktop App Builder
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo Error: npm is not installed or not in PATH
    pause
    exit /b 1
)

echo npm version:
npm --version
echo.

REM Check if icons exist
if not exist "assets\icon.png" (
    echo Warning: icon.png not found in assets directory
    echo Please add icon.png (512x512 PNG) to the assets folder
    echo.
)

if not exist "assets\icon.ico" (
    echo Warning: icon.ico not found in assets directory
    echo Please add icon.ico (256x256 ICO) to the assets folder
    echo.
)

REM Menu
echo Select build type:
echo 1. Portable Executable (Recommended - single .exe file)
echo 2. NSIS Installer (Professional installer)
echo 3. Both Portable and Installer
echo 4. Development Mode (with hot reload)
echo 5. Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Building portable executable...
    call npm run electron:build:portable
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
    echo.
    echo Build complete! Output: dist-app\SyntaxisAI-*-portable.exe
    pause
) else if "%choice%"=="2" (
    echo.
    echo Building NSIS installer...
    call npm run electron:build:installer
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
    echo.
    echo Build complete! Output: dist-app\SyntaxisAI-*.exe
    pause
) else if "%choice%"=="3" (
    echo.
    echo Building both portable and installer...
    call npm run electron:build:all
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
    echo.
    echo Build complete! Output files in dist-app\
    pause
) else if "%choice%"=="4" (
    echo.
    echo Starting development mode...
    echo Press Ctrl+C to stop
    echo.
    call npm run electron:dev
) else if "%choice%"=="5" (
    echo Exiting...
    exit /b 0
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

endlocal

