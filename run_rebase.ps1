
 = $args[0]
 = Get-Content $commitFile
 = $content -replace '^pick', 'reword'
Set-Content $commitFile $content

