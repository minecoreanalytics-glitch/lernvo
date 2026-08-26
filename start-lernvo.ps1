# Starts Redis (Docker) + frontend/backend. Postgres Windows service is left as-is.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Test-Port([int]$Port) {
  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

if ((Test-Port 3000) -and (Test-Port 4000)) {
  Write-Host 'Lernvo tourne deja: http://localhost:3000'
  exit 0
}

$dockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'
$desktopExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')

if (-not (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path $dockerExe)) {
  $env:Path = "$(Split-Path $dockerExe);$env:Path"
}

if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue) -and (Test-Path $desktopExe)) {
  Write-Host 'Demarrage de Docker Desktop...'
  Start-Process $desktopExe
}

$deadline = (Get-Date).AddMinutes(2)
do {
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)

if ($LASTEXITCODE -ne 0) {
  Write-Host 'Docker n est pas pret. Ouvrez Docker Desktop, attendez Engine running, puis relancez ce script.'
  exit 1
}

Write-Host 'Demarrage de Redis...'
docker compose -f docker-compose.dev.yml up -d redis | Out-Host

$pg = Get-Service 'postgresql-x64-16' -ErrorAction SilentlyContinue
if ($pg -and $pg.Status -ne 'Running') {
  try { Start-Service 'postgresql-x64-16' } catch { Write-Host "Postgres n a pas pu demarrer: $_" }
}

Write-Host 'Demarrage de l app (laissez cette fenetre ouverte)...'
Write-Host 'Frontend: http://localhost:3000'
& npm.cmd run dev
