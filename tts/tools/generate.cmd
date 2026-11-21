@echo off
setlocal
set "ROOT=%~dp0.."
set "PYTHONDONTWRITEBYTECODE=1"
set "PYTHONUTF8=1"
set "TEMP=%ROOT%\tmp"
set "TMP=%TEMP%"
"%ROOT%\.venv\Scripts\python.exe" -B "%~dp0generate.py" %*
exit /b %errorlevel%
