@echo off
setlocal
set "CONDUIT_PORT=4320"
if not defined CONDUIT_AUDIO_DIR set "CONDUIT_AUDIO_DIR=F:\ConduitTTS\audio"
cd /d "%~dp0"
node tools/ensure-build.mjs
if errorlevel 1 (pause & exit /b 1)
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 45;$i++){try{if((Invoke-RestMethod 'http://127.0.0.1:4320/api/health' -TimeoutSec 1).ok){Start-Process 'http://127.0.0.1:4320';exit}}catch{};Start-Sleep -Milliseconds 300}"
node server/serve.mjs
if errorlevel 1 pause
