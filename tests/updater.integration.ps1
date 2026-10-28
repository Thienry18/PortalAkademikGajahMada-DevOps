param([string]$ImagePrefix=$env:IMAGE_PREFIX, [string]$ImageTag=$env:IMAGE_TAG)
$ErrorActionPreference = 'Stop'
if (!$ImagePrefix -or !$ImageTag) { throw 'Run after building the CI application images.' }
$sourceRoot = Split-Path $PSScriptRoot -Parent
$tempBase = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$fixture = Join-Path $tempBase ('portal-updater-test-' + [Guid]::NewGuid().ToString('N'))
$installation = Join-Path $fixture 'client'
New-Item -ItemType Directory -Force -Path $fixture | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)
$channel = Join-Path $fixture 'stable.json'
$bootstrap = Join-Path $fixture 'bootstrap.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($bootstrap, [IO.Compression.ZipArchiveMode]::Create)
try {
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $sourceRoot 'distribution/compose.yaml'), 'compose.yaml')
    [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $sourceRoot 'database/schema.sql'), 'database/schema.sql')
} finally { $zip.Dispose() }
$images = @{
    backend=($ImagePrefix+'/backend:'+$ImageTag)
    frontend=($ImagePrefix+'/frontend:'+$ImageTag)
    gateway=($ImagePrefix+'/gateway:'+$ImageTag)
    database='mysql:8.4'
}
function New-Channel([string]$Version, [Int64]$Sequence, [string]$Frontend = $images.frontend) {
    $manifest = @{schemaVersion=1;clientCompatibility=1;version=$Version;sequence=$Sequence;images=@{backend=$images.backend;frontend=$Frontend;gateway=$images.gateway;database=$images.database};bootstrap=@{url=([Uri]$bootstrap).AbsoluteUri;sha256=(Get-FileHash $bootstrap -Algorithm SHA256).Hash.ToLowerInvariant()}}
    [IO.File]::WriteAllText($channel, ($manifest | ConvertTo-Json -Depth 10), $utf8)
}
function Assert-Equal($Actual, $Expected, [string]$Message) {
    if ($Actual -ne $Expected) { throw ($Message + ': expected ' + $Expected + ', received ' + $Actual) }
}
function Run-Updater([int]$ExpectedExit = 0, [switch]$ProductionMode) {
    & (Join-Path $sourceRoot 'distribution/Update-Portal.ps1') -InstallDirectory $installation -TestMode:(!$ProductionMode)
    Assert-Equal $LASTEXITCODE $ExpectedExit 'Updater exit code'
}
function Get-State { return (Get-Content -LiteralPath (Join-Path $installation 'state.json') -Raw | ConvertFrom-Json) }
function Get-Health { return Invoke-RestMethod 'http://127.0.0.1:18081/health' -TimeoutSec 15 }
function Get-ClientComposeArguments {
    $settings = Get-Content -LiteralPath (Join-Path $installation 'updater-settings.json') -Raw | ConvertFrom-Json
    $current = Get-State
    return @('compose','--project-directory',$installation,'--env-file',(Join-Path $installation '.env'),'--env-file',(Join-Path $installation ('releases/'+$current.release.version+'/images.env')),'-p',$settings.projectName,'-f',(Join-Path $installation 'compose.yaml'))
}

