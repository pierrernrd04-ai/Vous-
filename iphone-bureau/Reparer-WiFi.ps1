<#
    iPhone Bureau - réparer la recopie Wi-Fi de MirrorTo

    Quand l'iPhone affiche « Impossible de se connecter à MirrorTo[...] avec AirPlay »,
    c'est presque toujours Windows qui bloque la connexion entrante :
      - le réseau Wi-Fi est en mode « Public » (le PC se cache des autres appareils),
      - ou le pare-feu a enregistré un refus pour MirrorTo (fenêtre d'autorisation fermée).
    Ce script corrige les deux, puis relance MirrorTo.
#>

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'iPhone Bureau - réparation Wi-Fi'

# --- Droits administrateur (nécessaires pour le pare-feu) -------------------
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    exit
}

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Skip($text) { Write-Host "  [--] $text" -ForegroundColor DarkYellow }

Say ''
Say '  Réparation de la recopie Wi-Fi (MirrorTo)' Cyan
Say '  ------------------------------------------' Cyan
Say ''

try {
    # --- 1. Où est installé MirrorTo ? -------------------------------------
    $folder = $null
    $keys = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
            'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
            'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    foreach ($app in (Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*MirrorTo*' })) {
        foreach ($candidate in @($app.InstallLocation, $app.DisplayIcon)) {
            if (-not $candidate) { continue }
            $p = ($candidate -split ',')[0].Trim('"')
            if (Test-Path $p -PathType Leaf) { $p = Split-Path $p }
            if (Test-Path $p -PathType Container) { $folder = $p; break }
        }
        if ($folder) { break }
    }
    if (-not $folder) {
        $folder = Get-ChildItem "$env:ProgramFiles*\*", "$env:LOCALAPPDATA\Programs\*" -Directory -ErrorAction SilentlyContinue |
            Where-Object { Get-ChildItem $_.FullName -Recurse -Filter '*MirrorTo*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1 } |
            Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $folder) { throw 'MirrorTo est introuvable sur ce PC. Installez-le d''abord (étape 1 du guide).' }
    Ok "MirrorTo trouvé : $folder"
    $exes = @(Get-ChildItem $folder -Recurse -Filter '*.exe' -ErrorAction SilentlyContinue)
    $main = $exes | Where-Object { $_.BaseName -match 'mirrorto' -and $_.BaseName -notmatch 'unins|update|crash' } |
        Sort-Object { $_.FullName.Length } | Select-Object -First 1

    # --- 2. Fermer MirrorTo (il sera relancé à la fin) ----------------------
    Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($folder, [StringComparison]::OrdinalIgnoreCase) } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Ok 'MirrorTo fermé le temps de la réparation'

    # --- 3. Réseau Wi-Fi en « Privé » ---------------------------------------
    $profiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue)
    foreach ($np in $profiles) {
        if ($np.NetworkCategory -eq 'Public') {
            Set-NetConnectionProfile -InterfaceIndex $np.InterfaceIndex -NetworkCategory Private
            Ok "Réseau « $($np.Name) » passé de Public à Privé (le PC devient visible par l'iPhone)"
        } else {
            Ok "Réseau « $($np.Name) » déjà en mode $($np.NetworkCategory)"
        }
    }

    # --- 4. Pare-feu : retirer les refus, autoriser MirrorTo ---------------
    Say '  Analyse du pare-feu (10 à 30 secondes)...'
    $removed = 0
    $filters = Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue |
        Where-Object { $_.Program -and $_.Program.StartsWith($folder, [StringComparison]::OrdinalIgnoreCase) }
    foreach ($f in $filters) {
        $rule = $f | Get-NetFirewallRule -ErrorAction SilentlyContinue
        if ($rule -and $rule.Action -eq 'Block') { $rule | Remove-NetFirewallRule; $removed++ }
    }
    if ($removed) { Ok "$removed règle(s) de blocage de MirrorTo supprimée(s)" } else { Ok 'Aucun blocage de MirrorTo dans le pare-feu' }

    Get-NetFirewallRule -Group 'iPhone Bureau' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    foreach ($exe in $exes) {
        foreach ($dir in 'Inbound', 'Outbound') {
            New-NetFirewallRule -DisplayName "iPhone Bureau - $($exe.BaseName)" -Group 'iPhone Bureau' `
                -Direction $dir -Program $exe.FullName -Action Allow -Profile Any | Out-Null
        }
    }
    # Découverte des appareils AirPlay (mDNS / Bonjour).
    New-NetFirewallRule -DisplayName 'iPhone Bureau - découverte AirPlay (mDNS)' -Group 'iPhone Bureau' `
        -Direction Inbound -Protocol UDP -LocalPort 5353 -Action Allow -Profile Any | Out-Null
    Ok "Pare-feu : MirrorTo autorisé ($($exes.Count) programme(s)) et découverte AirPlay ouverte"

    $bonjour = Get-Service -Name 'Bonjour Service' -ErrorAction SilentlyContinue
    if ($bonjour) {
        Set-Service $bonjour.Name -StartupType Automatic
        if ($bonjour.Status -ne 'Running') { Start-Service $bonjour.Name }
        Ok 'Service Bonjour démarré'
    }

    # --- 5. Relancer MirrorTo sans droits administrateur --------------------
    # (sinon le widget iPhone Bureau ne pourrait plus déplacer sa fenêtre)
    if ($main) {
        Start-Process explorer.exe -ArgumentList "`"$($main.FullName)`""
        Ok 'MirrorTo relancé'
    } else {
        Skip 'Relancez MirrorTo vous-même (programme principal non identifié)'
    }

    $wifi = ($profiles | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|WLAN|Sans fil' } | Select-Object -First 1).Name
    Say ''
    Say '  Sur l''iPhone maintenant :' Cyan
    if ($wifi) { Say "  1. Vérifiez qu'il est connecté au Wi-Fi « $wifi » (le même que le PC)." }
    else { Say '  1. Vérifiez qu''il est connecté au même Wi-Fi que le PC.' }
    Say '  2. Dans MirrorTo : onglet WiFi, puis « Cliquez ici pour actualiser ».'
    Say '  3. Centre de contrôle > Recopie de l''écran > MirrorTo[...] (le nom SANS « _1 » s''il y en a deux).'
    Say ''
    Say '  Toujours bloqué ? Prenez l''onglet USB dans MirrorTo avec le câble : c''est le plus fiable.' Yellow
    Say ''
    Read-Host '  Appuyez sur Entrée pour fermer'
}
catch {
    Say ''
    Say "  [ERREUR] $($_.Exception.Message)" Red
    Say ''
    Read-Host '  Appuyez sur Entrée pour fermer'
}
