@echo off
chcp 65001 >nul
title Cai Dat Shortcut Google Ads Auto Generator
echo ========================================================
echo   CÀI ĐẶT SHORTCUT ỨNG DỤNG GOOGLE ADS AUTO GENERATOR
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0
python "%SCRIPT_DIR%create_shortcut.py"

echo.
echo Bạn có thể ra màn hình chính (Desktop) và nhấp đúp vào icon:
echo "Google Ads Auto Generator" để mở ứng dụng bất kỳ lúc nào!
echo.
pause
