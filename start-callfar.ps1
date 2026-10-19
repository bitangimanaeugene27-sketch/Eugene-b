# CallFar One-Click PowerShell Launcher
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "         STARTING CALLFAR DEV ENVIRONMENT         " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Reverse ports for USB
Write-Host "`n[1/3] Configuring ADB reverse ports for Android device..." -ForegroundColor Yellow
adb reverse tcp:5000 tcp:5000
adb reverse tcp:8081 tcp:8081

# 2. Start Backend
Write-Host "`n[2/3] Starting Backend server (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\callfar-backend'; npm run dev"

Start-Sleep -Seconds 3

# 3. Start Metro
Write-Host "`n[3/3] Starting Metro Bundler (Port 8081)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir\callfar-mobile'; npx expo start --dev-client --port 8081"

Start-Sleep -Seconds 4

# 4. Launch App
adb shell am force-stop com.callfar.app | Out-Null
Start-Sleep -Seconds 1
adb shell am start -n com.callfar.app/.MainActivity | Out-Null

Write-Host "`n===================================================" -ForegroundColor Green
Write-Host " CallFar is running!" -ForegroundColor Green
Write-Host " - Backend: http://localhost:5000" -ForegroundColor Green
Write-Host " - Metro:   http://localhost:8081" -ForegroundColor Green
Write-Host " - Phone:   App launched on connected Android device" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
