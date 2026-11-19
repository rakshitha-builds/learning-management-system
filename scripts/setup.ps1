# Windows / PowerShell one-shot local setup (no Docker).  Run from the project root:  .\scripts\setup.ps1
$ErrorActionPreference = "Stop"
function Need($cmd, $hint) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "MISSING: $cmd  ->  $hint" -ForegroundColor Red; $script:missing = $true } else { Write-Host "OK: $cmd" -ForegroundColor Green } }
Need node "Install Node.js 18+ from https://nodejs.org"
Need npm  "Comes with Node.js"
Need ffmpeg "winget install Gyan.FFmpeg  (then reopen PowerShell)"
Need mongod "Install MongoDB Community, or use Docker:  docker run -d -p 27017:27017 mongo:7"
Need redis-server "Use Docker:  docker run -d -p 6379:6379 redis:7   (Redis has no native Windows build)"
if ($missing) { Write-Host "`nInstall the missing tools above (see docs/SETUP.md), then run this script again." -ForegroundColor Yellow }

if (-not (Test-Path backend\.env))  { Copy-Item backend\.env.example backend\.env;   Write-Host "Created backend\.env" }
if (-not (Test-Path frontend\.env)) { Copy-Item frontend\.env.example frontend\.env; Write-Host "Created frontend\.env" }
Push-Location backend;  npm install; Pop-Location
Push-Location frontend; npm install; Pop-Location
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Start MongoDB + Redis (+ LiveKit: docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp -e LIVEKIT_KEYS='devkey: secret-secret-secret-secret-secret-1234' livekit/livekit-server --dev)"
Write-Host "  2. cd backend; npm run seed"
Write-Host "  3. Terminal A: cd backend; npm run dev      Terminal B: cd backend; npm run worker      Terminal C: cd frontend; npm run dev"
