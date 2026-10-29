//go:build windows

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func reparePlan(req RunRequest) toolPlan {
	steps := []step{
		{"Diagnostic du PC", diagnostic},
		{"Réparation de l'image Windows (DISM)", dismRestore},
		{"Vérification des fichiers système (SFC)", sfcScan},
		{"Nettoyage des anciens composants", dismCleanup},
		{"Vérification du disque", chkdskScan},
	}
	if opt(req, "reseau", false) {
		steps = append(steps, step{"Réparation d'Internet", repairNetwork})
	}
	return toolPlan{"ReparePC", steps}
}

func diagnostic(j *Job) {
	if rows, err := wmiQuery(`root\Microsoft\Windows\Storage`, "SELECT FriendlyName, MediaType, HealthStatus, Size FROM MSFT_PhysicalDisk",
		"FriendlyName", "MediaType", "HealthStatus", "Size"); err == nil {
		for _, r := range rows {
			kind := map[int64]string{3: "disque dur", 4: "SSD"}[asInt(r["MediaType"])]
			name := fmt.Sprintf("%s (%s %d Go)", strings.TrimSpace(asString(r["FriendlyName"])), kind, asInt(r["Size"])/1e9)
			switch asInt(r["HealthStatus"]) {
			case 0:
				j.Ok("%s : en bonne santé", name)
			case 1:
				j.Bad("%s : signes d'usure, sauvegardez vos fichiers", name)
			default:
				j.Bad("%s : en mauvais état, sauvegardez vos fichiers tout de suite", name)
			}
		}
	}

	total, free := diskSpace()
	if total > 0 {
		pct := free * 100 / total
		if pct >= 15 {
			j.Ok("Espace libre : %d Go (%d %%)", free/gb, pct)
		} else {
			j.Bad("Espace libre : %d Go (%d %%). Sous 15 %%, Windows ralentit : lancez AllegePC.", free/gb, pct)
		}
	}

	memTotal, memFree := memory()
	j.Info("Mémoire : %.1f Go libres sur %.1f Go", float64(memFree)/gb, float64(memTotal)/gb)

	full, err1 := wmiQuery(`root\wmi`, "SELECT FullChargedCapacity FROM BatteryFullChargedCapacity", "FullChargedCapacity")
	design, err2 := wmiQuery(`root\wmi`, "SELECT DesignedCapacity FROM BatteryStaticData", "DesignedCapacity")
	if err1 == nil && err2 == nil && len(full) > 0 && len(design) > 0 && asInt(design[0]["DesignedCapacity"]) > 0 {
		h := asInt(full[0]["FullChargedCapacity"]) * 100 / asInt(design[0]["DesignedCapacity"])
		if h >= 70 {
			j.Ok("Batterie à %d %% de sa capacité d'origine", h)
		} else {
			j.Bad("Batterie à %d %% de sa capacité d'origine : elle est usée", h)
		}
	} else {
		j.Skip("Capacité de la batterie non lisible sur ce PC")
	}
	report := filepath.Join(desktopDir(), "rapport-batterie.html")
	runHidden(system32("powercfg.exe"), "/batteryreport", "/output", report)
	if fileExists(report) {
		j.Ok("Rapport batterie détaillé enregistré sur le Bureau (rapport-batterie.html)")
	}

	// Événements 41 et 6008 : arrêts brutaux ; 1001 : écrans bleus.
	out, _ := runHidden(system32("wevtutil.exe"), "qe", "System", "/f:xml", "/c:200",
		"/q:*[System[(EventID=41 or EventID=6008 or EventID=1001) and TimeCreated[timediff(@SystemTime) <= 2592000000]]]")
	if n := strings.Count(out, "<Event "); n == 0 {
		j.Ok("Aucun arrêt brutal ni écran bleu ces 30 derniers jours")
	} else {
		j.Bad("%d arrêt(s) brutal(aux) ou écran(s) bleu(s) ces 30 derniers jours : la réparation qui suit peut aider", n)
	}
}

func desktopDir() string {
	if d := regString("HKCU", `Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders`, "Desktop"); d != "" {
		return d
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Desktop")
}

func dismRestore(j *Job) {
	j.Info("Étape la plus longue : 10 à 30 minutes. Laissez le PC branché.")
	if _, code := runHidden(system32("dism.exe"), "/Online", "/Cleanup-Image", "/RestoreHealth"); code == 0 {
		j.Ok("Image Windows saine (réparée si besoin)")
	} else {
		j.Skip("DISM n'a pas pu finir (code %d). Vérifiez Internet et relancez plus tard.", code)
	}
}

func sfcScan(j *Job) {
	j.Info("5 à 15 minutes.")
	runHidden(system32("sfc.exe"), "/scannow")
	j.Ok("Fichiers système vérifiés, ceux abîmés ont été remplacés")
}

func dismCleanup(j *Job) {
	_, before := diskSpace()
	runHidden(system32("dism.exe"), "/Online", "/Cleanup-Image", "/StartComponentCleanup")
	_, after := diskSpace()
	if after > before {
		j.Ok("Anciennes versions de Windows nettoyées : %d Mo libérés", (after-before)>>20)
	} else {
		j.Ok("Anciens composants déjà propres")
	}
}

func chkdskScan(j *Job) {
	_, code := runHidden(system32("chkdsk.exe"), sysDrive(), "/scan")
	switch code {
	case 0:
		j.Ok("Disque vérifié : aucune erreur")
	case 1:
		j.Ok("Disque vérifié : des erreurs ont été corrigées")
	default:
		j.Bad("Le disque a des erreurs à corriger au redémarrage")
		runHidden(system32("fsutil.exe"), "dirty", "set", sysDrive())
		j.NeedReboot()
	}
}

func repairNetwork(j *Job) {
	runHidden(system32("ipconfig.exe"), "/flushdns")
	runHidden(system32("netsh.exe"), "winsock", "reset")
	runHidden(system32("netsh.exe"), "int", "ip", "reset")
	runHidden(system32("ipconfig.exe"), "/release")
	runHidden(system32("ipconfig.exe"), "/renew")
	j.Ok("Cache Internet vidé et réseau réinitialisé")
	j.Info("Redémarrez le PC pour finir. Si le Wi-Fi redemande son mot de passe, c'est normal.")
	j.NeedReboot()
}
