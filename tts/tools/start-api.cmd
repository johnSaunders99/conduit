@echo off
setlocal
for %%D in ("%~dp0..") do set "ROOT=%%~fD"
set "PY=%ROOT%\.venv\Scripts\python.exe"
set "APP=%ROOT%\app\GPT-SoVITS-20250606v2pro"
set "PYTHONDONTWRITEBYTECODE=1"
set "PYTHONUTF8=1"
set "PYTHONUNBUFFERED=1"
set "TEMP=%ROOT%\tmp"
set "TMP=%TEMP%"
set "PIP_CACHE_DIR=%ROOT%\pip-cache"
set "HF_HOME=%ROOT%\hf-cache"
set "NLTK_DATA=%ROOT%\nltk_data"
set "TORCH_HOME=%ROOT%\torch-cache"
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "HF_HUB_DISABLE_TELEMETRY=1"
set "GRADIO_ANALYTICS_ENABLED=False"
set "PATH=%ROOT%\tools\ffmpeg-9.0.2-essentials_build\bin;%PATH%"
set "CONFIG=%ROOT%\tts-v2pro.yaml"
if /i "%~1"=="--cpu" set "CONFIG=%ROOT%\tts-v2pro-cpu.yaml"
if not "%~1"=="" if /i not "%~1"=="--cpu" (
  echo Usage: start-api.cmd [--cpu]
  exit /b 2
)
if not exist "%PY%" (
  echo Missing Python environment: "%PY%"
  exit /b 1
)
cd /d "%APP%" || exit /b 1
for %%F in (GPT_SoVITS\pretrained_models\s1v3.ckpt GPT_SoVITS\pretrained_models\v2Pro\s2Gv2Pro.pth GPT_SoVITS\pretrained_models\sv\pretrained_eres2netv2w24s4ep4.ckpt GPT_SoVITS\pretrained_models\fast_langdetect\lid.176.bin GPT_SoVITS\text\G2PWModel\g2pW.onnx) do (
  if not exist "%%F" (
    echo Missing local asset: %%F
    exit /b 1
  )
)
"%PY%" -B api_v2.py -a 127.0.0.1 -p 9880 -c "%CONFIG%"
exit /b %errorlevel%