$first = 'a' * 40
$second = 'b' * 40
$bad = 'c' * 40
try {
    New-Channel $first 1
    & (Join-Path $sourceRoot 'distribution/Install-Portal.ps1') -InstallDirectory $installation -Port 18081 -ChannelUrl ([Uri]$channel).AbsoluteUri -NoAutoUpdate -TestMode
    Assert-Equal $LASTEXITCODE 0 'First installation'
    Assert-Equal (Get-Health).release $first 'First release was started'
    $secretHash = (Get-FileHash (Join-Path $installation '.env')).Hash
    $compose = Get-ClientComposeArguments
    $databaseId = & docker @compose ps -q database
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect original database container.' }
    $login = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:18081/api/v1/auth/login' -ContentType 'application/json' -Body (@{username='admin_portal';password='Admin@1234'} | ConvertTo-Json)
    $headers = @{Authorization='Bearer '+$login.data.token}
    $created = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:18081/api/v1/berita' -Headers $headers -ContentType 'application/json' -Body (@{judul='Updater persistence proof';isi='This news must survive a real update and a failed release rollback.'}|ConvertTo-Json)
    $newsId = $created.data.id
    Run-Updater
    Assert-Equal (Get-State).release.version $first 'Repeated checks are idempotent'
    Write-Output 'PASS updater: fresh install and no-op check.'

    New-Channel $second 2
    Run-Updater
    Assert-Equal (Get-Health).release $second 'Second release became active'
    Assert-Equal (Get-FileHash (Join-Path $installation '.env')).Hash $secretHash 'Local secrets were retained'
    $compose = Get-ClientComposeArguments
    Assert-Equal (& docker @compose ps -q database) $databaseId 'Existing MySQL container was retained'
    $news = Invoke-RestMethod -Uri ('http://127.0.0.1:18081/api/v1/berita/'+$newsId) -Headers $headers
    Assert-Equal $news.data.judul 'Updater persistence proof' 'User data survived the update'
    Write-Output 'PASS updater: version update preserves secrets, database container, and news.'

    $badContext = Join-Path $fixture 'bad-image'
    New-Item -ItemType Directory -Path $badContext | Out-Null
    [IO.File]::WriteAllText((Join-Path $badContext 'Dockerfile'), ('FROM '+$images.frontend+" AS runtime`nHEALTHCHECK --interval=1s --timeout=1s --start-period=0s --retries=1 CMD exit 1`n"), $utf8)
    & docker build -t portal-updater-unhealthy:qa $badContext
    if ($LASTEXITCODE -ne 0) { throw 'Could not build the unhealthy release fixture.' }
    New-Channel $bad 3 'portal-updater-unhealthy:qa'
    Run-Updater 1
    Assert-Equal (Get-State).release.version $second 'Failed release did not become current'
    Assert-Equal (Get-Health).release $second 'Previous backend was restored'
    $news = Invoke-RestMethod -Uri ('http://127.0.0.1:18081/api/v1/berita/'+$newsId) -Headers $headers
    Assert-Equal $news.data.judul 'Updater persistence proof' 'User data survived rollback'
    Run-Updater
    Assert-Equal (Get-Health).release $second 'Failed release is not retried on every check'
    Write-Output 'PASS updater: unhealthy release rolled back and repeated failure was suppressed.'

    New-Channel $first 1
    Run-Updater 1
    Assert-Equal (Get-State).release.version $second 'Older channel sequences were rejected'
    New-Channel $second 2
    Run-Updater -ProductionMode -ExpectedExit 1
    $lock = [IO.File]::Open((Join-Path $installation 'update.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    try { Run-Updater } finally { $lock.Dispose() }
    Assert-Equal (Get-State).release.version $second 'Lock prevented concurrent updates'
    Write-Output 'PASS updater: replay prevention, HTTPS trust policy, and exclusive update lock.'

    $invalid = Get-Content -LiteralPath $channel -Raw | ConvertFrom-Json
    $invalid.bootstrap.sha256 = '0' * 64
    [IO.File]::WriteAllText($channel, ($invalid | ConvertTo-Json -Depth 10), $utf8)
    $checksumRoot = Join-Path $fixture 'checksum-client'
    $failed = $false
    try {
        & (Join-Path $sourceRoot 'distribution/Install-Portal.ps1') -InstallDirectory $checksumRoot -Port 18082 -ChannelUrl ([Uri]$channel).AbsoluteUri -NoAutoUpdate -TestMode
        if ($LASTEXITCODE -ne 0) { $failed = $true }
    } catch { $failed = $true }
    Assert-Equal $failed $true 'Corrupt bootstrap was rejected'
    Assert-Equal (Test-Path -LiteralPath (Join-Path $checksumRoot 'state.json')) $false 'Corrupt bootstrap never became an installed release'
    Write-Output 'PASS updater: bootstrap checksum verification.'
} finally {
    if (Test-Path -LiteralPath (Join-Path $installation 'state.json')) {
        $compose = Get-ClientComposeArguments
        & docker @compose down
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Test containers could not be stopped.' }
    }
}
