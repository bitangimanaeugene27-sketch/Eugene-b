@echo off
title CallFar Launcher
color 0B

echo ===================================================
echo               STARTING CALLFAR DEV ENVIRONMENT
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking connected Android devices...
adb devices
echo.

echo [2/4] Setting up USB port tunnels (5000 and 8081)...
adb wait-for-device >nul 2>&1
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8081 tcp:8081
echo.

echo [3/4] Launching Backend Server in new window...
start "CallFar Backend Server (Port 5000)" cmd /k "cd /d %~dp0callfar-backend && npm run dev"
timeout /t 3 /nobreak >nul

echo [4/4] Launching Metro Bundler (Port 8081)...
start "CallFar Mobile Metro Bundler (Port 8081)" cmd /k "cd /d %~dp0callfar-mobile && npx expo start --dev-client --port 8081"
timeout /t 5 /nobreak >nul

echo.
echo Launching CallFar on your Android phone...
adb shell am force-stop com.callfar.app >nul 2>&1
timeout /t 1 /nobreak >nul
adb shell am start -n com.callfar.app/.MainActivity >nul 2>&1

echo.
echo ===================================================
echo   CallFar is running!
echo   - Backend: http://localhost:5000 (and Wi-Fi IP)
echo   - Metro:   http://localhost:8081
echo   - App:     Opened on your Android phone
echo ===================================================
echo.
pause
