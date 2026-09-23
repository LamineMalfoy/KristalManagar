# Массовая очистка data папки
Set-Location "C:\Users\kinde\OneDrive\Desktop\твик\data"

# Удаляем все JSON файлы кроме важных
Get-ChildItem -Name "*.json" | Where-Object { $_ -ne "russian_words.txt" } | ForEach-Object { Remove-Item $_ -Force }

# Удаляем все папки кроме sysadmins
Get-ChildItem -Directory | Where-Object { $_.Name -ne "sysadmins" } | ForEach-Object { Remove-Item $_.FullName -Recurse -Force }

Write-Host "Очистка завершена!"
