@echo off
rem Builds this fork and serves it on port 3001, in place of the global CloudCLI.
title CloudCLI (fork)
cd /d "%~dp0"

netstat -ano | findstr /R /C:":3001 .*LISTENING" >nul
if %errorlevel%==0 (
  echo Port 3001 is already in use - close the previous CloudCLI first.
  pause
  exit /b 1
)

set SERVER_PORT=3001
call npm start
pause
