@echo off
echo Starting Discord Clone...
echo.
echo Starting backend server...
start "Backend Server" cmd /k "cd server && npm start"
echo Backend server started on http://localhost:3001
echo.
echo Starting frontend server...
start "Frontend Server" cmd /k "npm run dev"
echo Frontend server will start on http://localhost:5173
echo.
echo Both servers are starting...
echo Open http://localhost:5173 in your browser when ready!
pause 