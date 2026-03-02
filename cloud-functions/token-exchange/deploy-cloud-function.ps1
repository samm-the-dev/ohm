<#
.SYNOPSIS
Deploy a GCP Cloud Run function (gen2) using a local deploy.config.json.

.DESCRIPTION
Reads deploy.config.json from the current directory for project-specific
values. See planet-smars/templates/ai-context/gcp-oauth-token-exchange.md.

Config file fields:
  functionName  (required) - GCP function name
  entryPoint    (required) - exported function name
  secrets       (required) - --set-secrets value
  region        (optional) - default: us-central1
  runtime       (optional) - default: nodejs22

.EXAMPLE
cd cloud-functions/my-function
powershell -ExecutionPolicy Bypass -File ../../.planet-smars/scripts/deploy-cloud-function.ps1
#>

$ErrorActionPreference = 'Stop'
$ConfigFile = 'deploy.config.json'

if (-not (Test-Path $ConfigFile)) {
    Write-Error "$ConfigFile not found in $(Get-Location). Create one with: functionName, entryPoint, secrets"
    exit 1
}

$config = Get-Content $ConfigFile -Raw | ConvertFrom-Json

$functionName = $config.functionName
$entryPoint = $config.entryPoint
$secrets = $config.secrets
$region = if ($config.region) { $config.region } else { 'us-central1' }
$runtime = if ($config.runtime) { $config.runtime } else { 'nodejs22' }

if (-not $functionName -or -not $entryPoint -or -not $secrets) {
    Write-Error "$ConfigFile must specify functionName, entryPoint, and secrets"
    exit 1
}

Write-Host "Deploying $functionName (entry: $entryPoint) to $region..."

npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error 'Build failed'
    exit $LASTEXITCODE
}

gcloud functions deploy $functionName `
    --gen2 `
    --runtime="$runtime" `
    --trigger-http `
    --allow-unauthenticated `
    --entry-point="$entryPoint" `
    --source=. `
    --region="$region" `
    --set-secrets="$secrets"

if ($LASTEXITCODE -ne 0) {
    Write-Error 'Deploy failed'
    exit $LASTEXITCODE
}

Write-Host "Deployed $functionName successfully."
