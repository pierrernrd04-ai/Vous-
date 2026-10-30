<#
    Mes widgets - installation dans Rainmeter
    Met TOUS les widgets sur le bureau Windows, sans Lively : les 14 widgets du tracker
    Routine & Performance et les 3 widgets Dan't Procrastiner, chacun dans son skin
    Rainmeter, déplaçable (Ctrl + glisser), toujours sous les fenêtres.

    1. installe Rainmeter s'il manque (winget, sinon l'installeur officiel signé sur GitHub)
    2. ajoute le plugin WebView2 (NSTechBytes) qui affiche une page web dans un skin
    3. demande les codes de liaison et crée les skins « MesWidgets\Tracker » et « MesWidgets\Dant »
    -Desinstaller : retire les skins (Rainmeter reste installé).
#>
param([switch]$Desinstaller)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Host.UI.RawUI.WindowTitle = 'Mes widgets - Rainmeter'

$Site      = 'https://pierrernrd04-ai.github.io/Vous-/'
$RmSetup   = 'https://github.com/rainmeter/rainmeter/releases/download/v4.5.28.3936/Rainmeter-4.5.28.exe'
$PluginZip = 'https://github.com/NSTechBytes/WebView2/releases/download/v1.0.0/WebView2_v1.0.0_x64_x86_dll.zip'
$RmData    = Join-Path $env:APPDATA 'Rainmeter'
$Suite     = 'MesWidgets'

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text) { Write-Host "  [OK] $text" -ForegroundColor Green }

function Find-Rainmeter {
    foreach ($p in @("$env:ProgramFiles\Rainmeter\Rainmeter.exe", "${env:ProgramFiles(x86)}\Rainmeter\Rainmeter.exe", "$env:LOCALAPPDATA\Programs\Rainmeter\Rainmeter.exe")) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

function Install-Rainmeter {
    $exe = Find-Rainmeter
    if ($exe) { Ok 'Rainmeter est déjà installé'; return $exe }
    Say '  Installation de Rainmeter (gratuit, open source)...'
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install -e --id Rainmeter.Rainmeter --silent --accept-package-agreements --accept-source-agreements | Out-Null
        $exe = Find-Rainmeter
    }
    if (-not $exe) {
        $setup = Join-Path $env:TEMP 'Rainmeter-setup.exe'
        Invoke-WebRequest $RmSetup -OutFile $setup -UseBasicParsing
        $sig = Get-AuthenticodeSignature $setup
        if ($sig.Status -ne 'Valid') {
            Remove-Item $setup -Force -ErrorAction SilentlyContinue
            throw 'L''installeur de Rainmeter n''a pas de signature valide. Installez-le à la main depuis rainmeter.net, puis relancez cette commande.'
        }
        Ok "Installeur signé par : $($sig.SignerCertificate.GetNameInfo('SimpleName', $false))"
        Say '  Si Windows demande l''autorisation, acceptez (installation dans Program Files).' Yellow
        Start-Process $setup -ArgumentList '/S', '/AUTOSTARTUP=1', '/RESTART=0' -Wait
        Remove-Item $setup -Force -ErrorAction SilentlyContinue
        $exe = Find-Rainmeter
    }
    if (-not $exe) { throw 'Rainmeter ne s''est pas installé. Installez-le depuis rainmeter.net, puis relancez cette commande.' }
    Ok 'Rainmeter installé'
    return $exe
}

function Stop-Rainmeter {
    Get-Process Rainmeter -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }
    for ($i = 0; $i -lt 40 -and (Get-Process Rainmeter -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 150 }
    Get-Process Rainmeter -ErrorAction SilentlyContinue | Stop-Process -Force
}

function Install-Plugin {
    $plugins = Join-Path $RmData 'Plugins'
    New-Item -ItemType Directory -Force -Path $plugins | Out-Null
    Say '  Téléchargement du plugin WebView2 pour Rainmeter (NSTechBytes, GitHub)...'
    $zip = Join-Path $env:TEMP 'rm-webview2.zip'
    $tmp = Join-Path $env:TEMP 'rm-webview2'
    Invoke-WebRequest $PluginZip -OutFile $zip -UseBasicParsing
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive $zip -DestinationPath $tmp -Force
    $arch = if ([Environment]::Is64BitOperatingSystem) { 'x64' } else { 'x32' }
    $dll = Get-ChildItem $tmp -Recurse -Filter 'WebView2.dll' | Where-Object { $_.FullName -match "\\$arch\\|$arch\\\\|$arch" } | Select-Object -First 1
    if (-not $dll) { $dll = Get-ChildItem $tmp -Recurse -Filter 'WebView2.dll' | Select-Object -First 1 }
    Copy-Item $dll.FullName (Join-Path $plugins 'WebView2.dll') -Force
    Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Ok "Plugin WebView2 installé ($arch)"
}

