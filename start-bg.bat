@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 读 .env
for /f "tokens=1,2 delims==" %%a in (.env) do set %%a=%%b

echo 🚀 启动 uu 桥接（后台运行）...
start /B npx tsx src/index.ts --char uu > "%TEMP%\uu-bridge.log" 2>&1
echo ✅ uu 已在后台运行
echo    日志: %TEMP%\uu-bridge.log
echo    关闭此窗口不影响 uu
pause
