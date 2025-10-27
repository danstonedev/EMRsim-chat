# Fix TypeScript imports to use .js extensions for NodeNext module resolution
# This script adds .js to all relative imports that lack extensions

$files = Get-ChildItem -Path "src", "tests" -Recurse -Filter "*.ts" -File

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    # Fix imports like: from './something'  ->  from './something.js'
    # Match: from 'relative-path' or from "relative-path" where path starts with . and has no extension
    $content = $content -replace "from\s+(['""])(\.[^'""]+?)(?<!\.ts)(?<!\.js)(?<!\.json)\1", "from `$1`$2.js`$1"
    
    # Fix imports like: from './something.ts'  ->  from './something.js'
    $content = $content -replace "from\s+(['""])([^'""]+?)\.ts\1", "from `$1`$2.js`$1"
    
    # Fix JSON imports to add import attributes
    $content = $content -replace "import\s+(\w+)\s+from\s+(['""])([^'""]+?\.json)\2;", "import `$1 from `$2`$3`$2 with { type: 'json' };"
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($file.FullName)"
    }
}

Write-Host "Done!"
