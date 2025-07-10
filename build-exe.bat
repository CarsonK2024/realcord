@echo off
echo Building Discord Clone Executable...
echo.
echo This will create a standalone .exe file.
echo.
echo Step 1: Building frontend...
echo Press any key to start the build process...
pause >nul
echo.
npm run build
echo.
echo Frontend build complete!
echo.
echo Step 2: Building executable...
echo Press any key to continue with executable build...
pause >nul
echo.
npm run electron-build
echo.
echo Build process finished!
echo.
echo Checking for output files...
if exist "dist-electron\*.exe" (
    echo Found executable files in dist-electron:
    dir dist-electron\*.exe
) else (
    echo No .exe files found in dist-electron folder
    echo Checking what's in the dist-electron folder:
    dir dist-electron
)
echo.
echo Build complete! Check the output above for any errors.
echo.
pause 