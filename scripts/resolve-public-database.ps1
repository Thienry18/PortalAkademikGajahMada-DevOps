param([string]$PreviousReference)
$ErrorActionPreference = 'Stop'
$token = Invoke-RestMethod -Uri 'https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/mysql:pull'
$headers = @{
    Authorization = 'Bearer ' + $token.token
    Accept = 'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json'
}
function Get-RegistryJson([string]$Path) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ('https://registry-1.docker.io/v2/library/mysql/' + $Path) -Headers $headers -TimeoutSec 60
    $json = if ($response.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($response.Content) } else { [string]$response.Content }
    return ($json | ConvertFrom-Json)
}
function ConvertTo-CanonicalValue($Value) {
    if ($null -eq $Value) { return $null }
    if ($Value -is [System.Collections.IDictionary]) {
        $result = [ordered]@{}
        foreach ($key in @($Value.Keys | Sort-Object)) {
            if ($null -ne $Value[$key]) { $result[$key] = ConvertTo-CanonicalValue $Value[$key] }
        }
        return $result
    }
    if ($Value -is [pscustomobject]) {
        $result = [ordered]@{}
        foreach ($property in @($Value.PSObject.Properties | Sort-Object Name)) {
            if ($null -ne $property.Value) { $result[$property.Name] = ConvertTo-CanonicalValue $property.Value }
        }
        return $result
    }
    if ($Value -is [System.Collections.IEnumerable] -and $Value -isnot [string]) {
        $items = @($Value | ForEach-Object { ConvertTo-CanonicalValue $_ })
        return ,$items
    }
    return $Value
}
function ConvertTo-CanonicalJson($Value) {
    return (ConvertTo-CanonicalValue $Value | ConvertTo-Json -Depth 30 -Compress)
}
$local = @(& docker image inspect mysql:8.4 | ConvertFrom-Json)[0]
if ($LASTEXITCODE -ne 0 -or !$local -or $local.Os -ne 'linux' -or $local.Architecture -ne 'amd64') { throw 'The tested linux/amd64 MySQL image is unavailable.' }
if ($PreviousReference) {
    if ($PreviousReference -notmatch '^docker\.io/library/mysql@(sha256:[a-f0-9]{64})$') { throw 'Invalid previous database reference.' }
    $oldDigest = $Matches[1]
    try {
        $null = Get-RegistryJson ('manifests/' + $oldDigest)
        # Normal releases always retain the original publicly available database.
        return $PreviousReference
    } catch {
        if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
        # Docker save/load can rewrite an OCI manifest. Repair only a missing
        # reference that is exactly the local tested descriptor, never a DB upgrade.
        if (!$local.Descriptor -or $local.Descriptor.digest -ne $oldDigest) { throw 'Previous database digest is unavailable; a planned database recovery is required.' }
    }
}
$index = Get-RegistryJson 'manifests/8.4'
$platform = @($index.manifests | Where-Object { $_.platform.os -eq 'linux' -and $_.platform.architecture -eq 'amd64' })
if ($platform.Count -ne 1 -or $platform[0].digest -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Could not resolve the public linux/amd64 MySQL manifest.' }
$manifest = Get-RegistryJson ('manifests/' + $platform[0].digest)
if ($manifest.config.digest -notmatch '^sha256:[a-f0-9]{64}$') { throw 'Invalid MySQL configuration digest.' }
$config = Get-RegistryJson ('blobs/' + $manifest.config.digest)
if ($config.os -ne $local.Os -or $config.architecture -ne $local.Architecture -or
    (ConvertTo-CanonicalJson $config.rootfs.diff_ids) -ne (ConvertTo-CanonicalJson $local.RootFS.Layers) -or
    (ConvertTo-CanonicalJson $config.config) -ne (ConvertTo-CanonicalJson $local.Config)) {
    throw 'Public MySQL image differs from the filesystem or configuration verified by CI. Refusing database promotion.'
}
return ('docker.io/library/mysql@' + $platform[0].digest)
