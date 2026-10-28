param(
    [Parameter(Mandatory = $true)][string]$DeploymentRoot,
    [Parameter(Mandatory = $true)][string]$ImagePrefix,
    [Parameter(Mandatory = $true)][string]$ImageTag,
    [switch]$SkipPull
)
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path $PSScriptRoot -Parent
$deploymentPath = [IO.Path]::GetFullPath($DeploymentRoot)
if ($deploymentPath -eq $sourceRoot -or $deploymentPath -eq [IO.Path]::GetPathRoot($deploymentPath)) {
    throw 'Use a dedicated deployment directory separate from the checkout.'
}
New-Item -ItemType Directory -Force -Path $deploymentPath | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $deploymentPath 'database') | Out-Null
$envPath = Join-Path $deploymentPath '.env'
if (!(Test-Path -LiteralPath $envPath)) {
    $sourceEnv = Join-Path $sourceRoot '.env'
    if (Test-Path -LiteralPath $sourceEnv) { Copy-Item -LiteralPath $sourceEnv -Destination $envPath }
    else { & (Join-Path $PSScriptRoot 'init-env.ps1') -Destination $envPath }
}
Copy-Item -LiteralPath (Join-Path $sourceRoot 'compose.yaml') -Destination $deploymentPath
Copy-Item -LiteralPath (Join-Path $sourceRoot 'database/schema.sql') -Destination (Join-Path $deploymentPath 'database/schema.sql')
$releasePath = Join-Path $deploymentPath 'release.json'
$previous = if (Test-Path -LiteralPath $releasePath) { Get-Content -LiteralPath $releasePath -Raw | ConvertFrom-Json } else { $null }
$env:IMAGE_PREFIX = $ImagePrefix
$env:IMAGE_TAG = $ImageTag
$composeArgs = @('compose', '--project-directory', $deploymentPath, '--env-file', $envPath, '-f', (Join-Path $deploymentPath 'compose.yaml'))
function Invoke-Compose {
    param([string[]]$ComposeCommand)
    & docker @composeArgs @ComposeCommand
    if ($LASTEXITCODE -ne 0) { throw ('docker compose failed: ' + ($ComposeCommand -join ' ')) }
}
Invoke-Compose -ComposeCommand @('config', '--quiet')
if (!$SkipPull) { Invoke-Compose -ComposeCommand @('pull') }
try {
    Invoke-Compose -ComposeCommand @('up', '-d', '--no-build', '--wait', '--wait-timeout', '240', '--remove-orphans')
    $services = & docker @composeArgs ps --format json
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect running containers.' }
    $containers = @($services | ForEach-Object { if ($_.Trim()) { ConvertFrom-Json $_ } })
    if ($containers.Count -ne 4 -or @($containers | Where-Object { $_.State -ne 'running' -or $_.Health -ne 'healthy' }).Count -ne 0) {
        throw 'Expected exactly four running, healthy containers.'
    }
    $portLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^APP_PORT=' } | Select-Object -First 1
    $port = if ($portLine) { ($portLine -split '=', 2)[1] } else { '8080' }
    $health = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/health') -TimeoutSec 15
    if ($health.database -ne 'connected') { throw 'Gateway cannot reach the database.' }
    if ('berita' -notin $health.features) { throw 'Berita backend feature is not ready.' }
    $page = Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:' + $port + '/') -TimeoutSec 15
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch 'loginForm') { throw 'Frontend verification failed.' }
    $newsPage = Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:' + $port + '/pages/berita.html') -TimeoutSec 15
    if ($newsPage.StatusCode -ne 200 -or $newsPage.Content -notmatch 'editorForm') { throw 'Berita frontend verification failed.' }
    @{ imagePrefix = $ImagePrefix; imageTag = $ImageTag; deployedAt = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $releasePath -Encoding UTF8
    Write-Output ('Deployment verified: http://127.0.0.1:' + $port + ' | commit ' + $ImageTag)
    Invoke-Compose -ComposeCommand @('ps')
} catch {
    $failure = $_
    & docker @composeArgs ps --all
    & docker @composeArgs logs --no-color --tail 60
    if ($previous) {
        Write-Warning ('Restoring previous application images: ' + $previous.imageTag)
        $env:IMAGE_PREFIX = $previous.imagePrefix
        $env:IMAGE_TAG = $previous.imageTag
        Invoke-Compose -ComposeCommand @('up', '-d', '--no-build', '--no-deps', '--wait', '--wait-timeout', '180', 'backend', 'frontend', 'gateway')
    }
    throw $failure
}
