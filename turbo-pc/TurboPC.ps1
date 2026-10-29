<#
    TurboPC - optimiseur pour PC Windows 11 modeste
    (pensé pour un Celeron N4020 / 6 Go de RAM / SSD)

    Tout ce que le script modifie est sauvegardé avant, et l'option
    "Annuler" remet chaque réglage exactement comme il était.
#>

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'TurboPC'

# --- Droits administrateur -------------------------------------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    exit
}

$DataDir    = Join-Path $env:ProgramData 'TurboPC'
$BackupFile = Join-Path $DataDir 'sauvegarde.json'
$TaskName   = 'TurboPC - Nettoyage hebdomadaire'
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Skip($text) { Write-Host "  [--] $text" -ForegroundColor DarkYellow }

function Ask($question) {
    do { $r = (Read-Host "$question (O/N)").Trim().ToUpper() } while ($r -notin 'O', 'N')
    return $r -eq 'O'
}

# --- Sauvegarde ------------------------------------------------------------
$Backup = [ordered]@{ Registry = @(); Services = @(); PowerScheme = $null }
if (Test-Path $BackupFile) {
    $old = Get-Content $BackupFile -Raw | ConvertFrom-Json
    $Backup.Registry    = @($old.Registry)
    $Backup.Services    = @($old.Services)
    $Backup.PowerScheme = $old.PowerScheme
}

function Save-Backup { $Backup | ConvertTo-Json -Depth 5 | Set-Content $BackupFile -Encoding UTF8 }

# Écrit une valeur de registre en mémorisant l'ancienne (une seule fois,
# pour que relancer l'optimisation n'écrase pas les valeurs d'origine).
function Set-Reg($path, $name, $value, $type = 'DWord') {
    $known = $Backup.Registry | Where-Object { $_.Path -eq $path -and $_.Name -eq $name }
    if (-not $known) {
        $existed = $false; $oldValue = $null; $oldType = $null
        if (Test-Path $path) {
            $item = Get-Item $path
            if ($item.GetValueNames() -contains $name) {
                $existed  = $true
                $oldValue = $item.GetValue($name, $null, 'DoNotExpandEnvironmentNames')
                $oldType  = $item.GetValueKind($name).ToString()
                if ($oldType -eq 'Binary') { $oldValue = [Convert]::ToBase64String($oldValue) }
            }
        }
        $Backup.Registry += [pscustomobject]@{
            Path = $path; Name = $name; Existed = $existed; Value = $oldValue; Type = $oldType }
    }
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    New-ItemProperty -Path $path -Name $name -Value $value -PropertyType $type -Force | Out-Null
}

function Set-ServiceStart($name, $startType) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) { return $false }
    if (-not ($Backup.Services | Where-Object { $_.Name -eq $name })) {
        $Backup.Services += [pscustomobject]@{ Name = $name; StartType = $svc.StartType.ToString() }
    }
    Set-Service -Name $name -StartupType $startType
    if ($startType -eq 'Disabled' -or $startType -eq 'Manual') {
        Stop-Service -Name $name -Force -ErrorAction SilentlyContinue
    }
    return $true
}

# --- Étapes d'optimisation -------------------------------------------------
function Step-RestorePoint {
    Say "`n> Point de restauration Windows (filet de sécurité)" Cyan
    try {
        Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
        # Windows limite à un point toutes les 24 h par défaut : on lève la limite.
        Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore' `
            -Name SystemRestorePointCreationFrequency -Value 0 -Type DWord
        Checkpoint-Computer -Description 'Avant TurboPC' -RestorePointType MODIFY_SETTINGS
        Ok 'Point de restauration créé'
    } catch {
        Skip "Impossible de créer le point de restauration ($($_.Exception.Message))"
    }
}

function Step-Power {
    Say "`n> Mode d'alimentation hautes performances" Cyan
    if (-not $Backup.PowerScheme) {
        if ((powercfg /getactivescheme) -match '([0-9a-fA-F-]{36})') { $Backup.PowerScheme = $Matches[1] }
    }
    $high = '8c5e7fda-e8bf-4a96-9a85-cf6e3ad3ab7c'
    if (-not ((powercfg /list) -match $high)) { powercfg /duplicatescheme $high $high | Out-Null }
    powercfg /setactive $high
    # Sur secteur : processeur jamais bridé, ni mise en veille du disque.
    powercfg /setacvalueindex $high SUB_PROCESSOR PROCTHROTTLEMIN 100
    powercfg /setacvalueindex $high SUB_DISK DISKIDLE 0
    powercfg /setactive $high
    Ok 'Hautes performances activé (le processeur ne ralentit plus sur secteur)'
}

