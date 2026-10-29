//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func bouclierPlan(req RunRequest) toolPlan {
	steps := []step{
		{"Antivirus Microsoft Defender", defenderHarden},
	}
	if opt(req, "scanRapide", true) {
		steps = append(steps, step{"Analyse antivirus rapide", quickScan})
	}
	if opt(req, "dossiersProteges", false) {
		steps = append(steps, step{"Protection anti-rançongiciel", controlledFolders})
	}
	steps = append(steps, step{"Protections de Windows", windowsHarden}, step{"Bilan de sécurité", audit})
	return toolPlan{"BouclierPC", steps}
}

const defenderPolicy = `SOFTWARE\Policies\Microsoft\Windows Defender`

func mpCmdRun() string {
	return filepath.Join(os.Getenv("ProgramFiles"), `Windows Defender\MpCmdRun.exe`)
}

func defenderHarden(j *Job) {
	failed := regApply([]regItem{
		{"HKLM", defenderPolicy, "PUAProtection", 1},
		{"HKLM", defenderPolicy + `\Spynet`, "SpynetReporting", 2},
		{"HKLM", defenderPolicy + `\Spynet`, "SubmitSamplesConsent", 1},
		{"HKLM", defenderPolicy + `\Windows Defender Exploit Guard\Network Protection`, "EnableNetworkProtection", 1},
		{"HKLM", defenderPolicy + `\Real-Time Protection`, "DisableRealtimeMonitoring", 0},
		{"HKLM", defenderPolicy + `\Real-Time Protection`, "DisableBehaviorMonitoring", 0},
	}, true)
	if failed > 0 {
		j.Skip("%d réglage(s) Defender refusé(s) (un autre antivirus est peut-être installé)", failed)
	}
	j.Ok("Blocage des logiciels indésirables (fausses barres d'outils, faux nettoyeurs…) activé")
	j.Ok("Protection réseau : les sites piégés sont bloqués dans tous les navigateurs")
	j.Ok("Protection cloud et surveillance du comportement actives")
	j.Info("Sécurité Windows affichera « géré par votre organisation » : c'est normal, ce sont ces réglages.")

	if _, code := runHidden(mpCmdRun(), "-SignatureUpdate"); code == 0 {
		j.Ok("Définitions de virus mises à jour")
	} else {
		j.Skip("Mise à jour des définitions impossible (pas d'Internet ?)")
	}
}

func quickScan(j *Job) {
	j.Info("Compter 5 à 15 minutes. Vous pouvez continuer à utiliser le PC.")
	reportScan(j, "1")
}

func fullScan(j *Job) {
	runHidden(mpCmdRun(), "-SignatureUpdate")
	j.Info("Compter 30 minutes à 2 heures. Laissez le PC branché.")
	reportScan(j, "2")
}

func reportScan(j *Job, scanType string) {
	out, code := runHidden(mpCmdRun(), "-Scan", "-ScanType", scanType)
	switch {
	case code == 0:
		j.Ok("Aucune menace trouvée")
	case code == 2:
		j.Bad("Menace(s) trouvée(s) et neutralisée(s) par Defender. Détails : Sécurité Windows > Historique de protection.")
	default:
		j.Skip("Analyse non terminée (code %d) %s", code, firstLine(out))
	}
}

func controlledFolders(j *Job) {
	regSet("HKLM", defenderPolicy+`\Windows Defender Exploit Guard\Controlled Folder Access`, "EnableControlledFolderAccess", uint32(1), true)
	j.Ok("Dossiers protégés activés : Documents, Images et Bureau à l'abri des rançongiciels")
	j.Info("Si une appli de confiance est bloquée : Sécurité Windows > Protection contre les rançongiciels > Autoriser une application.")
}

