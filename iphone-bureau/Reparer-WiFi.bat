@echo off
rem iPhone Bureau - reparer la recopie Wi-Fi de MirrorTo, sans PowerShell.
rem A lancer en administrateur : Windows + R, coller la commande, Ctrl + Maj + Entree.
chcp 65001 >nul
title iPhone Bureau - réparation Wi-Fi
setlocal

net session >nul 2>&1
if errorlevel 1 goto :noadmin

echo.
echo   Réparation de la recopie Wi-Fi (MirrorTo)
echo   ------------------------------------------
echo.
echo   Recherche de MirrorTo...
set "MT="
for %%D in ("%ProgramFiles(x86)%" "%ProgramFiles%" "%LOCALAPPDATA%\Programs" "%APPDATA%") do (
  for /d %%I in ("%%~D\iMyFone*" "%%~D\MirrorTo*") do (
    if not defined MT dir /s /b "%%~I\*MirrorTo*.exe" >nul 2>&1 && set "MT=%%~I"
  )
)
if defined MT goto :found
echo   Recherche plus large, patientez une minute...
for %%D in ("%ProgramFiles(x86)%" "%ProgramFiles%" "%LOCALAPPDATA%") do (
  for /f "delims=" %%F in ('dir /s /b "%%~D\*MirrorTo*.exe" 2^>nul') do if not defined MT set "MT=%%~dpF"
)
if not defined MT goto :notfound
if "%MT:~-1%"=="\" set "MT=%MT:~0,-1%"

:found
echo   [OK] MirrorTo trouvé : %MT%

rem Fermer MirrorTo, sans toucher aux autres programmes.
for /r "%MT%" %%F in (*.exe) do (
  echo %%~nF| findstr /i "mirror imyfone" >nul && taskkill /f /im "%%~nxF" >nul 2>&1
)
echo   [OK] MirrorTo fermé le temps de la réparation

rem Pare-feu : retirer les anciennes règles (dont les refus), puis tout autoriser.
set /a N=0
for /r "%MT%" %%F in (*.exe) do (
  netsh advfirewall firewall delete rule name=all program="%%~fF" >nul 2>&1
  netsh advfirewall firewall add rule name="iPhone Bureau - %%~nF" dir=in action=allow program="%%~fF" enable=yes profile=any >nul
  netsh advfirewall firewall add rule name="iPhone Bureau - %%~nF" dir=out action=allow program="%%~fF" enable=yes profile=any >nul
  set /a N+=1
)
netsh advfirewall firewall delete rule name="iPhone Bureau - AirPlay mDNS" >nul 2>&1
netsh advfirewall firewall add rule name="iPhone Bureau - AirPlay mDNS" dir=in action=allow protocol=UDP localport=5353 profile=any >nul
echo   [OK] Pare-feu : %N% programme(s) MirrorTo autorisé(s), blocages supprimés

rem Réseau en Privé (facultatif : les règles ci-dessus valent aussi en Public).
powershell -NoProfile -Command "Get-NetConnectionProfile | Where-Object NetworkCategory -eq 'Public' | Set-NetConnectionProfile -NetworkCategory Private" >nul 2>&1
if errorlevel 1 (echo   [--] Réseau laissé tel quel, ce n'est pas bloquant) else (echo   [OK] Réseau Wi-Fi en mode Privé)

sc query "Bonjour Service" >nul 2>&1
if not errorlevel 1 (
  sc config "Bonjour Service" start= auto >nul
  net start "Bonjour Service" >nul 2>&1
  echo   [OK] Service Bonjour démarré
)

rem Relancer MirrorTo sans droits administrateur, pour que le widget puisse le placer.
set "MAIN="
for /r "%MT%" %%F in (*MirrorTo*.exe) do (
  echo %%~nF| findstr /i "unins update crash" >nul || if not defined MAIN set "MAIN=%%~fF"
)
if defined MAIN (
  start "" explorer.exe "%MAIN%"
  echo   [OK] MirrorTo relancé
)

echo.
echo   Sur l'iPhone maintenant :
echo    1. Même Wi-Fi que le PC.
echo    2. Dans MirrorTo : onglet WiFi, puis « Cliquez ici pour actualiser ».
echo    3. Centre de contrôle, Recopie de l'écran, MirrorTo - le nom SANS « _1 ».
echo.
pause
exit /b 0

:noadmin
echo.
echo   Il faut les droits administrateur.
echo   Windows + R, recollez la commande, puis Ctrl + Maj + Entrée et Oui.
echo.
pause
exit /b 1

:notfound
echo.
echo   MirrorTo est introuvable sur ce PC. Installez-le d'abord.
echo.
pause
exit /b 1