function Step-Visual {
    Say "`n> Effets visuels allégés (animations, transparence, ombres)" Cyan
    $adv = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
    Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' VisualFXSetting 3
    # Masque "meilleures performances" en gardant le lissage des polices.
    Set-Reg 'HKCU:\Control Panel\Desktop' UserPreferencesMask ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) Binary
    Set-Reg 'HKCU:\Control Panel\Desktop' FontSmoothing '2' String
    Set-Reg 'HKCU:\Control Panel\Desktop' MenuShowDelay '0' String
    Set-Reg 'HKCU:\Control Panel\Desktop\WindowMetrics' MinAnimate '0' String
    Set-Reg $adv TaskbarAnimations 0
    Set-Reg $adv ListviewAlphaSelect 0
    Set-Reg $adv ListviewShadow 0
    Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize' EnableTransparency 0
    Set-Reg 'HKCU:\Software\Microsoft\Windows\DWM' EnableAeroPeek 0
    Ok 'Animations et transparence coupées, menus instantanés'
}

function Step-Background {
    Say "`n> Tâches de fond inutiles" Cyan
    $cdm = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'
    Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications' GlobalUserDisabled 1
    Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search' BackgroundAppGlobalToggle 0
    Ok 'Applications du Store bloquées en arrière-plan'

    Set-Reg 'HKCU:\System\GameConfigStore' GameDVR_Enabled 0
    Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR' AppCaptureEnabled 0
    Ok "Enregistrement vidéo Xbox (Game DVR) désactivé"

    foreach ($n in 'SubscribedContent-338388Enabled', 'SubscribedContent-338389Enabled',
                   'SubscribedContent-353694Enabled', 'SubscribedContent-353696Enabled',
                   'SystemPaneSuggestionsEnabled', 'SoftLandingEnabled', 'SilentInstalledAppsEnabled') {
        Set-Reg $cdm $n 0
    }
    Ok 'Suggestions, astuces et installations silencieuses de pubs coupées'

    try { Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' TaskbarDa 0; Ok 'Widgets masqués' }
    catch { Skip 'Widgets : réglage bloqué par Windows (sans importance)' }

    Set-Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' StartupBoostEnabled 0
    Set-Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' BackgroundModeEnabled 0
    Ok "Edge ne tourne plus en cachette quand il est fermé"

    Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize' StartupDelayInMSec 0
    Ok 'Programmes de démarrage lancés sans délai artificiel'

    if (Set-ServiceStart 'DiagTrack' 'Disabled') { Ok 'Service de télémétrie (DiagTrack) arrêté' }
    if (Set-ServiceStart 'dmwappushservice' 'Disabled') { Ok 'Service de collecte WAP arrêté' }
}

function Step-Search {
    Say "`n> Indexation de la recherche Windows" Cyan
    Say '  Elle scanne vos fichiers en permanence et pèse lourd sur un Celeron.'
    Say '  Si vous la coupez, la recherche marche toujours, juste un peu plus lentement.'
    if (Ask '  Désactiver l''indexation ?') {
        if (Set-ServiceStart 'WSearch' 'Disabled') { Ok 'Indexation désactivée' }
    } else { Skip 'Indexation conservée' }
}

function Step-Clean {
    Say "`n> Nettoyage des fichiers temporaires" Cyan
    $before = (Get-PSDrive ($env:SystemDrive.TrimEnd(':'))).Free
    foreach ($dir in $env:TEMP, "$env:SystemRoot\Temp",
                     "$env:LOCALAPPDATA\Microsoft\Windows\INetCache",
                     "$env:LOCALAPPDATA\CrashDumps") {
        if (Test-Path $dir) {
            Get-ChildItem $dir -Force -ErrorAction SilentlyContinue |
                Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    # Fichiers de Windows Update déjà installés.
    Stop-Service wuauserv -Force -ErrorAction SilentlyContinue
    Get-ChildItem "$env:SystemRoot\SoftwareDistribution\Download" -Force -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Start-Service wuauserv -ErrorAction SilentlyContinue
    $freed = ((Get-PSDrive ($env:SystemDrive.TrimEnd(':'))).Free - $before) / 1MB
    Ok ("{0:N0} Mo libérés" -f [math]::Max($freed, 0))

    try {
        Optimize-Volume -DriveLetter ($env:SystemDrive.TrimEnd(':')) -ReTrim -ErrorAction Stop
        Ok 'SSD optimisé (TRIM)'
    } catch { Skip 'TRIM non disponible sur ce disque' }
}

function Step-Startup {
    Say "`n> Programmes lancés au démarrage" Cyan
    $items = Get-CimInstance Win32_StartupCommand -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Name -Unique
    if ($items) {
        Say '  Ces programmes démarrent avec Windows et ralentissent l''allumage :'
        $items | ForEach-Object { Say "    - $_" White }
    }
    Say '  Le Gestionnaire des tâches va s''ouvrir sur l''onglet "Applications de démarrage".'
    Say '  Clic droit > Désactiver sur tout ce dont vous n''avez pas besoin dès l''allumage'
    Say '  (gardez l''antivirus, le pilote audio/Wi-Fi et le pavé tactile).' DarkYellow
    Start-Process taskmgr.exe -ArgumentList '/0', '/startup'
}

function Step-WeeklyTask {
    Say "`n> Entretien automatique" Cyan
    if (Ask '  Nettoyer les fichiers temporaires automatiquement chaque dimanche ?') {
        $cmd = "Get-ChildItem `$env:SystemRoot\Temp,`$env:SystemRoot\SoftwareDistribution\Download -Force -EA 0 | Remove-Item -Recurse -Force -EA 0; Optimize-Volume -DriveLetter $($env:SystemDrive.TrimEnd(':')) -ReTrim -EA 0"
        $action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -Command `"$cmd`""
        $trigger  = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 12:00
        $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfIdle -IdleDuration 00:05:00
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
            -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
        Ok 'Nettoyage hebdomadaire programmé'
    } else { Skip 'Pas de tâche automatique' }
}

# --- Annulation ------------------------------------------------------------
function Undo-All {
    if (-not (Test-Path $BackupFile)) { Say "`nAucune sauvegarde : rien à annuler." Yellow; return }
    Say "`n> Restauration des réglages d'origine" Cyan
    foreach ($r in $Backup.Registry) {
        try {
            if ($r.Existed) {
                $v = if ($r.Type -eq 'Binary') { [Convert]::FromBase64String($r.Value) } else { $r.Value }
                New-ItemProperty -Path $r.Path -Name $r.Name -Value $v -PropertyType $r.Type -Force | Out-Null
            } elseif (Test-Path $r.Path) {
                Remove-ItemProperty -Path $r.Path -Name $r.Name -ErrorAction SilentlyContinue
            }
        } catch { Skip "$($r.Path)\$($r.Name) : $($_.Exception.Message)" }
    }
    Ok 'Registre restauré'
    foreach ($s in $Backup.Services) {
        $type = if ($s.StartType -eq 'Boot' -or $s.StartType -eq 'System') { 'Automatic' } else { $s.StartType }
        Set-Service -Name $s.Name -StartupType $type -ErrorAction SilentlyContinue
        if ($type -eq 'Automatic') { Start-Service -Name $s.Name -ErrorAction SilentlyContinue }
    }
    Ok 'Services restaurés'
    if ($Backup.PowerScheme) { powercfg /setactive $Backup.PowerScheme; Ok "Mode d'alimentation d'origine remis" }
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Remove-Item $BackupFile -Force
    $script:Backup = [ordered]@{ Registry = @(); Services = @(); PowerScheme = $null }
    Say "`nTout est revenu comme avant. Redémarrez le PC pour terminer." Green
}

# --- Menu ------------------------------------------------------------------
function Show-Header {
    Clear-Host
    Say '  ==============================================' Cyan
    Say '                    T U R B O   P C' White
    Say '        Windows 11 plus fluide sur petit PC' Gray
    Say '  ==============================================' Cyan
    $os  = Get-CimInstance Win32_OperatingSystem
    $cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim()
    $ramFree = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
    $ramAll  = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
    Say "  Processeur : $cpu"
    Say "  Mémoire    : $ramFree Go libres sur $ramAll Go"
    Say ''
}

while ($true) {
    Show-Header
    Say '  1. Optimiser mon PC (recommandé)' White
    Say '  2. Nettoyage rapide seulement' White
    Say '  3. Annuler toutes les modifications' White
    Say '  4. Quitter' White
    $choice = Read-Host "`n  Votre choix"
    switch ($choice) {
        '1' {
            Step-RestorePoint
            Step-Power;      Save-Backup
            Step-Visual;     Save-Backup
            Step-Background; Save-Backup
            Step-Search;     Save-Backup
            Step-Clean
            Step-WeeklyTask
            Step-Startup
            Say "`nTerminé ! Redémarrez le PC pour que tout prenne effet." Green
            Read-Host "`nEntrée pour revenir au menu" | Out-Null
        }
        '2' { Step-Clean; Read-Host "`nEntrée pour revenir au menu" | Out-Null }
        '3' { if (Ask "`n  Remettre tous les réglages d'origine ?") { Undo-All }
              Read-Host "`nEntrée pour revenir au menu" | Out-Null }
        '4' { exit }
    }
}
