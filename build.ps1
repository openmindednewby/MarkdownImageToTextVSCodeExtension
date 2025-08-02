# Delete the 'out' directory if it exists
$OutDir = "out"
if (Test-Path $OutDir) {
    Write-Host "Removing '$OutDir'..."
    Remove-Item -Recurse -Force $OutDir
} else {
    Write-Host "'$OutDir' directory not found. Skipping deletion."
}

# Run the compile script
Write-Host "Running 'npm run compile'..."
npm run compile

Write-Host "Running 'npm version patch'..."
npm version patch

Write-Host "Running 'vsce package'..."
vsce package