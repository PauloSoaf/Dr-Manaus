
 = $args[0]
 = Get-Content $msgFile
 = $content -replace '^feat:', 'feat(player):'
 = $content -replace '^fix:', 'fix(player):'
Set-Content $msgFile $content

