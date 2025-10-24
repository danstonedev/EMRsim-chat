@echo off
echo Starting EMRsim-chat Development Servers...
echo.
echo This will start both the frontend and backend servers.
echo Press Ctrl+C twice to stop the servers when you're done.
echo.
echo Starting servers...
echo.

cd %~dp0
start cmd /k "echo Starting Frontend Server... && npm start"
timeout /t 5 > nul
start cmd /k "echo Starting Backend Server... && cd backend && npm start"

echo.
echo Both servers are now starting in separate windows.
echo Frontend: http://localhost:5173
echo Backend: http://localhost:3002
echo.
echo To debug chat bubbles, click the "Enable Debug" button in the bottom-right corner.
echo.
pause
