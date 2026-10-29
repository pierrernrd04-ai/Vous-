<#
    AllegePC - supprime les applications préinstallées inutiles

    Chaque appli retirée libère de la place, de la mémoire et des mises à
    jour en arrière-plan. Toutes se réinstallent depuis le Microsoft Store.
#>
param([switch]$Auto)   # -Auto : tout appliquer sans poser de question

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'AllegePC'

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
function Skip($text) { Write-Host "  [--] $text" -ForegroundColor DarkYellow }

function Ask($question, $default = $true) {
    if ($Auto) { return $default }
    do { $r = (Read-Host "$question (O/N)").Trim().ToUpper() } while ($r -notin 'O', 'N')
    return $r -eq 'O'
}

function Invoke-Step([scriptblock]$step) {
    try { & $step } catch { Skip "Étape interrompue : $($_.Exception.Message)" }
}

# Nom du paquet => nom affiché. Rien d'indispensable : ni le Store, ni la
# Calculatrice, ni Photos, ni le Lecteur multimédia, ni les pilotes.
$Bloat = [ordered]@{
    'Microsoft.BingNews'                     = 'Actualités'
    'Microsoft.BingWeather'                  = 'Météo'
    'Microsoft.BingSearch'                   = 'Recherche Bing'
    'Microsoft.GetHelp'                      = 'Obtenir de l''aide'
    'Microsoft.Getstarted'                   = 'Astuces'
    'Microsoft.MicrosoftSolitaireCollection' = 'Solitaire'
    'Microsoft.People'                       = 'Contacts'
    'Microsoft.WindowsFeedbackHub'           = 'Hub de commentaires'
    'Microsoft.ZuneVideo'                    = 'Films et TV'
    'Microsoft.WindowsMaps'                  = 'Cartes'
    'Microsoft.MicrosoftOfficeHub'           = 'Microsoft 365 (raccourci pub)'
    'Microsoft.549981C3F5F10'                = 'Cortana'
    'Microsoft.PowerAutomateDesktop'         = 'Power Automate'
    'Microsoft.Todos'                        = 'To Do'
    'Microsoft.MixedReality.Portal'          = 'Réalité mixte'
    'Microsoft.SkypeApp'                     = 'Skype'
    'Microsoft.XboxApp'                      = 'Xbox (ancienne appli)'
    'Microsoft.GamingApp'                    = 'Xbox'
    'Microsoft.XboxGamingOverlay'            = 'Xbox Game Bar'
    'Microsoft.Windows.DevHome'              = 'Dev Home'
    'Microsoft.Copilot'                      = 'Copilot'
    'Clipchamp.Clipchamp'                    = 'Clipchamp'
    'MicrosoftTeams'                         = 'Teams (perso)'
    'MSTeams'                                = 'Teams (perso)'
    'MicrosoftCorporationII.QuickAssist'     = 'Assistance rapide (outil des arnaqueurs)'
    '*SpotifyAB.SpotifyMusic*'               = 'Spotify'
    '*Disney*'                               = 'Disney+'
    '*TikTok*'                               = 'TikTok'
    '*Instagram*'                            = 'Instagram'
    '*Facebook*'                             = 'Facebook'
    '*CandyCrush*'                           = 'Candy Crush'
    '*LinkedIn*'                             = 'LinkedIn'
    '*AmazonVideo.PrimeVideo*'               = 'Prime Video'
    '*McAfee*'                               = 'McAfee (essai)'
    '*Norton*'                               = 'Norton (essai)'
}

function Step-Apps {
    Say "`n> Applications préinstallées" Cyan
    $found = @()
    foreach ($pattern in $Bloat.Keys) {
        $pkgs = Get-AppxPackage -AllUsers -Name $pattern -ErrorAction SilentlyContinue
        if ($pkgs) { $found += [pscustomobject]@{ Pattern = $pattern; Label = $Bloat[$pattern] } }
    }
    if (-not $found) { Ok 'Rien à supprimer, le PC est déjà propre'; return }

    for ($i = 0; $i -lt $found.Count; $i++) { Say ("  {0,2}. {1}" -f ($i + 1), $found[$i].Label) White }
    $keep = @()
    if (-not $Auto) {
        Say "`n  Entrée = tout supprimer. Pour en GARDER, tapez leurs numéros (ex : 2,5)."
        $answer = Read-Host '  Numéros à garder'
        $keep = $answer -split '[,; ]+' | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ - 1 }
    }

    for ($i = 0; $i -lt $found.Count; $i++) {
        if ($keep -contains $i) { Skip "$($found[$i].Label) gardé"; continue }
        $p = $found[$i].Pattern
        try {
            Get-AppxPackage -AllUsers -Name $p | Remove-AppxPackage -AllUsers -ErrorAction Stop
            # Empêche Windows de la réinstaller pour un nouveau compte.
            Get-AppxProvisionedPackage -Online | Where-Object DisplayName -like $p |
                Remove-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Out-Null
            Ok "$($found[$i].Label) supprimé"
        } catch { Skip "$($found[$i].Label) : $($_.Exception.Message)" }
    }
}

