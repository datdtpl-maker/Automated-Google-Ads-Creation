@echo off
chcp 65001 >nul
title Google Ads Auto Generator Launcher
echo ========================================================
echo   KHỞI ĐỘNG GOOGLE ADS AUTO GENERATOR
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

if exist "%SCRIPT_DIR%dist\AutoGoogleAds\AutoGoogleAds.exe" (
    echo Đang mở ứng dụng Desktop đã biên dịch...
    start "" "%SCRIPT_DIR%dist\AutoGoogleAds\AutoGoogleAds.exe"
) else (
    echo Đang khởi chạy qua Python Launcher...
    python launcher.py
)
