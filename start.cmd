@echo off
rem AVORA: double-click to build the optimised site and serve it locally (http://localhost:5173). For development with hot reload, run "npm run dev".
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Installing dependencies...
  call npm install || (pause & exit /b 1)
)
call npm start
pause
