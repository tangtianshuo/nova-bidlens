@echo off
echo BidLens Windows Build
echo =====================
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\build-windows.ps1" %*
pause
