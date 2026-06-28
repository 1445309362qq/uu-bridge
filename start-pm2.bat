@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 读 .env
for /f "tokens=1,2 delims==" %%a in (.env) do set %%a=%%b

echo 🚀 启动 uu 桥接（pm2 守护）...
call npx pm2 delete uu-bridge 2>nul
call npx pm2 start ecosystem.config.cjs --env .env
call npx pm2 save
echo.
echo ✅ uu 已在后台运行，关闭终端也不会停
echo.
echo 常用命令:
echo   查看状态: npx pm2 status
echo   查看日志: npx pm2 logs uu-bridge
echo   停止服务: npx pm2 stop uu-bridge
echo   重启服务: npx pm2 restart uu-bridge
pause