# Dossier des skins : celui que Rainmeter a choisi (Documents\Rainmeter\Skins par défaut)
function Get-SkinsPath {
    $ini = Join-Path $RmData 'Rainmeter.ini'
    if (Test-Path $ini) {
        $line = Select-String -Path $ini -Pattern '^\s*SkinPath\s*=\s*(.+)$' | Select-Object -First 1
        if ($line) { return $line.Matches[0].Groups[1].Value.Trim() }
    }
    return Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Rainmeter\Skins'
}

# Accepte un code (7KQ2-M9XF-3HWD) ou un lien complet de widgets (…/widgets/#CODE&dant=CODE…)
function Read-Code($text) {
    $alpha = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    $c = ($text.ToUpper() -replace 'O', '0' -replace '[IL]', '1' -replace '[^0-9A-Z]', '')
    if ($c.Length -ne 12) { return $null }
    foreach ($ch in $c.ToCharArray()) { if ($alpha.IndexOf($ch) -lt 0) { return $null } }
    return $c.Substring(0, 4) + '-' + $c.Substring(4, 4) + '-' + $c.Substring(8, 4)
}
function Split-Link($text) {
    $r = @{ main = $null; dant = $null }
    $t = $text.Trim()
    if ($t -match '#([^&]+)') { $r.main = Read-Code $Matches[1] } else { $r.main = Read-Code $t }
    if ($t -match '[#&]dant=([^&]+)') { $r.dant = Read-Code $Matches[1] }
    return $r
}

# Taille de l'écran en vrais pixels (Rainmeter place les skins en pixels physiques)
function Get-Screen {
    Add-Type -Namespace DpiNs -Name Dpi -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -ErrorAction SilentlyContinue
    try { [DpiNs.Dpi]::SetProcessDPIAware() | Out-Null } catch { }
    Add-Type -AssemblyName System.Windows.Forms
    return [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
}

function Write-Skin($folder, $name, $title, $w, $h) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    $ini = @"
[Rainmeter]
Update=1000
AccurateText=1

[Metadata]
Name=$title
Author=Pierre
Information=Page web en direct (plugin WebView2). Ctrl + glisser pour déplacer, Ctrl + clic droit pour le menu.
Version=1.0

[WebView2]
Measure=Plugin
Plugin=WebView2
URL=file:///#@#$name.html
W=$w
H=$h
X=0
Y=0
Clickthrough=2
ZoomControl=0
NewWindow=1

[Fond]
Meter=Image
W=$w
H=$h
SolidColor=0,0,0,1
"@
    Set-Content -Path (Join-Path $folder "$name.ini") -Value $ini -Encoding Unicode
}

# Petite page locale qui ouvre la vraie page : le code reste sur le PC, jamais dans le .ini
function Write-Redirect($res, $name, $url) {
    $html = "<!doctype html><meta charset=`"utf-8`"><style>html,body{background:transparent;margin:0}</style><script>location.replace(`"$url`")</script>"
    Set-Content -Path (Join-Path $res "$name.html") -Value $html -Encoding UTF8
}

Say ''
Say '  Mes widgets - tracker + Dan''t sur le bureau, avec Rainmeter' Cyan
Say '  ------------------------------------------------------------' Cyan
Say ''

