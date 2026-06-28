Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

cmd = "cd /d " & dir & " && npx tsx src/index.ts --char uu"
WshShell.Run "cmd /c " & cmd, 0, False
