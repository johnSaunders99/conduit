# Start / stop / status for the local voice generation used by 渠成 Conduit.
# start : launches the GPT-SoVITS API and the resumable generator in two minimized windows.
# stop  : stops only processes running this folder's api_v2.py or tools\generate.py.
param([ValidateSet('start', 'stop', 'status')][string]$Action = 'status', [string]$Voice = 'taimecs')

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$root = Split-Path -Parent $PSScriptRoot
$segments = Join-Path $root 'work\segments.jsonl'

function Get-TtsProcesses {
  Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" | Where-Object {
    $_.CommandLine -and ($_.CommandLine -match 'api_v2\.py' -or $_.CommandLine -match 'tools\\generate\.py')
  }
}
function Test-Api { try { return [bool](Invoke-RestMethod 'http://127.0.0.1:9880/conduit-health' -TimeoutSec 2) } catch { return $false } }
function Show-Progress {
  $log = Join-Path $root 'logs\generate.log'
  $line = if (Test-Path $log) { Get-Content $log -Tail 40 | Where-Object { $_ -match ' done, ETA' } | Select-Object -Last 1 }
  if ($line) { Write-Host "最近進度：$line" }
}

switch ($Action) {
  'status' {
    $p = @(Get-TtsProcesses)
    $api = Test-Api
    $gen = $p | Where-Object { $_.CommandLine -match 'generate\.py' }
    Write-Host ("語音伺服器：" + $(if ($api) { '執行中' } else { '未執行' }))
    Write-Host ("語音生成：" + $(if ($gen) { '執行中' } else { '未執行' }))
    Show-Progress
  }
  'stop' {
    $p = @(Get-TtsProcesses)
    if (-not $p) { Write-Host '語音生成沒有在執行。'; break }
    foreach ($x in ($p | Sort-Object { $_.CommandLine -match 'api_v2' })) { Stop-Process -Id $x.ProcessId -ErrorAction SilentlyContinue }
    Write-Host "已停止語音生成與語音伺服器（$($p.Count) 個程序）。下次開始會從中斷處接續。"
    Show-Progress
  }
  'start' {
    if (-not (Test-Path $segments)) { throw "找不到 $segments；先在渠成資料夾執行 npm.cmd run speech:export。" }
    if (-not (Test-Api)) {
      Start-Process -FilePath $env:ComSpec -ArgumentList '/c', ('title ConduitTTS 語音伺服器 && "' + (Join-Path $PSScriptRoot 'start-api.cmd') + '"') -WindowStyle Minimized
      Write-Host '正在啟動語音伺服器（約 1 分鐘）…'
      $ok = $false; for ($i = 0; $i -lt 120; $i++) { if (Test-Api) { $ok = $true; break }; Start-Sleep -Seconds 2 }
      if (-not $ok) { throw '語音伺服器沒有在 4 分鐘內就緒，請查看最小化的「ConduitTTS 語音伺服器」視窗。' }
    }
    if (Get-TtsProcesses | Where-Object { $_.CommandLine -match 'generate\.py' }) { Write-Host '語音生成已在執行。'; Show-Progress; break }
    $genArgs = '--input "' + $segments + '" --voice ' + $Voice
    Start-Process -FilePath $env:ComSpec -ArgumentList '/c', ('title ConduitTTS 語音生成 && "' + (Join-Path $PSScriptRoot 'generate.cmd') + '" ' + $genArgs) -WindowStyle Minimized
    Write-Host "已開始語音生成（聲線：$Voice）。兩個最小化視窗在工作列；關掉它們或執行「停止語音生成.cmd」即可停止，下次會接續。"
  }
}
exit 0
