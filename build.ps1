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

# Copy needed node_modules folders to out/node_modules to make sure Tesseract.js can find its files
$nodeModulesToCopy = @(
    "tesseract.js",
    "tesseract.js-core",
    "@tesseract.js-data"
)

foreach ($module in $nodeModulesToCopy) {
    $sourcePath = Join-Path -Path "node_modules" -ChildPath $module
    $destPath = Join-Path -Path $OutDir -ChildPath ("node_modules\" + $module)

    if (Test-Path $sourcePath) {
        Write-Host "Copying $module from $sourcePath to $destPath ..."
        # Ensure destination directory exists
        if (-not (Test-Path $destPath)) {
            New-Item -ItemType Directory -Path $destPath -Force | Out-Null
        }
        Copy-Item -Recurse -Force $sourcePath\* $destPath
    } else {
        Write-Warning "$module not found in node_modules, skipping..."
    }
}


# Copy all tesseract-related files and folders from src to out
$tesseractRelated = @("tesseract.js", "tesseract.js-core", "@tesseract.js-data")
foreach ($folder in $tesseractRelated) {
    $srcPath = Join-Path -Path "src" -ChildPath $folder
    $destPath = Join-Path -Path $OutDir -ChildPath $folder
    if (Test-Path $srcPath) {
        Write-Host "Copying $folder from $srcPath to $destPath ..."
        if (-not (Test-Path $destPath)) {
            New-Item -ItemType Directory -Path $destPath -Force | Out-Null
        }
        Copy-Item -Recurse -Force $srcPath\* $destPath
    } else {
        Write-Warning "$folder not found in src, skipping..."
    }
}

Write-Host "Packaging in development mode (no compression/minification)..."
npm run compile # Use webpack in development mode (mode: none, no minification)

# Optionally, skip version bump for dev builds
# npm version patch

Write-Host "Running 'vsce package'..."
vsce package