function Step-StartMenu {
    Say "`n> Menu Démarrer et recherche" Cyan
    $search = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Search'
    if (-not (Test-Path $search)) { New-Item $search -Force | Out-Null }
    Set-ItemProperty $search BingSearchEnabled 0 -Type DWord
    $pol = 'HKCU:\Software\Policies\Microsoft\Windows\Explorer'
    if (-not (Test-Path $pol)) { New-Item $pol -Force | Out-Null }
    Set-ItemProperty $pol DisableSearchBoxSuggestions 1 -Type DWord
    Ok 'Recherche Bing retirée du menu Démarrer (il s''ouvre plus vite)'

    $adv = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
    Set-ItemProperty $adv Start_IrisRecommendations 0 -Type DWord
    Set-ItemProperty $adv ShowCopilotButton 0 -Type DWord
    Ok 'Recommandations et bouton Copilot retirés'
}

function Step-OneDrive {
    Say "`n> OneDrive" Cyan
    Say '  OneDrive synchronise vos fichiers en continu et occupe la mémoire.'
    Say '  Si vous ne l''utilisez pas, on l''empêche de démarrer (rien n''est supprimé).'
    if (Ask '  Empêcher OneDrive de démarrer avec Windows ?' $false) {
        Remove-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name OneDrive -ErrorAction SilentlyContinue
        Stop-Process -Name OneDrive -Force -ErrorAction SilentlyContinue
        Ok 'OneDrive ne démarre plus tout seul (relançable depuis le menu Démarrer)'
    } else { Skip 'OneDrive conservé' }
}

function Step-Space {
    Say "`n> Place sur le disque" Cyan
    $drive = $env:SystemDrive.TrimEnd(':')
    $before = (Get-PSDrive $drive).Free
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    Ok 'Corbeille vidée'
    foreach ($dir in $env:TEMP, "$env:SystemRoot\Temp", "$env:SystemRoot\SoftwareDistribution\Download",
                     "$env:LOCALAPPDATA\Microsoft\Windows\INetCache", "$env:LOCALAPPDATA\CrashDumps",
                     "$env:ProgramData\Microsoft\Windows\WER\ReportArchive") {
        Get-ChildItem $dir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    # Fichier de mise en veille prolongée : plusieurs Go inutiles sur un petit SSD.
    if (Ask '  Supprimer le fichier de veille prolongée (libère environ 2 à 5 Go, mais le démarrage sera un peu plus long) ?' $false) {
        powercfg /hibernate off
        Ok 'Veille prolongée désactivée (la veille normale reste disponible)'
    }
    $freed = ((Get-PSDrive $drive).Free - $before) / 1GB
    Ok ("{0:N1} Go libérés au total" -f [math]::Max($freed, 0))
}

function Invoke-Lighten {
    Invoke-Step { Step-Apps }
    Invoke-Step { Step-StartMenu }
    Invoke-Step { Step-OneDrive }
    Invoke-Step { Step-Space }
    Say "`nAllegePC terminé. Redémarrez le PC (ou l'Explorateur) pour voir le menu Démarrer allégé." Green
}

if ($Auto) { Invoke-Lighten; return }

while ($true) {
    Clear-Host
    Say '  ==============================================' Cyan
    Say '                A L L E G E   P C' White
    Say '      Moins d''applis inutiles, plus de place' Gray
    Say '  ==============================================' Cyan
    Say "`n  1. Tout alléger (recommandé)" White
    Say '  2. Supprimer des applis seulement' White
    Say '  3. Libérer de la place seulement' White
    Say '  4. Quitter' White
    switch (Read-Host "`n  Votre choix") {
        '1' { Invoke-Lighten }
        '2' { Invoke-Step { Step-Apps } }
        '3' { Invoke-Step { Step-Space } }
        '4' { exit }
    }
    Read-Host "`nEntrée pour revenir au menu" | Out-Null
}
