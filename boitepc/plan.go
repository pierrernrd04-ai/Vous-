//go:build windows

package main

import (
	"fmt"
	"os"
	"strings"
)

type step struct {
	title string
	fn    func(*Job)
}

type toolPlan struct {
	tool  string
	steps []step
}

func countSteps(plan []toolPlan) (n int) {
	for _, p := range plan {
		n += len(p.steps)
	}
	return n
}

// opt lit une case cochée dans l'interface, avec sa valeur par défaut.
func opt(req RunRequest, key string, def bool) bool {
	if v, ok := req.Options[key]; ok {
		return v
	}
	return def
}

func planFor(req RunRequest) ([]toolPlan, string) {
	rp := toolPlan{steps: []step{{"Point de restauration Windows", restorePoint}}}
	switch req.Tool {
	case "turbo":
		return []toolPlan{rp, turboPlan(req)}, "TurboPC"
	case "bouclier":
		return []toolPlan{rp, bouclierPlan(req)}, "BouclierPC"
	case "audit":
		return []toolPlan{{"BouclierPC", []step{{"Bilan de sécurité", audit}}}}, "Bilan de sécurité"
	case "maj":
		return []toolPlan{majPlan(req)}, "MajPC"
	case "repare":
		return []toolPlan{reparePlan(req)}, "ReparePC"
	case "diagnostic":
		return []toolPlan{{"ReparePC", []step{{"Diagnostic du PC", diagnostic}}}}, "Diagnostic"
	case "allege":
		return []toolPlan{rp, allegePlan(req)}, "AllegePC"
	case "complet":
		// D'abord retirer le superflu, puis mettre à jour, réparer,
		// sécuriser, et optimiser en dernier.
		return []toolPlan{rp, allegePlan(req), majPlan(req), reparePlan(req), bouclierPlan(req), turboPlan(req),
			{"Fin", []step{{"Résumé", summary}}}}, "Entretien complet"
	case "undo":
		return []toolPlan{{"Annulation", []step{{"Remise des réglages d'origine", undoAll}}}}, "Annulation"
	case "scan-full":
		return []toolPlan{{"BouclierPC", []step{{"Analyse antivirus complète", fullScan}}}}, "Analyse complète"
	case "network":
		return []toolPlan{{"ReparePC", []step{{"Réparation d'Internet", repairNetwork}}}}, "Réparation d'Internet"
	}
	return nil, ""
}

func summary(j *Job) {
	j.Ok("Entretien complet terminé. Redémarrez le PC pour que tout prenne effet.")
}

// --- Point de restauration -------------------------------------------------

func restorePoint(j *Job) {
	// Windows refuse plus d'un point par 24 h par défaut : on lève la limite.
	regSet("HKLM", `SOFTWARE\Microsoft\Windows NT\CurrentVersion\SystemRestore`, "SystemRestorePointCreationFrequency", uint32(0), false)
	svc, err := wmiConnect(`root\default`)
	if err != nil {
		j.Skip("Point de restauration impossible (%v)", err)
		return
	}
	defer svc.Release()
	cls := mustDispatch(svc, "Get", "SystemRestore")
	defer cls.Release()
	callQuiet(cls, "Enable", sysDrive()+`\`)
	r := mustCall(cls, "CreateRestorePoint", "Avant BoitePC", 12, 100)
	if asInt(r) == 0 {
		j.Ok("Point de restauration « Avant BoitePC » créé")
	} else {
		j.Skip("Windows n'a pas créé le point de restauration (code %d). La protection système est peut-être coupée.", asInt(r))
	}
}

// --- Annulation ------------------------------------------------------------

func undoAll(j *Job) {
	restored, failed, scheme := restoreBackup()
	if restored == 0 && failed == 0 {
		j.Info("Aucun réglage BoitePC à annuler.")
		return
	}
	j.Ok("%d réglage(s) remis comme avant", restored)
	if failed > 0 {
		j.Skip("%d réglage(s) n'ont pas pu être remis", failed)
	}
	if scheme != "" {
		runHidden(system32("powercfg.exe"), "/setactive", scheme)
		j.Ok("Mode d'alimentation d'origine rétabli")
	}
	for _, t := range []string{taskClean, taskApps} {
		runHidden(system32("schtasks.exe"), "/Delete", "/TN", t, "/F")
	}
	j.Ok("Tâches automatiques supprimées")
	j.Info("Redémarrez le PC pour terminer.")
	j.NeedReboot()
}

// --- Infos système ---------------------------------------------------------

func systemInfo() map[string]any {
	cpu := strings.TrimSpace(regString("HKLM", `HARDWARE\DESCRIPTION\System\CentralProcessor\0`, "ProcessorNameString"))
	cv := `SOFTWARE\Microsoft\Windows NT\CurrentVersion`
	osName := regString("HKLM", cv, "ProductName")
	if b := regString("HKLM", cv, "CurrentBuild"); b >= "22000" {
		osName = strings.Replace(osName, "Windows 10", "Windows 11", 1)
	}
	if v := regString("HKLM", cv, "DisplayVersion"); v != "" {
		osName += " " + v
	}
	memTotal, memFree := memory()
	diskTotal, diskFree := diskSpace()
	return map[string]any{
		"cpu":       cpu,
		"os":        osName,
		"memTotal":  fmt.Sprintf("%.1f", float64(memTotal)/gb),
		"memFree":   fmt.Sprintf("%.1f", float64(memFree)/gb),
		"diskTotal": fmt.Sprintf("%.0f", float64(diskTotal)/gb),
		"diskFree":  fmt.Sprintf("%.0f", float64(diskFree)/gb),
		"backup":    fileExists(backupPath()),
	}
}

func fileExists(p string) bool { _, err := os.Stat(p); return err == nil }
