@echo off
echo Starting TracePilot API and Frontend Dashboard...
start "TracePilot API (Port 4000)" /D "%~dp0." cmd /k "npm run dev:api"
timeout /t 3 /nobreak >nul
start "TracePilot Frontend (Port 5173)" /D "%~dp0." cmd /k "npm run dev --workspace=apps/web"
echo.
echo ==================================================
echo TracePilot is launching!
echo Backend API:  http://localhost:4000
echo Web Frontend: http://localhost:5173
echo ==================================================
echo.
