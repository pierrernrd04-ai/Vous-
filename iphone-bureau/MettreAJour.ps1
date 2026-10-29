<#
    iPhone Bureau - mise à jour express
    Remplace le widget par la dernière version déjà compilée, sans rien compiler sur le PC.
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Host.UI.RawUI.WindowTitle = 'iPhone Bureau - mise à jour'

$Dir = Join-Path $env:LOCALAPPDATA 'iPhoneBureau'
$Exe = Join-Path $Dir 'iPhoneBureau.exe'
$Url = 'https://raw.githubusercontent.com/pierrernrd04-ai/Vous-/HEAD/iphone-bureau/iPhoneBureau.exe'

try {
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null

    # Fermeture propre d'abord (la fenêtre de recopie retrouve sa forme), puis forcée si besoin.
    if ((Get-Process iPhoneBureau -ErrorAction SilentlyContinue) -and (Test-Path $Exe)) {
        Start-Process $Exe -ArgumentList '--quitter' -Wait
        Start-Sleep -Seconds 2
    }
    Get-Process iPhoneBureau -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Milliseconds 500

    Write-Host '  Téléchargement de la nouvelle version...'
    $tmp = "$Exe.new"
    Invoke-WebRequest $Url -OutFile $tmp -UseBasicParsing
    if ((Get-Item $tmp).Length -lt 20000) { throw 'Le fichier téléchargé est incomplet. Réessayez dans une minute.' }
    Move-Item $tmp $Exe -Force
    Unblock-File $Exe -ErrorAction SilentlyContinue

    $link = Join-Path ([Environment]::GetFolderPath('Desktop')) 'iPhone Bureau.lnk'
    if (-not (Test-Path $link)) {
        $s = (New-Object -ComObject WScript.Shell).CreateShortcut($link)
        $s.TargetPath = $Exe
        $s.WorkingDirectory = $Dir
        $s.Save()
    }

    Start-Process $Exe
    Write-Host ''
    Write-Host '  [OK] iPhone Bureau est à jour et relancé.' -ForegroundColor Green
    Write-Host '       Cliquez sur « Recopie gratuite » dans le téléphone.' -ForegroundColor Green
    Start-Sleep -Seconds 5
}
catch {
    Write-Host ''
    Write-Host "  [ERREUR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ''
    Read-Host '  Appuyez sur Entrée pour fermer'
}
