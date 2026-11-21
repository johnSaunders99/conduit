# Stops the 渠成 Conduit local server (node server/serve.mjs listening on 127.0.0.1:<port>).
# Only stops a node process whose command line runs server/serve.mjs; never touches anything else.
param([int]$Port = 4320)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listeners) {
  Write-Host "渠成伺服器沒有在執行（連接埠 $Port 沒有程式在監聽）。"
  exit 0
}

$stopped = 0
foreach ($procId in ($listeners.OwningProcess | Sort-Object -Unique)) {
  $info = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
  if (-not $info) { continue }
  $isConduit = $info.Name -ieq 'node.exe' -and $info.CommandLine -match 'server[\\/]+serve\.mjs'
  if (-not $isConduit) {
    Write-Host "連接埠 $Port 被其他程式使用（$($info.Name)，PID $procId），不是渠成伺服器，已略過。"
    continue
  }
  Stop-Process -Id $procId
  try { Wait-Process -Id $procId -Timeout 10 -ErrorAction Stop } catch {}
  Write-Host "已停止渠成伺服器（PID $procId）。"
  $stopped++
}

if ($stopped -gt 0) {
  Write-Host '學習進度已存在瀏覽器和 userdata\，不會因為停止而遺失。要再開啟，按兩下「啟動渠成.cmd」。'
}
exit 0
