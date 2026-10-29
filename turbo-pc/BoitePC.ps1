<#
    BoitePC - lance les 5 outils, un par un ou tous d'un coup

    Télécharge la dernière version de chaque outil depuis GitHub, ou
    utilise ceux posés à côté de ce fichier s'il n'y a pas Internet.
#>
param([switch]$Auto)   # -Auto : faire l'entretien complet sans question

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'BoitePC'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Auto) { $argList += '-Auto' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $argList
    exit
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$BaseUrl = 'https://raw.githubusercontent.com/pierrernrd04-ai/Vous-/HEAD/turbo-pc'
$WorkDir = Join-Path $env:TEMP 'BoitePC'
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }

# Dernière version en ligne d'abord ; sans Internet, la copie posée à côté.
function Get-Tool($name) {
    $path = Join-Path $WorkDir "$name.ps1"
    try {
        Invoke-WebRequest "$BaseUrl/$name.ps1" -OutFile $path -UseBasicParsing
        return $path
    } catch {
        $local = Join-Path $PSScriptRoot "$name.ps1"
        if (Test-Path $local) { return $local }
        throw "téléchargement impossible et aucune copie locale ($($_.Exception.Message))"
    }
}

function Start-Tool($name, [switch]$Unattended) {
    try {
        $path = Get-Tool $name
        if ($Unattended) { & $path -Auto } else { & $path }
    } catch {
        Say "  [!!] $name n'a pas pu démarrer : $($_.Exception.Message)" Red
    }
}

function Invoke-All {
    Say "`n  Entretien complet : comptez 45 min à 1 h 30." Yellow
    Say '  Laissez le PC branché. Vous pouvez faire autre chose à côté.' Yellow
    try {
        Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
        Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore' `
            -Name SystemRestorePointCreationFrequency -Value 0 -Type DWord
        Checkpoint-Computer -Description 'Avant BoitePC' -RestorePointType MODIFY_SETTINGS
        Say '  [OK] Point de restauration créé' Green
        $env:BOITEPC_RESTOREPOINT = '1'
    } catch { Say '  [--] Point de restauration impossible, chaque outil essaiera le sien' DarkYellow }

    # Ordre choisi : on retire d'abord le superflu, puis on met à jour,
    # on répare, on sécurise, et on optimise en dernier.
    foreach ($tool in 'AllegePC', 'MajPC', 'ReparePC', 'BouclierPC', 'TurboPC') {
        Say "`n==================== $tool ====================" Cyan
        Start-Tool $tool -Unattended
    }
    Say "`nEntretien complet terminé." Green
    if ($Auto -or ((Read-Host 'Redémarrer maintenant ? (O/N)').Trim().ToUpper() -eq 'O')) {
        Say 'Redémarrage dans 30 secondes...'
        shutdown /r /t 30 /c 'BoitePC : redémarrage pour finir l''entretien'
    }
}

if ($Auto) { Invoke-All; return }

while ($true) {
    Clear-Host
    Say '  ==============================================' Cyan
    Say '                  B O I T E   P C' White
    Say '        Les 5 outils pour un PC rapide et sûr' Gray
    Say '  ==============================================' Cyan
    Say "`n  1. Entretien complet automatique (recommandé)" White
    Say '  2. TurboPC     - accélérer Windows' White
    Say '  3. BouclierPC  - sécurité et antivirus' White
    Say '  4. MajPC       - tout mettre à jour' White
    Say '  5. ReparePC    - diagnostic et réparation' White
    Say '  6. AllegePC    - supprimer les applis inutiles' White
    Say '  7. Quitter' White
    switch (Read-Host "`n  Votre choix") {
        '1' { Invoke-All; Read-Host "`nEntrée pour revenir au menu" | Out-Null }
        '2' { Start-Tool 'TurboPC' }
        '3' { Start-Tool 'BouclierPC' }
        '4' { Start-Tool 'MajPC' }
        '5' { Start-Tool 'ReparePC' }
        '6' { Start-Tool 'AllegePC' }
        '7' { exit }
    }
}
