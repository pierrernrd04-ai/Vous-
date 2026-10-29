<#
    iPhone Bureau - installation
    Compile le widget en iPhoneBureau.exe sur ce PC, propose d'installer
    MirrorTo (recopie + pilotage de l'iPhone), crée les raccourcis Bureau +
    menu Démarrer, puis lance le tout.

    Marche aussi seul : s'il n'est pas à côté du script, le code du widget
    est récupéré sur GitHub (commande à coller dans Windows + R).

    -Desinstaller : ferme le widget et retire tout.
#>
param([switch]$Desinstaller)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # téléchargements bien plus rapides sous PowerShell 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Host.UI.RawUI.WindowTitle = 'iPhone Bureau'

$Dir      = Join-Path $env:LOCALAPPDATA 'iPhoneBureau'
$Exe      = Join-Path $Dir 'iPhoneBureau.exe'
$Ico      = Join-Path $Dir 'iPhoneBureau.ico'
$Src      = Join-Path $PSScriptRoot 'iPhoneBureau.cs'
$Links    = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop'))  'iPhone Bureau.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'iPhone Bureau.lnk')
)
$RunKey   = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RepoRaw  = 'https://raw.githubusercontent.com/pierrernrd04-ai/Vous-/HEAD/iphone-bureau'
$MirrorToUrl = 'https://download.imyfone.com/mirrorto_setup.exe'

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text) { Write-Host "  [OK] $text" -ForegroundColor Green }

function Test-MirrorTo {
    $keys = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
            'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
            'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    [bool](Get-ItemProperty $keys -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*MirrorTo*' })
}

# MirrorTo (iMyFone) affiche l'iPhone sur le PC et le pilote par Bluetooth.
function Install-MirrorTo {
    if (Test-MirrorTo) { Ok 'MirrorTo est déjà installé'; return }
    $answer = Read-Host '  Installer MirrorTo maintenant, pour voir ET piloter l''iPhone ? (O/n)'
    if ($answer -match '^[nN]') { return }
    $setup = Join-Path $env:TEMP 'mirrorto_setup.exe'
    Say '  Téléchargement de MirrorTo depuis le site officiel d''iMyFone...'
    Invoke-WebRequest $MirrorToUrl -OutFile $setup -UseBasicParsing
    $sig = Get-AuthenticodeSignature $setup
    if ($sig.Status -ne 'Valid') {
        Say '  [!!] Le fichier téléchargé n''a pas de signature valide : il n''est pas lancé.' Yellow
        Say '       Installez MirrorTo à la main depuis imyfone.com, le widget le trouvera.' Yellow
        Remove-Item $setup -Force -ErrorAction SilentlyContinue
        return
    }
    Ok "Installeur signé par : $($sig.SignerCertificate.GetNameInfo('SimpleName', $false))"
    Say '  L''installation de MirrorTo s''ouvre : cliquez sur Installer, puis revenez ici.' Yellow
    Start-Process $setup -Wait
    if (Test-MirrorTo) { Ok 'MirrorTo installé' }
    else { Say '  [--] MirrorTo n''est pas encore détecté (son installation continue peut-être).' DarkYellow }
}

function Build-Widget($code, $out, $icon) {
    $provider = New-Object Microsoft.CSharp.CSharpCodeProvider
    $params = New-Object System.CodeDom.Compiler.CompilerParameters
    $params.GenerateExecutable = $true
    $params.GenerateInMemory = $false
    $params.OutputAssembly = $out
    $params.CompilerOptions = '/target:winexe /optimize+'
    if ($icon) { $params.CompilerOptions += ' /win32icon:"' + $icon + '"' }
    [void]$params.ReferencedAssemblies.Add('System.dll')
    [void]$params.ReferencedAssemblies.Add('System.Drawing.dll')
    [void]$params.ReferencedAssemblies.Add('System.Windows.Forms.dll')
    [void]$params.ReferencedAssemblies.Add('System.IO.Compression.dll')
    [void]$params.ReferencedAssemblies.Add('System.IO.Compression.FileSystem.dll')
    if (Test-Path $out) { Remove-Item $out -Force }
    $result = $provider.CompileAssemblyFromSource($params, $code)
    $errors = @($result.Errors | Where-Object { -not $_.IsWarning })
    if ($errors.Count -gt 0) {
        $errors | Select-Object -First 5 | ForEach-Object { Say "  $_" DarkYellow }
        throw 'La compilation sur ce PC a échoué.'
    }
}

