@echo off
echo Starting Noise Monitor...
echo.
echo [1/2] Starting Backend Server...
cd /d "%~dp0backend"
start "Noise Monitor - Backend" cmd /c "node server.js"
echo.
echo [2/2] Starting Frontend Application...
cd /d "%~dp0frontend"
start "Noise Monitor - Frontend" cmd /c "npm start"
echo.
echo Noise Monitor is starting...
echo - Backend will run on http://localhost:3000
echo - Frontend will open in your browser
