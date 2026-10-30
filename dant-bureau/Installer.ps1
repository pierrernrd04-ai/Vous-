<#
    Dan't Bureau - installation
    Pose les 3 widgets Dan't Procrastiner sur le bureau Windows, à côté de Lively
    et des widgets du tracker (rien n'est remplacé).
    Récupère WebView2 (bibliothèque de Microsoft, signée) sur nuget.org, compile
    DantBureau.exe sur ce PC, crée les raccourcis Bureau + menu Démarrer, puis le lance.

    Marche aussi seul (commande à coller dans Windows + R) : le code est récupéré sur GitHub.
    -Desinstaller : ferme les widgets et retire tout.
#>
param([switch]$Desinstaller)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # téléchargements bien plus rapides sous PowerShell 5.1
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Host.UI.RawUI.WindowTitle = "Dan't Bureau"

$Dir      = Join-Path $env:LOCALAPPDATA 'DantBureau'
$Exe      = Join-Path $Dir 'DantBureau.exe'
$Src      = Join-Path $PSScriptRoot 'DantBureau.cs'
$Links    = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop'))  "Dan't Bureau.lnk"),
    (Join-Path ([Environment]::GetFolderPath('Programs')) "Dan't Bureau.lnk")
)
$RunKey   = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$RepoRaw  = 'https://raw.githubusercontent.com/pierrernrd04-ai/Vous-/HEAD/dant-bureau'
$WebView2 = 'https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2210.55'

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text) { Write-Host "  [OK] $text" -ForegroundColor Green }

function Stop-Widgets {
    if (-not (Get-Process DantBureau -ErrorAction SilentlyContinue)) { return }
    if (Test-Path $Exe) { Start-Process $Exe -ArgumentList '--quitter' -Wait }
    for ($i = 0; $i -lt 30 -and (Get-Process DantBureau -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 100 }
    Get-Process DantBureau -ErrorAction SilentlyContinue | Stop-Process -Force
    Ok 'Anciens widgets fermés'
}

# WebView2 : le moteur d'Edge dans une fenêtre. Les DLL viennent du paquet officiel de Microsoft.
function Get-WebView2 {
    $core = Join-Path $Dir 'Microsoft.Web.WebView2.Core.dll'
    if ((Test-Path $core) -and (Test-Path (Join-Path $Dir 'WebView2Loader.dll'))) { Ok 'WebView2 déjà présent'; return }
    Say '  Téléchargement de WebView2 (Microsoft, nuget.org)...'
    $zip = Join-Path $env:TEMP 'dant-webview2.zip'
    $tmp = Join-Path $env:TEMP 'dant-webview2'
    Invoke-WebRequest $WebView2 -OutFile $zip -UseBasicParsing
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Expand-Archive $zip -DestinationPath $tmp -Force
    $arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    $rt = switch ($arch) { 'AMD64' { 'win-x64' } 'ARM64' { 'win-arm64' } default { 'win-x86' } }
    $files = @(
        (Join-Path $tmp 'lib\net45\Microsoft.Web.WebView2.Core.dll'),
        (Join-Path $tmp 'lib\net45\Microsoft.Web.WebView2.WinForms.dll'),
        (Join-Path $tmp "runtimes\$rt\native\WebView2Loader.dll")
    )
    foreach ($f in $files) {
        $sig = Get-AuthenticodeSignature $f
        if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Microsoft') {
            throw "La DLL $(Split-Path $f -Leaf) n'est pas signée par Microsoft : installation arrêtée."
        }
        Copy-Item $f $Dir -Force
    }
    Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Ok "WebView2 récupéré et vérifié (signé Microsoft, $rt)"
}

