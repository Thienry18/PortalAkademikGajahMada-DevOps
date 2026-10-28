param(
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$Commit,
    [Parameter(Mandatory=$true)][Int64]$Sequence,
    [string]$SourceImagePrefix = 'ghcr.io/thienry18/portalakademikgajahmada-devops',
    [string]$DistributionCheckout
)
$ErrorActionPreference = 'Stop'
if ($Sequence -lt 1) { throw 'Release sequence must be positive.' }
$sourceRoot = Split-Path $PSScriptRoot -Parent
if (!$DistributionCheckout) {
    $tempRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
    $DistributionCheckout = Join-Path $tempRoot ('portal-public-' + [Guid]::NewGuid().ToString('N'))
}
if (Test-Path -LiteralPath $DistributionCheckout) { throw 'Use a fresh distribution checkout directory.' }
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/health' -TimeoutSec 15
if ($health.database -ne 'connected' -or $health.release -ne $Commit) { throw 'Only the exact successfully deployed release may be promoted.' }
& git clone https://github.com/Thienry18/PortalAkademikGajahMada-Releases.git $DistributionCheckout
if ($LASTEXITCODE -ne 0) { throw 'Distribution checkout failed.' }
$oldManifestPath = Join-Path $DistributionCheckout 'stable.json'
$previous = if (Test-Path -LiteralPath $oldManifestPath) { Get-Content -LiteralPath $oldManifestPath -Raw | ConvertFrom-Json } else { $null }
if ($previous -and [Int64]$previous.sequence -ge $Sequence) { throw 'A newer or equal release sequence already exists.' }
$images = @{}
foreach ($service in @('frontend','backend','gateway')) {
    $name = 'thien18/portal-akademik-' + $service
    $target = $name + ':' + $Commit
    & docker tag ($SourceImagePrefix + '/' + $service + ':' + $Commit) $target
    if ($LASTEXITCODE -ne 0) { throw ('Tested image is unavailable: ' + $service) }
    & docker push $target
    if ($LASTEXITCODE -ne 0) { throw ('Docker Hub publication failed: ' + $service) }
    # Resolve by an anonymous registry request: consumers must not need a login.
    $token = Invoke-RestMethod -Uri ('https://auth.docker.io/token?service=registry.docker.io&scope=repository:' + $name + ':pull')
    $response = Invoke-WebRequest -UseBasicParsing -Uri ('https://registry-1.docker.io/v2/' + $name + '/manifests/' + $Commit) -Headers @{
        Authorization = 'Bearer ' + $token.token
        Accept = 'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json'
    }
    $digest = [string]$response.Headers['Docker-Content-Digest']
    if ($digest -notmatch '^sha256:[a-f0-9]{64}$') { throw ('Invalid registry digest: ' + $service) }
    $images[$service] = 'docker.io/' + $name + '@' + $digest
    Write-Output ('Verified anonymous image: ' + $images[$service])
}
if ($previous) { $images.database = $previous.images.database }
else {
    $digests = & docker image inspect mysql:8.4 --format '{{json .RepoDigests}}' | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'The tested MySQL image is unavailable.' }
    $mysql = @($digests | Where-Object { $_ -match '^(docker\.io/library/)?mysql@sha256:[a-f0-9]{64}$' }) | Select-Object -First 1
    if (!$mysql) { throw 'Cannot pin the tested MySQL image.' }
    $images.database = 'docker.io/library/' + ($mysql -replace '^docker\.io/library/', '')
}
$versionPath = Join-Path $DistributionCheckout ('releases/' + $Commit)
New-Item -ItemType Directory -Force -Path $versionPath | Out-Null
$bootstrap = Join-Path $versionPath 'bootstrap.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (!(Test-Path -LiteralPath $bootstrap)) {
    $zip = [IO.Compression.ZipFile]::Open($bootstrap, [IO.Compression.ZipArchiveMode]::Create)
    try {
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $sourceRoot 'distribution/compose.yaml'), 'compose.yaml')
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $sourceRoot 'database/schema.sql'), 'database/schema.sql')
    } finally { $zip.Dispose() }
}
$rawBase = 'https://raw.githubusercontent.com/Thienry18/PortalAkademikGajahMada-Releases/main/'
$release = @{
    schemaVersion=1
    clientCompatibility=1
    version=$Commit
    sequence=$Sequence
    platform='linux/amd64'
    publishedAt=[DateTime]::UtcNow.ToString('o')
    images=$images
    bootstrap=@{url=($rawBase+'releases/'+$Commit+'/bootstrap.zip');sha256=(Get-FileHash -LiteralPath $bootstrap -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $versionPath 'manifest.json'), ($release | ConvertTo-Json -Depth 10), $utf8)
foreach ($name in @('Install-Portal.ps1','Update-Portal.ps1','Uninstall-Portal.ps1')) { Copy-Item -LiteralPath (Join-Path $sourceRoot ('distribution/'+$name)) -Destination $DistributionCheckout -Force }
Copy-Item -LiteralPath (Join-Path $sourceRoot 'distribution/README.md') -Destination $DistributionCheckout -Force
# The public branch commit atomically publishes the complete release and pointer.
[IO.File]::WriteAllText($oldManifestPath, ($release | ConvertTo-Json -Depth 10), $utf8)
Push-Location $DistributionCheckout
try {
    & git add README.md Install-Portal.ps1 Update-Portal.ps1 Uninstall-Portal.ps1 stable.json releases
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage release metadata.' }
    & git -c user.name='Portal Akademik Releases' -c user.email='Thienry18@users.noreply.github.com' commit -m ('Publish verified stable release ' + $Commit)
    if ($LASTEXITCODE -ne 0) { throw 'Could not commit public release.' }
    & git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'Stable channel promotion failed; existing clients retain their current release.' }
} finally { Pop-Location }
Write-Output ('Public stable release: ' + $rawBase + 'stable.json')
