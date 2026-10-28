param([string]$Destination = (Join-Path $PSScriptRoot '../.env'))
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $Destination) {
    Write-Output 'Existing .env retained.'
    exit 0
}
function New-RandomSecret {
    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
}
$content = @(
    'APP_PORT=8080'
    ('DB_PASSWORD=' + (New-RandomSecret))
    ('DB_ROOT_PASSWORD=' + (New-RandomSecret))
    ('JWT_SECRET=' + (New-RandomSecret))
    'SEED_DEMO_DATA=true'
) -join "`n"
[IO.File]::WriteAllText([IO.Path]::GetFullPath($Destination), $content + "`n", (New-Object Text.UTF8Encoding($false)))
Write-Output 'Created .env with random local secrets (values are not printed).'