func windowsHarden(j *Job) {
	if _, code := runHidden(system32("netsh.exe"), "advfirewall", "set", "allprofiles", "state", "on"); code == 0 {
		j.Ok("Pare-feu actif sur tous les réseaux")
	}

	uac := `SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`
	exp := `SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer`
	regApply([]regItem{
		{"HKLM", uac, "EnableLUA", 1},
		{"HKLM", uac, "ConsentPromptBehaviorAdmin", 5},
		{"HKLM", uac, "PromptOnSecureDesktop", 1},
		{"HKLM", `SOFTWARE\Policies\Microsoft\Windows\System`, "EnableSmartScreen", 1},
		{"HKLM", `SOFTWARE\Policies\Microsoft\Windows\System`, "ShellSmartScreenLevel", "Warn"},
		{"HKLM", `SOFTWARE\Policies\Microsoft\Edge`, "SmartScreenEnabled", 1},
		{"HKLM", exp, "NoDriveTypeAutoRun", 255},
		{"HKLM", exp, "NoAutorun", 1},
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`, "HideFileExt", 0},
		{"HKLM", `SYSTEM\CurrentControlSet\Control\Remote Assistance`, "fAllowToGetHelp", 0},
	}, true)
	j.Ok("Contrôle de compte (fenêtre « Oui / Non ») au niveau recommandé")
	j.Ok("SmartScreen prévient avant d'ouvrir un fichier ou un site dangereux")
	j.Ok("Clés USB : plus d'exécution automatique")
	j.Ok("Extensions visibles : un faux « facture.pdf.exe » se repère")
	j.Ok("Assistance à distance fermée (arnaques au faux support)")

	if smb1Enabled() {
		runHidden(system32("dism.exe"), "/Online", "/Disable-Feature", "/FeatureName:SMB1Protocol", "/NoRestart")
		j.Ok("Ancien partage réseau SMBv1 désactivé (faille WannaCry)")
		j.NeedReboot()
	} else {
		j.Ok("Ancien partage réseau SMBv1 déjà désactivé")
	}
}

func smb1Enabled() bool {
	rows, err := wmiQuery(`root\cimv2`, "SELECT InstallState FROM Win32_OptionalFeature WHERE Name='SMB1Protocol'", "InstallState")
	return err == nil && len(rows) > 0 && asInt(rows[0]["InstallState"]) == 1
}

// --- Bilan -----------------------------------------------------------------

func audit(j *Job) {
	score, total := 0, 0
	check := func(good bool, okText, badText string) {
		total++
		if good {
			score++
			j.Ok("%s", okText)
		} else {
			j.Bad("%s", badText)
		}
	}

	if rows, err := wmiQuery(`root\Microsoft\Windows\Defender`,
		"SELECT AMServiceEnabled, RealTimeProtectionEnabled, AntivirusSignatureLastUpdated FROM MSFT_MpComputerStatus",
		"AMServiceEnabled", "RealTimeProtectionEnabled", "AntivirusSignatureLastUpdated"); err == nil && len(rows) > 0 {
		r := rows[0]
		check(asBool(r["AMServiceEnabled"]) && asBool(r["RealTimeProtectionEnabled"]),
			"Antivirus Defender actif en temps réel", "Antivirus Defender : protection en temps réel coupée")
		if t, ok := wmiTime(r["AntivirusSignatureLastUpdated"]); ok {
			days := int(time.Since(t).Hours() / 24)
			check(days <= 3, fmt.Sprintf("Définitions de virus à jour (il y a %d j)", days),
				fmt.Sprintf("Définitions de virus vieilles de %d jours : lancez MajPC", days))
		}
	} else {
		j.Skip("Defender ne répond pas : un autre antivirus est peut-être installé")
	}
	if rows, err := wmiQuery(`root\Microsoft\Windows\Defender`, "SELECT PUAProtection, EnableNetworkProtection FROM MSFT_MpPreference",
		"PUAProtection", "EnableNetworkProtection"); err == nil && len(rows) > 0 {
		check(asInt(rows[0]["PUAProtection"]) == 1, "Logiciels indésirables bloqués", "Logiciels indésirables non bloqués")
		check(asInt(rows[0]["EnableNetworkProtection"]) == 1, "Sites piégés bloqués", "Protection réseau coupée")
	}

	fwOn := true
	for _, p := range []string{"DomainProfile", "StandardProfile", "PublicProfile"} {
		if v, ok := regDword("HKLM", `SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\`+p, "EnableFirewall"); ok && v == 0 {
			fwOn = false
		}
	}
	check(fwOn, "Pare-feu actif", "Pare-feu coupé sur au moins un type de réseau")

	lua, ok := regDword("HKLM", `SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System`, "EnableLUA")
	check(!ok || lua != 0, "Contrôle de compte (UAC) actif", "Contrôle de compte (UAC) désactivé")

	if v, ok := regDword("HKLM", `SYSTEM\CurrentControlSet\Control\SecureBoot\State`, "UEFISecureBootEnabled"); ok {
		check(v == 1, "Démarrage sécurisé (Secure Boot) actif", "Secure Boot coupé : à activer dans le BIOS")
	}

	if rows, err := wmiQuery(`root\cimv2\Security\MicrosoftTpm`, "SELECT IsEnabled_InitialValue FROM Win32_Tpm", "IsEnabled_InitialValue"); err == nil {
		check(len(rows) > 0 && asBool(rows[0]["IsEnabled_InitialValue"]), "Puce de sécurité TPM active", "Puce TPM absente ou coupée")
	}

	if rows, err := wmiQuery(`root\cimv2\Security\MicrosoftVolumeEncryption`,
		"SELECT ProtectionStatus FROM Win32_EncryptableVolume WHERE DriveLetter='"+sysDrive()+"'", "ProtectionStatus"); err == nil && len(rows) > 0 {
		check(asInt(rows[0]["ProtectionStatus"]) == 1, "Disque chiffré : vos fichiers sont illisibles en cas de vol",
			"Disque non chiffré : Paramètres > Confidentialité et sécurité > Chiffrement de l'appareil")
	}

	check(!smb1Enabled(), "Ancien protocole SMBv1 désactivé", "SMBv1 actif (faille connue)")

	ext, ok := regDword("HKCU", `Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`, "HideFileExt")
	check(ok && ext == 0, "Extensions de fichiers visibles", "Extensions cachées : un « facture.pdf.exe » passe inaperçu")

	ra, ok := regDword("HKLM", `SYSTEM\CurrentControlSet\Control\Remote Assistance`, "fAllowToGetHelp")
	check(ok && ra == 0, "Assistance à distance fermée", "Assistance à distance ouverte (arnaques au faux support)")

	if last, ok := lastUpdate(); ok {
		days := int(time.Since(last).Hours() / 24)
		check(days <= 45, fmt.Sprintf("Dernière mise à jour Windows il y a %d j", days),
			fmt.Sprintf("Aucune mise à jour Windows depuis %d jours : lancez MajPC", days))
	}

	kind := "ok"
	if score < total {
		kind = "bad"
	}
	j.add(kind, "Score de sécurité : %d / %d", score, total)
}

// Les dates WMI ressemblent à « 20261028143000.000000+060 ».
func wmiTime(v any) (time.Time, bool) {
	s := asString(v)
	if len(s) < 14 {
		return time.Time{}, false
	}
	t, err := time.ParseInLocation("20060102150405", s[:14], time.Local)
	return t, err == nil
}

func lastUpdate() (time.Time, bool) {
	rows, err := wmiQuery(`root\cimv2`, "SELECT InstalledOn FROM Win32_QuickFixEngineering", "InstalledOn")
	if err != nil {
		return time.Time{}, false
	}
	var best time.Time
	for _, r := range rows {
		s := strings.TrimSpace(asString(r["InstalledOn"]))
		for _, layout := range []string{"1/2/2006", "01/02/2006", "2006-01-02", "02/01/2006"} {
			if t, err := time.Parse(layout, s); err == nil {
				if t.After(best) && t.Before(time.Now().Add(48*time.Hour)) {
					best = t
				}
				break
			}
		}
	}
	return best, !best.IsZero()
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexAny(s, "\r\n"); i >= 0 {
		s = s[:i]
	}
	return s
}
