@echo off
setlocal
cd /d "%~dp0.."
set "ROOT=%CD%"
set "TEMP=%ROOT%\tmp"
set "TMP=%TEMP%"
set "PYTHONDONTWRITEBYTECODE=1"
set "PYTHONUTF8=1"
set "PIP_CACHE_DIR=%ROOT%\pip-cache"
set "PIP_CONFIG_FILE=NUL"
set "PIP_DISABLE_PIP_VERSION_CHECK=1"
set "PY=%ROOT%\.venv\Scripts\python.exe"
if not exist work\resolved-win311.txt (
  echo No resolved wheel lock. See installation report.
  exit /b 1
)
"%PY%" -B -m pip install --no-index --no-compile --find-links wheelhouse -r work\resolved-win311.txt || exit /b 1
"%PY%" -B -m pip check
