@echo off
echo Building Discord Clone with fixes...
echo.
echo This will rebuild the application with the latest fixes.
echo.
echo Step 1: Building frontend...
npm run build
echo.
echo Frontend build complete!
echo.
echo Step 2: Building executable...
npm run electron-build
echo.
echo Build complete! Check dist-electron folder for the new .exe file.
echo.
pause 