try {
    $skins = Get-SkinsPath
    $root = Join-Path $skins $Suite
    if ($Desinstaller) {
        $exe = Find-Rainmeter
        if ($exe) { & $exe '!DeactivateConfig' "$Suite\Tracker"; & $exe '!DeactivateConfig' "$Suite\Dant"; Start-Sleep -Seconds 1 }
        Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
        Ok 'Skins « Mes widgets » retirés (Rainmeter reste installé, désinstallable depuis Paramètres > Applications).'
        Start-Sleep -Seconds 4
        exit
    }

    $exe = Install-Rainmeter
    Stop-Rainmeter
    Install-Plugin

    Say ''
    Say '  Colle le lien de tes widgets du tracker (celui de Lively), ou juste son code.' Yellow
    Say '  (Il est dans Lively : clic droit sur le fond > Personnaliser, ou dans le tracker : Mes apps > Widgets PC.)' DarkGray
    $tracker = $null; $dant = $null
    while (-not $tracker) {
        $l = Split-Link (Read-Host '  Tracker')
        $tracker = $l.main; if ($l.dant) { $dant = $l.dant }
        if (-not $tracker) { Say '  Le code fait 12 caractères, comme 7KQ2-M9XF-3HWD. Réessaie.' Red }
    }
    if ($dant) { Ok "Code Dan't trouvé dans le lien : $dant" }
    while (-not $dant) {
        Say '  Code Dan''t : sur l''iPhone, Dan''t > roue dentée > Widgets sur le PC (Entrée pour passer).' Yellow
        $t = Read-Host '  Dan''t'
        if (-not $t) { break }
        $dant = (Split-Link $t).main
        if (-not $dant) { Say '  Le code fait 12 caractères. Réessaie.' Red }
    }
    $th = Read-Host '  Thème : sombre, clair ou auto ? (Entrée = sombre)'
    $theme = if ($th -match '^c') { 'clair' } elseif ($th -match '^a') { 'auto' } else { 'sombre' }
    $trackerTheme = @{ clair = 'light'; sombre = 'dark'; auto = 'auto' }[$theme]

    # Mise en place : Dan't en haut à droite, le tracker juste à sa gauche ; les icônes du bureau restent libres
    $wa = Get-Screen
    $m = [int]($wa.Height * .03)
    $dH = [int]($wa.Height * .62); $dW = [int]($dH * 2.11 / 3.22)
    $tW = [int][Math]::Min($wa.Width * .56, ($wa.Width - $dW - 3 * $m) * .9); $tH = [int][Math]::Min($wa.Height * .78, $tW * 4.36 / 6.6 + 50)
    $dX = $wa.Right - $dW - $m; $dY = $wa.Top + $m
    $tX = $dX - $tW - $m; $tY = $wa.Top + $m

    $res = Join-Path $root '@Resources'
    New-Item -ItemType Directory -Force -Path $res | Out-Null
    Write-Redirect $res 'tracker' "$($Site)widgets/#$tracker&fond=0&cote=centre&theme=$trackerTheme"
    Write-Skin (Join-Path $root 'Tracker') 'Tracker' 'Mes widgets · Tracker' $tW $tH
    if ($dant) {
        Write-Redirect $res 'dant' "$($Site)dant-procrastiner/widgets/#$dant&mode=bureau&theme=$theme"
        Write-Skin (Join-Path $root 'Dant') 'Dant' 'Mes widgets · Dan''t' $dW $dH
    }
    Ok "Skins créés dans $root"

    Start-Process $exe
    Start-Sleep -Seconds 4
    & $exe '!ActivateConfig' "$Suite\Tracker" 'Tracker.ini'
    Start-Sleep -Milliseconds 600
    & $exe '!Move' $tX $tY "$Suite\Tracker"
    & $exe '!ZPos' '-2' "$Suite\Tracker"
    if ($dant) {
        & $exe '!ActivateConfig' "$Suite\Dant" 'Dant.ini'
        Start-Sleep -Milliseconds 600
        & $exe '!Move' $dX $dY "$Suite\Dant"
        & $exe '!ZPos' '-2' "$Suite\Dant"
    }
    Ok 'Widgets affichés sur le bureau'
    Say ''
    Say '  - Ctrl + glisser : déplacer un bloc de widgets.' 
    Say '  - Ctrl + clic droit : menu Rainmeter (position, transparence, fermer...).'
    Say '  - Lively : choisis un fond simple (ou quitte Lively), sinon les widgets du tracker apparaissent deux fois.'
    Say ''
    Start-Sleep -Seconds 10
}
catch {
    Say ''
    Say "  [ERREUR] $($_.Exception.Message)" Red
    Say ''
    Read-Host '  Appuyez sur Entrée pour fermer'
}
