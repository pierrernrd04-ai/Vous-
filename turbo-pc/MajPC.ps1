<#
    MajPC - met à jour Windows, les pilotes, l'antivirus et toutes les applications

    Les failles de sécurité et beaucoup de lenteurs viennent de logiciels
    pas à jour. MajPC fait tout d'un coup, sans aller dans chaque menu.
#>
param([switch]$Auto)   # -Auto : tout appliquer sans poser de question

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'MajPC'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Auto) { $argList += '-Auto' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $argList
    exit
}

$TaskName = 'MajPC - Mise à jour hebdomadaire des applications'

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Skip($text) { Write-Host "  [--] $text" -ForegroundColor DarkYellow }

function Ask($question, $default = $true) {
    if ($Auto) { return $default }
    do { $r = (Read-Host "$question (O/N)").Trim().ToUpper() } while ($r -notin 'O', 'N')
    return $r -eq 'O'
}

function Invoke-Step([scriptblock]$step) {
    try { & $step } catch { Skip "Étape interrompue : $($_.Exception.Message)" }
}

$script:RebootNeeded = $false

function Step-Defender {
    Say "`n> Antivirus" Cyan
    try { Update-MpSignature; Ok 'Définitions de virus à jour' }
    catch { Skip 'Defender non disponible (autre antivirus installé ?)' }
}

function Step-WindowsUpdate {
    Say "`n> Windows Update (système + pilotes)" Cyan
    Say '  Recherche des mises à jour, cela peut prendre quelques minutes...'
    $session  = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $found    = $searcher.Search("IsInstalled=0 and IsHidden=0").Updates

    $todo = New-Object -ComObject Microsoft.Update.UpdateColl
    foreach ($u in $found) {
        if ($u.BrowseOnly) { continue }   # mises à jour "facultatives" laissées de côté
        if (-not $u.EulaAccepted) { $u.AcceptEula() }
        [void]$todo.Add($u)
        Say "    - $($u.Title)" White
    }
    if ($todo.Count -eq 0) { Ok 'Windows est déjà à jour'; return }

    Say "  Téléchargement de $($todo.Count) mise(s) à jour..."
    $dl = $session.CreateUpdateDownloader(); $dl.Updates = $todo; [void]$dl.Download()
    Say '  Installation...'
    $inst = $session.CreateUpdateInstaller(); $inst.Updates = $todo
    $res = $inst.Install()
    if ($res.RebootRequired) { $script:RebootNeeded = $true }
    Ok "$($todo.Count) mise(s) à jour Windows installée(s)"
}

function Step-Apps {
    Say "`n> Applications (Chrome, Firefox, VLC, Zoom, 7-Zip...)" Cyan
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Skip 'winget absent : installez "Programme d''installation d''application" depuis le Microsoft Store'
        return
    }
    winget source update --disable-interactivity | Out-Null
    winget upgrade --all --silent --accept-source-agreements --accept-package-agreements --disable-interactivity
    Ok 'Applications mises à jour'
}

function Step-Store {
    Say "`n> Applications du Microsoft Store" Cyan
    try {
        Get-CimInstance -Namespace 'root\cimv2\mdm\dmmap' -ClassName 'MDM_EnterpriseModernAppManagement_AppManagement01' |
            Invoke-CimMethod -MethodName UpdateScanMethod | Out-Null
        Ok 'Mise à jour du Store lancée (elle continue en arrière-plan)'
    } catch { Skip 'Ouvrez le Store > Bibliothèque > "Obtenir les mises à jour"' }
}

function Step-Schedule {
    Say "`n> Mises à jour automatiques" Cyan
    if (Ask '  Mettre à jour les applications automatiquement chaque mercredi ?') {
        $action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument `
            '-NoProfile -WindowStyle Hidden -Command "winget upgrade --all --silent --accept-source-agreements --accept-package-agreements --disable-interactivity"'
        $trigger   = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Wednesday -At 13:00
        $settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
        $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
            -Principal $principal -Force | Out-Null
        Ok 'Programmé chaque mercredi (rattrapé au prochain allumage si le PC était éteint)'
    } else { Skip 'Pas de mise à jour automatique' }
}

function Invoke-Update {
    Invoke-Step { Step-Defender }
    Invoke-Step { Step-WindowsUpdate }
    Invoke-Step { Step-Apps }
    Invoke-Step { Step-Store }
    Invoke-Step { Step-Schedule }
    if ($script:RebootNeeded) { Say "`nMajPC terminé. Un redémarrage est nécessaire pour finir l'installation." Yellow }
    else { Say "`nMajPC terminé. Tout est à jour." Green }
}

if ($Auto) { Invoke-Update; return }

while ($true) {
    Clear-Host
    Say '  ==============================================' Cyan
    Say '                    M A J   P C' White
    Say '      Windows, pilotes et applis à jour' Gray
    Say '  ==============================================' Cyan
    Say "`n  1. Tout mettre à jour (recommandé)" White
    Say '  2. Seulement les applications' White
    Say '  3. Arrêter les mises à jour automatiques des applis' White
    Say '  4. Quitter' White
    switch (Read-Host "`n  Votre choix") {
        '1' { Invoke-Update }
        '2' { Invoke-Step { Step-Apps } }
        '3' { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue; Ok 'Tâche supprimée' }
        '4' { exit }
    }
    Read-Host "`nEntrée pour revenir au menu" | Out-Null
}
