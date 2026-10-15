@echo off
set "H7_DEMO_DIR=%~dp0"
powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Process (([uri](Join-Path $env:H7_DEMO_DIR 'index-dark.html')).AbsoluteUri + '#processing')"
