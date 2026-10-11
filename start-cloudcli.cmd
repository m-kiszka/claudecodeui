@echo off
rem Serves this fork on port 3001 in place of the global CloudCLI, rebuilding only
rem what changed since the last build, and opens it in the browser.
title CloudCLI (fork)
cd /d "%~dp0"

netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul
if %errorlevel%==0 (
  echo Port 3001 is already in use - close the previous CloudCLI first.
  pause
  exit /b 1
)

node scripts\start-fork.mjs
pause
