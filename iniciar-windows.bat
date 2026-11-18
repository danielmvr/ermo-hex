@echo off
cd /d "%~dp0"
echo ERMO - iniciando servidor local em http://localhost:8000
echo Abra no navegador: http://localhost:8000
where py >nul 2>&1
if %errorlevel% == 0 (
  py -m http.server 8000
) else (
  python -m http.server 8000
)
pause
