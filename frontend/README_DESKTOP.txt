================================================================================
                    SYNTAXISAI DESKTOP APPLICATION
================================================================================

QUICK START:
============

1. Make sure Node.js is installed:
   - Download from: https://nodejs.org/ (LTS version)
   - Install and restart your computer

2. Double-click: start-app.bat

3. Wait 10-15 seconds for the application to load

4. Your browser will open automatically to the application

================================================================================

WHAT TO DO:

Option A: EASIEST - Double-click start-app.bat
   - This is the recommended way to start the application
   - Two command windows will open
   - Your browser will open automatically

Option B: Create a Desktop Shortcut
   - Right-click: create-shortcut.vbs
   - Select: Run with CScript
   - A shortcut will appear on your desktop
   - Double-click it anytime to launch the app

Option C: PowerShell Script
   - Open PowerShell as Administrator
   - Run: .\start-app.ps1
   - Follow the prompts

================================================================================

SYSTEM REQUIREMENTS:

- Windows 10 or Windows 11
- Node.js (download from https://nodejs.org/)
- 4GB RAM minimum (8GB recommended)
- 2GB free disk space

================================================================================

MOVING TO ANOTHER PC:

1. Copy the entire SyntaxisAI folder to the new PC
2. Install Node.js on the new PC (if not already installed)
3. Double-click start-app.bat
4. Done! It works the same way

================================================================================

TROUBLESHOOTING:

Problem: "Node.js is not installed"
Solution: Install Node.js from https://nodejs.org/ and restart your computer

Problem: Application won't start
Solution: 
  - Open Command Prompt
  - Navigate to this folder (frontend)
  - Run: npm install
  - Try start-app.bat again

Problem: Port already in use
Solution: Close other applications using ports 3000 or 5174

Problem: Slow to load
Solution: First run takes 30-60 seconds. Subsequent runs are faster.

================================================================================

ACCESSING THE APPLICATION:

Frontend: http://localhost:5174
Backend:  http://localhost:3000

================================================================================

STOPPING THE APPLICATION:

Simply close the command windows. The application will stop.

================================================================================

FOR MORE INFORMATION:

- See: DESKTOP_APP_README.md (in this folder)
- See: ../DESKTOP_APP_SETUP_GUIDE.md (in parent folder)
- See: ../WINDOWS_DESKTOP_SETUP.md (in parent folder)

================================================================================

ENJOY USING SYNTAXISAI! 🚀

================================================================================

