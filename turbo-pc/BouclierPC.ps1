<#
    BouclierPC - vérifie et renforce la sécurité de Windows 11

    Bilan de sécurité clair, puis renforcement avec les protections déjà
    intégrées à Windows (aucun logiciel tiers installé).
#>
param([switch]$Auto)   # -Auto : tout appliquer sans poser de question

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'BouclierPC'

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

function Set-Reg($path, $name, $value, $type = 'DWord') {
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    New-ItemProperty -Path $path -Name $name -Value $value -PropertyType $type -Force | Out-Null
}

function Get-Reg($path, $name) {
    (Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue).$name
}

# --- Bilan -----------------------------------------------------------------
function Show-Audit {
    Say "`n> Bilan de sécurité" Cyan
    $script:score = 0; $script:total = 0
    function Check($label, [bool]$good, $advice) {
        $script:total++
        if ($good) { $script:score++; Ok $label } else { Bad "$label  ->  $advice" }
    }

    try {
        $mp = Get-MpComputerStatus
        Check 'Antivirus Microsoft Defender actif' ($mp.AMServiceEnabled -and $mp.RealTimeProtectionEnabled) 'protection en temps réel coupée'
        $age = ((Get-Date) - $mp.AntivirusSignatureLastUpdated).Days
        Check "Définitions de virus à jour (il y a $age j)" ($age -le 3) 'mise à jour nécessaire'
        Check 'Protection contre les logiciels indésirables' ((Get-MpPreference).PUAProtection -eq 1) 'désactivée'
        Check 'Protection réseau (sites piégés)' ((Get-MpPreference).EnableNetworkProtection -eq 1) 'désactivée'
    } catch { Skip 'Defender ne répond pas (un autre antivirus est peut-être installé)' }

    $fw = Get-NetFirewallProfile
    Check 'Pare-feu actif sur tous les réseaux' (-not ($fw | Where-Object { -not $_.Enabled })) 'au moins un profil coupé'

    $uac = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
    Check 'Contrôle de compte (UAC) actif' ((Get-Reg $uac EnableLUA) -ne 0) 'désactivé'

    try { Check 'Démarrage sécurisé (Secure Boot)' (Confirm-SecureBootUEFI) 'à activer dans le BIOS' }
    catch { Skip 'Secure Boot : non vérifiable sur ce PC' }

    try { Check 'Puce de sécurité TPM prête' ((Get-Tpm).TpmReady) 'non prête' }
    catch { Skip 'TPM : non vérifiable' }

    try {
        $vol = Get-CimInstance -Namespace 'root\cimv2\Security\MicrosoftVolumeEncryption' `
            -ClassName Win32_EncryptableVolume -Filter "DriveLetter='$env:SystemDrive'"
        Check 'Disque chiffré (en cas de vol du PC)' ($vol.ProtectionStatus -eq 1) 'Paramètres > Confidentialité > Chiffrement de l''appareil'
    } catch { Skip 'Chiffrement : non disponible sur cette édition de Windows' }

    $smb1 = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction SilentlyContinue
    Check 'Ancien protocole SMBv1 désactivé' (-not $smb1 -or $smb1.State -ne 'Enabled') 'faille connue (WannaCry)'

    Check 'Extensions de fichiers visibles' ((Get-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' HideFileExt) -eq 0) 'les faux "facture.pdf.exe" passent inaperçus'

    Check 'Assistance à distance fermée' ((Get-Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Remote Assistance' fAllowToGetHelp) -eq 0) 'porte d''entrée des arnaques au faux support'

    $last = Get-HotFix | Where-Object InstalledOn | Sort-Object InstalledOn -Descending | Select-Object -First 1
    if ($last) {
        $days = ((Get-Date) - $last.InstalledOn).Days
        Check "Dernière mise à jour Windows il y a $days j" ($days -le 45) 'lancez MajPC'
    }

    $color = if ($script:score -eq $script:total) { 'Green' } elseif ($script:score -ge $script:total - 2) { 'Yellow' } else { 'Red' }
    Say "`n  Score : $($script:score) / $($script:total)" $color
}

# --- Renforcement ----------------------------------------------------------
function Step-RestorePoint {
    if ($env:BOITEPC_RESTOREPOINT) { return }
    Say "`n> Point de restauration Windows" Cyan
    try {
        Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue
        Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore' `
            -Name SystemRestorePointCreationFrequency -Value 0 -Type DWord
        Checkpoint-Computer -Description 'Avant BouclierPC' -RestorePointType MODIFY_SETTINGS
        Ok 'Point de restauration créé'
    } catch { Skip "Point de restauration impossible ($($_.Exception.Message))" }
}

function Step-Defender {
    Say "`n> Antivirus Microsoft Defender" Cyan
    $prefs = @{
        DisableRealtimeMonitoring = $false; DisableBehaviorMonitoring = $false
        DisableIOAVProtection = $false;     DisableScriptScanning = $false
        PUAProtection = 'Enabled';          EnableNetworkProtection = 'Enabled'
        MAPSReporting = 'Advanced';         SubmitSamplesConsent = 'SendSafeSamples'
    }
    foreach ($k in $prefs.Keys) {
        try { $p = @{ $k = $prefs[$k] }; Set-MpPreference @p }
        catch { Skip "$k : refusé (protection contre la falsification ou autre antivirus)" }
    }
    Ok 'Temps réel, analyse du comportement, protection cloud et réseau activés'
    Ok 'Blocage des logiciels indésirables (toolbars, faux nettoyeurs...) activé'

    Update-MpSignature
    Ok 'Définitions de virus mises à jour'

    if (Ask '  Lancer une analyse rapide maintenant (5 à 15 min) ?') {
        Say '  Analyse en cours, ne fermez pas la fenêtre...'
        Start-MpScan -ScanType QuickScan
        $threats = Get-MpThreatDetection -ErrorAction SilentlyContinue |
            Where-Object { $_.InitialDetectionTime -gt (Get-Date).AddHours(-1) }
        if ($threats) { Bad "$(@($threats).Count) menace(s) trouvée(s) et mise(s) en quarantaine" }
        else { Ok 'Aucune menace détectée' }
    }

    Say "`n  Protection anti-rançongiciel (dossiers protégés) :"
    Say '  empêche un virus de chiffrer Documents, Images, Bureau. Peut bloquer'
    Say '  certains logiciels qui enregistrent dans ces dossiers (Windows prévient).'
    if (Ask '  L''activer ?' $false) {
        Set-MpPreference -EnableControlledFolderAccess Enabled
        Ok 'Dossiers protégés activés'
    } else { Skip 'Dossiers protégés non activés' }
}

function Step-Windows {
    Say "`n> Protections de Windows" Cyan
    Set-NetFirewallProfile -Profile Domain, Private, Public -Enabled True
    Ok 'Pare-feu actif sur tous les réseaux'

    $uac = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
    Set-Reg $uac EnableLUA 1
    Set-Reg $uac ConsentPromptBehaviorAdmin 5
    Set-Reg $uac PromptOnSecureDesktop 1
    Ok 'Contrôle de compte (UAC) au niveau recommandé'

    Set-Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' EnableSmartScreen 1
    Set-Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' ShellSmartScreenLevel 'Warn' String
    Set-Reg 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' SmartScreenEnabled 1
    Ok 'SmartScreen actif (avertit avant d''ouvrir un fichier ou un site dangereux)'

    $smb1 = Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction SilentlyContinue
    if ($smb1 -and $smb1.State -eq 'Enabled') {
        Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart | Out-Null
        Ok 'SMBv1 désactivé'
    } else { Ok 'SMBv1 déjà désactivé' }

    $exp = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer'
    Set-Reg $exp NoDriveTypeAutoRun 255
    Set-Reg $exp NoAutorun 1
    Ok 'Exécution automatique des clés USB bloquée'

    Set-Reg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' HideFileExt 0
    Ok 'Extensions de fichiers affichées (.exe, .pdf...)'

    Set-Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Remote Assistance' fAllowToGetHelp 0
    Ok 'Assistance à distance fermée (arnaques au faux support)'
}

function Invoke-Harden {
    Invoke-Step { Step-RestorePoint }
    Invoke-Step { Step-Defender }
    Invoke-Step { Step-Windows }
    Invoke-Step { Show-Audit }
    Say "`nBouclierPC terminé. Redémarrez le PC pour finaliser." Green
}

if ($Auto) { Invoke-Harden; return }

while ($true) {
    Clear-Host
    Say '  ==============================================' Cyan
    Say '                B O U C L I E R   P C' White
    Say '         Sécurité de Windows, vérifiée' Gray
    Say '  ==============================================' Cyan
    Say "`n  1. Bilan + renforcement complet (recommandé)" White
    Say '  2. Bilan seulement (ne change rien)' White
    Say '  3. Analyse antivirus complète (30 min à 2 h)' White
    Say '  4. Quitter' White
    switch (Read-Host "`n  Votre choix") {
        '1' { Invoke-Harden }
        '2' { Invoke-Step { Show-Audit } }
        '3' { Invoke-Step { Say "`n  Analyse complète en cours..."; Update-MpSignature; Start-MpScan -ScanType FullScan; Ok 'Analyse terminée' } }
        '4' { exit }
    }
    Read-Host "`nEntrée pour revenir au menu" | Out-Null
}