function Build-Widgets($code, $out) {
    $provider = New-Object Microsoft.CSharp.CSharpCodeProvider
    $params = New-Object System.CodeDom.Compiler.CompilerParameters
    $params.GenerateExecutable = $true
    $params.GenerateInMemory = $false
    $params.OutputAssembly = $out
    $params.CompilerOptions = '/target:winexe /optimize+'
    foreach ($r in 'System.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll') { [void]$params.ReferencedAssemblies.Add($r) }
    [void]$params.ReferencedAssemblies.Add((Join-Path $Dir 'Microsoft.Web.WebView2.Core.dll'))
    [void]$params.ReferencedAssemblies.Add((Join-Path $Dir 'Microsoft.Web.WebView2.WinForms.dll'))
    if (Test-Path $out) { Remove-Item $out -Force }
    $result = $provider.CompileAssemblyFromSource($params, $code)
    $errors = @($result.Errors | Where-Object { -not $_.IsWarning })
    if ($errors.Count -gt 0) {
        $errors | Select-Object -First 5 | ForEach-Object { Say "  $_" DarkYellow }
        throw 'La compilation sur ce PC a échoué.'
    }
}

Say ''
Say "  Dan't Bureau - tes 3 widgets Dan't Procrastiner sur le bureau" Magenta
Say '  -------------------------------------------------------------' Magenta
Say ''

try {
    if ($Desinstaller) {
        Stop-Widgets
        foreach ($l in $Links) { Remove-Item $l -Force -ErrorAction SilentlyContinue }
        Remove-ItemProperty -Path $RunKey -Name 'DantBureau' -ErrorAction SilentlyContinue
        Remove-Item $Dir -Recurse -Force -ErrorAction SilentlyContinue
        Ok "Dan't Bureau est désinstallé (raccourcis, démarrage automatique et réglages retirés)."
        Start-Sleep -Seconds 4
        exit
    }

    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    Stop-Widgets
    Get-WebView2
    if (-not (Test-Path $Src)) {
        $Src = Join-Path $Dir 'DantBureau.cs'
        Say '  Téléchargement du code des widgets...'
        Invoke-WebRequest "$RepoRaw/DantBureau.cs" -OutFile $Src -UseBasicParsing
        Ok 'Code récupéré'
    }

    # Compilation par l'API .NET de Windows (aucun outil à installer)
    Say '  Compilation...'
    $built = $false
    try {
        Build-Widgets (Get-Content $Src -Raw -Encoding UTF8) $Exe
        $built = Test-Path $Exe
    } catch {
        Say "  [!!] $($_.Exception.Message)" Yellow
    }
    if (-not $built) {
        # Plan B : la version déjà compilée publiée avec le code.
        Say '  Récupération de la version déjà compilée...'
        $local = Join-Path $PSScriptRoot 'DantBureau.exe'
        if (Test-Path $local) { Copy-Item $local $Exe -Force }
        else { Invoke-WebRequest "$RepoRaw/DantBureau.exe" -OutFile $Exe -UseBasicParsing }
        Unblock-File $Exe -ErrorAction SilentlyContinue
    }
    Ok "Programme prêt : $Exe"

    $shell = New-Object -ComObject WScript.Shell
    foreach ($l in $Links) {
        $s = $shell.CreateShortcut($l)
        $s.TargetPath = $Exe
        $s.WorkingDirectory = $Dir
        $s.Description = "Mes rappels Dan't Procrastiner sur le bureau"
        $s.Save()
    }
    Ok "Raccourcis « Dan't Bureau » créés (Bureau + menu Démarrer)"

    $answer = Read-Host "  Lancer Dan't Bureau à chaque démarrage de Windows ? (O/n)"
    if ($answer -notmatch '^[nN]') {
        New-Item -Path $RunKey -Force | Out-Null
        Set-ItemProperty -Path $RunKey -Name 'DantBureau' -Value "`"$Exe`""
        Ok 'Démarrage automatique activé (modifiable par clic droit sur les widgets)'
    }

    Start-Process $Exe
    Say ''
    Ok "Dan't Bureau est lancé, en haut à droite de l'écran."
    Say ''
    Say "  - Au premier lancement, tape le code affiché sur l'iPhone (Dan't > Réglages > Widgets sur le PC)."
    Say '  - Glisse un widget par son titre pour déplacer les trois.'
    Say '  - Clic droit sur un widget (ou sur l''icône près de l''horloge) : taille, thème, place, code, quitter.'
    Say ''
    Start-Sleep -Seconds 8
}
catch {
    Say ''
    Say "  [ERREUR] $($_.Exception.Message)" Red
    Say ''
    Read-Host '  Appuyez sur Entrée pour fermer'
}
