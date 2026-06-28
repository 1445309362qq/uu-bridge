@echo off
chcp 65001 >nul
title WeChat Claude Bridge - uu 角色
cd /d "%~dp0"

echo ================================================
echo   WeChat Claude Bridge - 微信 Claude 接入桥
echo ================================================
echo.

REM 检查 node_modules
if not exist "node_modules\" (
    echo 📦 首次运行，正在安装依赖...
    call npm install
    echo.
)

REM 读取 .env 文件
if exist ".env" (
    for /f "tokens=*" %%a in (.env) do set %%a
)

REM 如果环境变量没设置 ANTHROPIC_API_KEY
if "%ANTHROPIC_API_KEY%"=="" (
    echo ❌ 请先设置 ANTHROPIC_API_KEY 环境变量
    echo    或在 .env 文件中填写你的 Claude API Key
    pause
    exit /b 1
)

echo 🚀 正在启动...
echo 🎭 角色: uu / 洁女神
echo.

call npx tsx src/index.ts --char uu

pause