# Ferme proprement un widget déjà lancé : il rend sa forme d'origine à la fenêtre de recopie.
function Stop-Widget {
    if (-not (Get-Process iPhoneBureau -ErrorAction SilentlyContinue)) { return }
    if (Test-Path $Exe) { Start-Process $Exe -ArgumentList '--quitter' -Wait }
    for ($i = 0; $i -lt 30 -and (Get-Process iPhoneBureau -ErrorAction SilentlyContinue); $i++) {
        Start-Sleep -Milliseconds 100
    }
    Get-Process iPhoneBureau -ErrorAction SilentlyContinue | Stop-Process -Force
    Ok 'Widget fermé'
}

Say ''
Say '  iPhone Bureau - l''écran de votre iPhone 13 mini sur le bureau' Cyan
Say '  -------------------------------------------------------------' Cyan
Say ''

try {
    if ($Desinstaller) {
        Stop-Widget
        foreach ($l in $Links) { Remove-Item $l -Force -ErrorAction SilentlyContinue }
        Remove-ItemProperty -Path $RunKey -Name 'iPhoneBureau' -ErrorAction SilentlyContinue
        Remove-Item $Dir -Recurse -Force -ErrorAction SilentlyContinue
        Ok 'iPhone Bureau est désinstallé (raccourcis, démarrage automatique et réglages retirés).'
        Start-Sleep -Seconds 4
        exit
    }

    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    Stop-Widget
    if (-not (Test-Path $Src)) {
        $Src = Join-Path $Dir 'iPhoneBureau.cs'
        Say '  Téléchargement du widget...'
        Invoke-WebRequest "$RepoRaw/iPhoneBureau.cs" -OutFile $Src -UseBasicParsing
        Ok 'Code du widget récupéré'
    }

    # Compilation par l'API .NET de Windows (pas de ligne de commande à construire,
    # donc aucun souci avec les espaces ou les accents dans le nom du dossier).
    Say '  Compilation du widget...'
    $code = Get-Content $Src -Raw -Encoding UTF8
    $built = $false
    try {
        Build-Widget $code $Exe ''
        Start-Process $Exe -ArgumentList '--icone', "`"$Ico`"" -Wait
        if (Test-Path $Ico) {
            # Second passage pour intégrer l'icône à l'exe ; sans elle, le premier suffit.
            try {
                Build-Widget $code "$Exe.new" $Ico
                Move-Item "$Exe.new" $Exe -Force
            } catch { Remove-Item "$Exe.new" -Force -ErrorAction SilentlyContinue }
        }
        $built = Test-Path $Exe
    } catch {
        Say "  [!!] $($_.Exception.Message)" Yellow
    }
    if (-not $built) {
        # Plan B : la version déjà compilée publiée avec le code.
        Say '  Récupération de la version déjà compilée...'
        $local = Join-Path $PSScriptRoot 'iPhoneBureau.exe'
        if (Test-Path $local) { Copy-Item $local $Exe -Force }
        else { Invoke-WebRequest "$RepoRaw/iPhoneBureau.exe" -OutFile $Exe -UseBasicParsing }
        Unblock-File $Exe -ErrorAction SilentlyContinue
        Start-Process $Exe -ArgumentList '--icone', "`"$Ico`"" -Wait
    }
    Ok "Widget compilé : $Exe"

    $shell = New-Object -ComObject WScript.Shell
    foreach ($l in $Links) {
        $s = $shell.CreateShortcut($l)
        $s.TargetPath = $Exe
        $s.WorkingDirectory = $Dir
        $s.Description = 'L''écran de mon iPhone sur le bureau'
        if (Test-Path $Ico) { $s.IconLocation = "$Ico,0" }
        $s.Save()
    }
    Ok 'Raccourcis « iPhone Bureau » créés (Bureau + menu Démarrer)'

    $answer = Read-Host '  Lancer iPhone Bureau à chaque démarrage de Windows ? (O/n)'
    if ($answer -notmatch '^[nN]') {
        New-Item -Path $RunKey -Force | Out-Null
        Set-ItemProperty -Path $RunKey -Name 'iPhoneBureau' -Value "`"$Exe`""
        Ok 'Démarrage automatique activé (modifiable par clic droit sur le widget)'
    }

    Install-MirrorTo

    Start-Process $Exe
    Say ''
    Ok 'iPhone Bureau est lancé, en bas à droite de l''écran (MirrorTo s''ouvre avec lui).'
    Say ''
    Say '  - Glissez le contour du téléphone pour le déplacer.'
    Say '  - Clic droit sur le contour : taille, couleur, cadrage, réglages.'
    Say '  - Ctrl + Alt + I : afficher / masquer (et taper directement sur l''iPhone).'
    Say '  - Dans MirrorTo : iOS > USB, touchez « Se fier » sur l''iPhone, puis associez-le en Bluetooth.'
    Say ''
    Start-Sleep -Seconds 8
}
catch {
    Say ''
    Say "  [ERREUR] $($_.Exception.Message)" Red
    Say ''
    Read-Host '  Appuyez sur Entrée pour fermer'
}
