# SyntaxisAI Desktop App Build Script (PowerShell)
# This script builds the Electron desktop application

Write-Host ""
Write-Host "========================================"
Write-Host "SyntaxisAI Desktop App Builder"
Write-Host "========================================"
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion"
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH"
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion"
} catch {
    Write-Host "Error: npm is not installed or not in PATH"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if icons exist
if (-not (Test-Path "assets\icon.png")) {
    Write-Host "Warning: icon.png not found in assets directory"
    Write-Host "Please add icon.png (512x512 PNG) to the assets folder"
    Write-Host ""
}

if (-not (Test-Path "assets\icon.ico")) {
    Write-Host "Warning: icon.ico not found in assets directory"
    Write-Host "Please add icon.ico (256x256 ICO) to the assets folder"
    Write-Host ""
}

# Menu
Write-Host "Select build type:"
Write-Host "1. Portable Executable (Recommended - single .exe file)"
Write-Host "2. NSIS Installer (Professional installer)"
Write-Host "3. Both Portable and Installer"
Write-Host "4. Development Mode (with hot reload)"
Write-Host "5. Exit"
Write-Host ""

$choice = Read-Host "Enter your choice (1-5)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Building portable executable..."
        npm run electron:build:portable
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed!"
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Host ""
        Write-Host "Build complete! Output: dist-app\SyntaxisAI-*-portable.exe"
        Read-Host "Press Enter to exit"
    }
    "2" {
        Write-Host ""
        Write-Host "Building NSIS installer..."
        npm run electron:build:installer
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed!"
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Host ""
        Write-Host "Build complete! Output: dist-app\SyntaxisAI-*.exe"
        Read-Host "Press Enter to exit"
    }
    "3" {
        Write-Host ""
        Write-Host "Building both portable and installer..."
        npm run electron:build:all
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed!"
            Read-Host "Press Enter to exit"
            exit 1
        }
        Write-Host ""
        Write-Host "Build complete! Output files in dist-app\"
        Read-Host "Press Enter to exit"
    }
    "4" {
        Write-Host ""
        Write-Host "Starting development mode..."
        Write-Host "Press Ctrl+C to stop"
        Write-Host ""
        npm run electron:dev
    }
    "5" {
        Write-Host "Exiting..."
        exit 0
    }
    default {
        Write-Host "Invalid choice!"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

