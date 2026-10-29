<#
    iPhone Bureau - installation
    Compile le widget en iPhoneBureau.exe sur ce PC (rien n'est téléchargé),
    crée les raccourcis Bureau + menu Démarrer, puis le lance.

    -Desinstaller : ferme le widget et retire tout.
#>
param([switch]$Desinstaller)

$ErrorActionPreference = 'Stop'
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

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text) { Write-Host "  [OK] $text" -ForegroundColor Green }

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

    if (-not (Test-Path $Src)) { throw "Fichier introuvable : $Src. Décompressez tout le dossier avant de lancer l'installation." }
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
    Stop-Widget

    # Le compilateur C# fait partie de Windows (.NET Framework 4.8).
    $csc = @(
        (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
        (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    Say '  Compilation du widget...'
    $common = @('/nologo', '/target:winexe', '/optimize+', '/codepage:65001',
                '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll')
    if ($csc) {
        # Premier passage pour dessiner l'icône, second pour l'intégrer à l'exe.
        $tmp = Join-Path $env:TEMP 'iPhoneBureau-icone.exe'
        & $csc @common "/out:$tmp" $Src | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'La compilation a échoué (voir les messages ci-dessus).' }
        Start-Process $tmp -ArgumentList '--icone', "`"$Ico`"" -Wait
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        $iconArg = if (Test-Path $Ico) { @("/win32icon:$Ico") } else { @() }
        & $csc @common @iconArg "/out:$Exe" $Src | Out-Host
        if ($LASTEXITCODE -ne 0) { throw 'La compilation a échoué (voir les messages ci-dessus).' }
    } else {
        if (Test-Path $Exe) { Remove-Item $Exe -Force }
        Add-Type -TypeDefinition (Get-Content $Src -Raw -Encoding UTF8) `
                 -ReferencedAssemblies System.Windows.Forms, System.Drawing `
                 -OutputAssembly $Exe -OutputType WindowsApplication
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

    Start-Process $Exe
    Say ''
    Ok 'iPhone Bureau est lancé, en bas à droite de l''écran.'
    Say ''
    Say '  - Glissez le contour du téléphone pour le déplacer.'
    Say '  - Clic droit sur le contour : taille, couleur, cadrage, réglages.'
    Say '  - Ctrl + Alt + I : afficher / masquer (et taper directement sur l''iPhone).'
    Say '  - Il reste à lancer la recopie de l''iPhone : voir LISEZMOI.txt.'
    Say ''
    Start-Sleep -Seconds 8
}
catch {
    Say ''
    Say "  [ERREUR] $($_.Exception.Message)" Red
    Say ''
    Read-Host '  Appuyez sur Entrée pour fermer'
}
