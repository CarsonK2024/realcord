@echo off
echo Building Discord Clone Portable with Server Fix...
echo.
echo This will create a standalone portable .exe with embedded server.
echo.
echo Step 1: Building frontend...
npm run build
echo.
echo Frontend build complete!
echo.
echo Step 2: Building portable executable...
npx electron-builder --win portable
echo.
echo Build complete! Check dist-electron folder for the portable .exe file.
echo.
pause 