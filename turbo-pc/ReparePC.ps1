<#
    ReparePC - diagnostique et répare Windows

    Répare les fichiers système abîmés (cause classique des bugs et
    plantages), vérifie l'état du SSD et de la batterie, et répare Internet.
#>
param([switch]$Auto)   # -Auto : tout appliquer sans poser de question

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'ReparePC'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    if ($Auto) { $argList += '-Auto' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $argList
    exit
}

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Bad($text)  { Write-Host "  [!!] $text" -ForegroundColor Red }
function Skip($text) { Write-Host "  [--] $text" -ForegroundColor DarkYellow }

function Ask($question, $default = $true) {
    if ($Auto) { return $default }
    do { $r = (Read-Host "$question (O/N)").Trim().ToUpper() } while ($r -notin 'O', 'N')
    return $r -eq 'O'
}

function Invoke-Step([scriptblock]$step) {
    try { & $step } catch { Skip "Étape interrompue : $($_.Exception.Message)" }
}

function Step-Health {
    Say "`n> État du disque" Cyan
    foreach ($d in Get-PhysicalDisk) {
        $msg = "$($d.FriendlyName) ($($d.MediaType), $([math]::Round($d.Size / 1GB)) Go)"
        if ($d.HealthStatus -eq 'Healthy') { Ok "$msg : en bonne santé" } else { Bad "$msg : $($d.HealthStatus), sauvegardez vos fichiers" }
        $rel = $d | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
        if ($rel -and $null -ne $rel.Wear) { Say "       usure : $($rel.Wear) %" }
        if ($rel -and $rel.Temperature)   { Say "       température : $($rel.Temperature) °C" }
    }
    $sys = Get-PSDrive ($env:SystemDrive.TrimEnd(':'))
    $freeGb = [math]::Round($sys.Free / 1GB, 1)
    $pct = [math]::Round(100 * $sys.Free / ($sys.Free + $sys.Used))
    if ($pct -ge 15) { Ok "Espace libre : $freeGb Go ($pct %)" }
    else { Bad "Espace libre : $freeGb Go ($pct %) -> sous 15 %, Windows ralentit. Lancez AllegePC." }

    Say "`n> Batterie" Cyan
    try {
        $full   = (Get-CimInstance -Namespace root\wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1).FullChargedCapacity
        $design = (Get-CimInstance -Namespace root\wmi -ClassName BatteryStaticData | Select-Object -First 1).DesignedCapacity
        $h = [math]::Round(100 * $full / $design)
        if ($h -ge 70) { Ok "Batterie à $h % de sa capacité d'origine" }
        else { Bad "Batterie à $h % de sa capacité d'origine (usée)" }
    } catch { Skip 'Capacité de la batterie non lisible' }
    $report = Join-Path ([Environment]::GetFolderPath('Desktop')) 'rapport-batterie.html'
    powercfg /batteryreport /output "$report" | Out-Null
    if (Test-Path $report) { Ok "Rapport détaillé enregistré sur le Bureau : rapport-batterie.html" }

    Say "`n> Plantages récents" Cyan
    $crashes = Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = 41, 1001, 6008; StartTime = (Get-Date).AddDays(-30) } `
        -ErrorAction SilentlyContinue
    $n = @($crashes).Count
    if ($n -eq 0) { Ok 'Aucun arrêt brutal ni écran bleu ces 30 derniers jours' }
    else { Bad "$n arrêt(s) brutal(aux) ou écran(s) bleu(s) ces 30 derniers jours" }
}

function Step-System {
    Say "`n> Réparation des fichiers Windows" Cyan
    Say '  Étape longue (15 à 40 min sur ce PC). Laissez le PC branché et la fenêtre ouverte.' DarkYellow
    Say "`n  1/3 Réparation de l'image Windows (DISM)..."
    DISM /Online /Cleanup-Image /RestoreHealth
    Say "`n  2/3 Vérification des fichiers système (SFC)..."
    sfc /scannow
    Say "`n  3/3 Nettoyage des anciens composants Windows..."
    DISM /Online /Cleanup-Image /StartComponentCleanup
    Ok 'Fichiers système vérifiés et réparés'

    Say "`n> Vérification du disque" Cyan
    chkdsk $env:SystemDrive /scan
    Ok 'Disque vérifié (sans redémarrage)'
}

function Step-Network {
    Say "`n> Réparation d'Internet" Cyan
    ipconfig /flushdns | Out-Null
    netsh winsock reset | Out-Null
    netsh int ip reset | Out-Null
    ipconfig /release | Out-Null
    ipconfig /renew | Out-Null
    Ok 'Cache DNS vidé, pile réseau réinitialisée (redémarrage nécessaire)'
}

function Invoke-Repair {
    Invoke-Step { Step-Health }
    Invoke-Step { Step-System }
    if (Ask "`n  Vous avez des soucis d'Internet ou de Wi-Fi ? Réparer le réseau ?" $false) { Invoke-Step { Step-Network } }
    Say "`nReparePC terminé. Redémarrez le PC." Green
}

if ($Auto) { Invoke-Repair; return }

while ($true) {
    Clear-Host
    Say '  ==============================================' Cyan
    Say '                R E P A R E   P C' White
    Say '        Diagnostic et réparation de Windows' Gray
    Say '  ==============================================' Cyan
    Say "`n  1. Diagnostic + réparation complète (recommandé)" White
    Say '  2. Diagnostic seulement (disque, batterie, plantages)' White
    Say "  3. Réparer Internet / Wi-Fi" White
    Say '  4. Tester la mémoire RAM (redémarre le PC)' White
    Say '  5. Quitter' White
    switch (Read-Host "`n  Votre choix") {
        '1' { Invoke-Repair }
        '2' { Invoke-Step { Step-Health } }
        '3' { Invoke-Step { Step-Network } }
        '4' { if (Ask '  Le PC va redémarrer pour tester la RAM (10 min). Continuer ?') { Start-Process mdsched.exe } }
        '5' { exit }
    }
    Read-Host "`nEntrée pour revenir au menu" | Out-Null
}
