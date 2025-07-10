@echo off
echo Building Discord Clone Final Version...
echo.
echo This will create a working executable with proper server integration.
echo.
echo Step 1: Building frontend...
npm run build
echo.
echo Frontend build complete!
echo.
echo Step 2: Building portable executable...
npx electron-builder --win portable
echo.
echo Build complete! The new .exe should work on any computer.
echo.
pause 