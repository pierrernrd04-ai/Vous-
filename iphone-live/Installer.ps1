<#
    iPhone Live - installation en une commande (sans droits administrateur)

    1. Ferme et retire l'ancien widget « iPhone Bureau » s'il est là.
    2. Installe iPhone Live (déjà compilé) et le récepteur ffmpeg (FFmpeg-Builds, GitHub).
    3. Propose le pilote Apple pour le câble USB (iTunes, site d'Apple, pas le Store).
    4. Autorise le récepteur dans le pare-feu (une demande « Oui » de Windows).
    5. Crée les raccourcis, le démarrage automatique, et lance le téléphone.
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Host.UI.RawUI.WindowTitle = 'iPhone Live'

$Dir    = Join-Path $env:LOCALAPPDATA 'iPhoneLive'
$Exe    = Join-Path $Dir 'iPhoneLive.exe'
$Ico    = Join-Path $Dir 'iPhoneLive.ico'
$Ff     = Join-Path $Dir 'ffmpeg.exe'
$Repo   = 'https://raw.githubusercontent.com/pierrernrd04-ai/Vous-/HEAD/iphone-live'
$FfZip  = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
$ITunes = 'https://www.apple.com/itunes/download/win64'
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$Desk   = [Environment]::GetFolderPath('Desktop')
$Progs  = [Environment]::GetFolderPath('Programs')

function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
function Ok($t)   { Write-Host "  [OK] $t" -ForegroundColor Green }
function Skip($t) { Write-Host "  [--] $t" -ForegroundColor DarkYellow }

function Stop-App($name, $exe) {
    if (-not (Get-Process $name -ErrorAction SilentlyContinue)) { return }
    if (Test-Path $exe) { Start-Process $exe -ArgumentList '--quitter' -Wait; Start-Sleep -Seconds 2 }
    Get-Process $name -ErrorAction SilentlyContinue | Stop-Process -Force
}

Say ''
Say '  iPhone Live - ton iPhone en direct sur le bureau' Cyan
Say '  -----------------------------------------------' Cyan
Say ''

try {
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null

    # 1. L'ancien widget laisse la place (il utilisait le même port de réception).
    $old = Join-Path $env:LOCALAPPDATA 'iPhoneBureau\iPhoneBureau.exe'
    Stop-App 'iPhoneBureau' $old
    Get-Process ffplay -ErrorAction SilentlyContinue | Stop-Process -Force
    Remove-ItemProperty -Path $RunKey -Name 'iPhoneBureau' -ErrorAction SilentlyContinue
    foreach ($l in @((Join-Path $Desk 'iPhone Bureau.lnk'), (Join-Path $Progs 'iPhone Bureau.lnk'))) { Remove-Item $l -Force -ErrorAction SilentlyContinue }
    if (Test-Path $old) { Ok 'Ancien widget « iPhone Bureau » fermé et retiré du démarrage' }

    # 2. iPhone Live.
    Stop-App 'iPhoneLive' $Exe
    Say '  Téléchargement d''iPhone Live...'
    Invoke-WebRequest "$Repo/iPhoneLive.exe" -OutFile "$Exe.new" -UseBasicParsing
    if ((Get-Item "$Exe.new").Length -lt 30000) { throw 'Téléchargement incomplet. Relancez la commande.' }
    Move-Item "$Exe.new" $Exe -Force
    Unblock-File $Exe -ErrorAction SilentlyContinue
    Start-Process $Exe -ArgumentList '--icone', "`"$Ico`"" -Wait
    Ok 'iPhone Live installé'

    if (-not (Test-Path $Ff)) {
        Say '  Téléchargement du récepteur FFmpeg (environ 200 Mo, une seule fois)...'
        Say '  Sur un partage de connexion, cela utilise ton forfait : un Wi-Fi est préférable pour cette étape.' DarkYellow
        $zip = Join-Path $Dir 'ffmpeg.zip'
        Invoke-WebRequest $FfZip -OutFile $zip -UseBasicParsing
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $za = [IO.Compression.ZipFile]::OpenRead($zip)
        try {
            $entry = $za.Entries | Where-Object { $_.Name -eq 'ffmpeg.exe' } | Select-Object -First 1
            if (-not $entry) { throw 'ffmpeg.exe introuvable dans le téléchargement.' }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $Ff, $true)
        } finally { $za.Dispose(); Remove-Item $zip -Force -ErrorAction SilentlyContinue }
        Ok 'Récepteur installé'
    } else { Ok 'Récepteur déjà installé' }

    # 3. Câble USB : Windows a besoin du pilote Apple, fourni avec iTunes.
    $amds = Get-Service -Name 'Apple Mobile Device Service' -ErrorAction SilentlyContinue
    if ($amds) { Ok 'Pilote Apple pour le câble USB déjà présent' }
    else {
        $a = Read-Host '  Utiliser aussi le câble USB ? Installe le pilote Apple via iTunes (200 Mo) (o/N)'
        if ($a -match '^[oOyY]') {
            $setup = Join-Path $env:TEMP 'iTunes64Setup.exe'
            Say '  Téléchargement d''iTunes depuis apple.com...'
            Invoke-WebRequest $ITunes -OutFile $setup -UseBasicParsing
            $sig = Get-AuthenticodeSignature $setup
            if ($sig.Status -eq 'Valid' -and $sig.SignerCertificate.Subject -match 'Apple') {
                Say '  Suivez l''installation d''iTunes, puis revenez ici.' Yellow
                Start-Process $setup -Wait
                Ok 'Pilote Apple installé'
            } else { Skip 'Signature Apple non vérifiée : installation annulée par sécurité.' }
            Remove-Item $setup -Force -ErrorAction SilentlyContinue
        } else { Skip 'Câble USB ignoré : le partage de connexion en Wi-Fi suffit' }
    }

    # 4. Pare-feu : le partage de connexion est un réseau « Public », il faut autoriser le récepteur.
    $rules = "/c netsh advfirewall firewall delete rule name=all program=`"$Ff`" & netsh advfirewall firewall add rule name=`"iPhone Live`" dir=in action=allow program=`"$Ff`" enable=yes profile=any"
    try {
        Start-Process cmd.exe -Verb RunAs -WindowStyle Hidden -ArgumentList $rules -Wait -ErrorAction Stop
        Ok 'Récepteur autorisé dans le pare-feu'
    } catch {
        Skip 'Pare-feu non réglé ici. Dans le téléphone, touchez « Autoriser dans le pare-feu ».'
    }

    # 5. Raccourcis, démarrage automatique, lancement.
    $shell = New-Object -ComObject WScript.Shell
    foreach ($l in @((Join-Path $Desk 'iPhone Live.lnk'), (Join-Path $Progs 'iPhone Live.lnk'))) {
        $s = $shell.CreateShortcut($l)
        $s.TargetPath = $Exe
        $s.WorkingDirectory = $Dir
        $s.Description = 'Mon iPhone en direct sur le bureau'
        if (Test-Path $Ico) { $s.IconLocation = "$Ico,0" }
        $s.Save()
    }
    New-Item -Path $RunKey -Force | Out-Null
    Set-ItemProperty -Path $RunKey -Name 'iPhoneLive' -Value "`"$Exe`""
    Ok 'Raccourci « iPhone Live » sur le Bureau, lancement automatique au démarrage'

    Start-Process $Exe
    Say ''
    Ok 'Le téléphone est sur ton bureau. Il affiche l''adresse à taper dans PRISM.'
    Say ''
    Start-Sleep -Seconds 6
}
catch {
    Say ''
    Say "  [ERREUR] $($_.Exception.Message)" Red
    Say ''
    Read-Host '  Appuyez sur Entrée pour fermer'
}
