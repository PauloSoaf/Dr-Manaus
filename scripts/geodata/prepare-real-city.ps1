param(
  [string]$ProjectPath = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectPath

$raw = Join-Path $ProjectPath "data\raw-geodata"
$venv = Join-Path $ProjectPath ".geodata-venv"
New-Item -ItemType Directory -Force -Path $raw | Out-Null

function Find-Python {
  if (Get-Command py -ErrorAction SilentlyContinue) { return @("py", "-3") }
  if (Get-Command python -ErrorAction SilentlyContinue) { return @("python") }
  throw "Python 3 nao encontrado. Instale Python 3 e rode novamente."
}

$python = Find-Python

if (-not (Test-Path $venv)) {
  Write-Host "Criando ambiente Python do pipeline geoespacial..." -ForegroundColor Cyan
  if ($python.Count -eq 2) { & $python[0] $python[1] -m venv $venv }
  else { & $python[0] -m venv $venv }
}

$venvPython = Join-Path $venv "Scripts\python.exe"
$venvPip = Join-Path $venv "Scripts\pip.exe"
$venvOverture = Join-Path $venv "Scripts\overturemaps.exe"

Write-Host "Instalando/atualizando cliente oficial Overture..." -ForegroundColor Cyan
& $venvPython -m pip install --upgrade pip
& $venvPip install --upgrade overturemaps
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar overturemaps." }

# Manaus metropolitana + Ponta Negra + Ponte + Cacau Pirera/Iranduba + Encontro das Aguas.
$bbox = "-60.16,-3.20,-59.85,-2.95"
# O Rio Negro e o Solimoes precisam preencher o horizonte muito alem da cidade, entao a agua usa
# uma caixa bem mais larga do que os temas urbanos.
$waterBbox = "-60.45,-3.45,-59.60,-2.75"

function Download-Overture([string]$type, [string]$output, [string]$box = $bbox) {
  if (Test-Path $output) {
    Write-Host "Usando cache existente: $output" -ForegroundColor DarkGray
    return
  }
  Write-Host "Baixando Overture $type para Manaus..." -ForegroundColor Cyan
  & $venvOverture download "--bbox=$box" -f geojson "--type=$type" -o $output
  if ($LASTEXITCODE -ne 0) { throw "Falha no download Overture: $type" }
}

Download-Overture "building" (Join-Path $raw "manaus-buildings.geojson")
Download-Overture "segment" (Join-Path $raw "manaus-segments.geojson")
Download-Overture "place" (Join-Path $raw "manaus-places.geojson")
Download-Overture "water" (Join-Path $raw "manaus-water.geojson") $waterBbox
Download-Overture "division_area" (Join-Path $raw "manaus-divisions.geojson")

Write-Host "Compilando dados reais para tiles do DR Manaus..." -ForegroundColor Cyan
node scripts/geodata/compile-real-city.mjs
if ($LASTEXITCODE -ne 0) { throw "Falha ao compilar geodata." }

$manifest = Join-Path $ProjectPath "public\geodata\real-city\manifest.json"
if (-not (Test-Path $manifest)) { throw "Manifesto real-city nao foi gerado." }

$parsed = Get-Content $manifest -Raw | ConvertFrom-Json
if ($parsed.stats.buildings -lt 1) { throw "Nenhum predio foi compilado. Verifique o download." }

Write-Host ""
Write-Host "Geodata real compilada com sucesso." -ForegroundColor Green
Write-Host ("Predios: " + $parsed.stats.buildings)
Write-Host ("Tiles: " + $parsed.stats.tiles)
Write-Host ("Ruas: " + $parsed.stats.roads)
Write-Host ("POIs: " + $parsed.stats.pois)
Write-Host ("Poligonos de agua: " + $parsed.stats.waterPolygons)
Write-Host ("Bairros: " + $parsed.stats.districtCount)
