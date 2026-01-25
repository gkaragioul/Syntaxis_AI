' Create Desktop Shortcut for SyntaxisAI
' This script creates a desktop shortcut to easily launch the application

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Get the current script directory
strScriptPath = WScript.ScriptFullName
Set objFile = objFSO.GetFile(strScriptPath)
strScriptDir = objFile.ParentFolder.Path

' Get desktop path
strDesktop = objShell.SpecialFolders("Desktop")

' Create shortcut
strShortcutPath = strDesktop & "\SyntaxisAI.lnk"
Set objLink = objShell.CreateShortcut(strShortcutPath)

' Set shortcut properties
objLink.TargetPath = strScriptDir & "\start-app.bat"
objLink.WorkingDirectory = strScriptDir
objLink.Description = "SyntaxisAI - Invoice Extraction Platform"
objLink.WindowStyle = 1

' Try to set icon (optional)
objLink.IconLocation = strScriptDir & "\src\favicon.ico"

' Save the shortcut
objLink.Save

' Show confirmation
MsgBox "Desktop shortcut created successfully!" & vbCrLf & vbCrLf & "You can now double-click 'SyntaxisAI' on your desktop to launch the application.", vbInformation, "SyntaxisAI Shortcut"

