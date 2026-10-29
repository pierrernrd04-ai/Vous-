//go:build windows

package main

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf16"
)

const highPerformance = "8c5e7fda-e8bf-4a96-9a85-cf6e3ad3ab7c"

func turboPlan(req RunRequest) toolPlan {
	steps := []step{
		{"Mode Hautes performances", turboPower},
		{"Effets visuels allégés", turboVisual},
		{"Tâches de fond inutiles", turboBackground},
	}
	if opt(req, "indexation", true) {
		steps = append(steps, step{"Indexation de la recherche", turboSearch})
	}
	steps = append(steps, step{"Fichiers temporaires", cleanTemp}, step{"Optimisation du SSD", retrim})
	if opt(req, "nettoyageAuto", true) {
		steps = append(steps, step{"Nettoyage automatique", scheduleClean})
	}
	return toolPlan{"TurboPC", steps}
}

func turboPower(j *Job) {
	backupMu.Lock()
	b := loadBackup()
	if b.PowerScheme == "" {
		b.PowerScheme = activePowerScheme()
		saveBackup(b)
	}
	backupMu.Unlock()

	pc := system32("powercfg.exe")
	if list, _ := runHidden(pc, "/list"); !strings.Contains(strings.ToLower(list), highPerformance) {
		runHidden(pc, "/duplicatescheme", highPerformance, highPerformance)
	}
	if _, code := runHidden(pc, "/setactive", highPerformance); code != 0 {
		j.Skip("Ce PC n'accepte pas le mode Hautes performances")
		return
	}
	runHidden(pc, "/setacvalueindex", highPerformance, "SUB_PROCESSOR", "PROCTHROTTLEMIN", "100")
	runHidden(pc, "/setacvalueindex", highPerformance, "SUB_DISK", "DISKIDLE", "0")
	runHidden(pc, "/setactive", highPerformance)
	j.Ok("Hautes performances activé : sur secteur, le processeur ne ralentit plus")
	j.Info("Sur batterie, l'autonomie baisse un peu.")
}

func turboVisual(j *Job) {
	adv := `Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`
	failed := regApply([]regItem{
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects`, "VisualFXSetting", 3},
		// Masque « meilleures performances » en gardant le lissage des polices.
		{"HKCU", `Control Panel\Desktop`, "UserPreferencesMask", []byte{0x90, 0x12, 0x03, 0x80, 0x10, 0x00, 0x00, 0x00}},
		{"HKCU", `Control Panel\Desktop`, "FontSmoothing", "2"},
		{"HKCU", `Control Panel\Desktop`, "MenuShowDelay", "0"},
		{"HKCU", `Control Panel\Desktop\WindowMetrics`, "MinAnimate", "0"},
		{"HKCU", adv, "TaskbarAnimations", 0},
		{"HKCU", adv, "ListviewAlphaSelect", 0},
		{"HKCU", adv, "ListviewShadow", 0},
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`, "EnableTransparency", 0},
		{"HKCU", `Software\Microsoft\Windows\DWM`, "EnableAeroPeek", 0},
	}, true)
	j.Ok("Animations, ombres et transparence coupées : menus et fenêtres instantanés")
	if failed > 0 {
		j.Skip("%d réglage(s) refusé(s) par Windows", failed)
	}
}

func turboBackground(j *Job) {
	cdm := `Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager`
	items := []regItem{
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications`, "GlobalUserDisabled", 1},
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\Search`, "BackgroundAppGlobalToggle", 0},
		{"HKCU", `System\GameConfigStore`, "GameDVR_Enabled", 0},
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\GameDVR`, "AppCaptureEnabled", 0},
		{"HKLM", `SOFTWARE\Policies\Microsoft\Edge`, "StartupBoostEnabled", 0},
		{"HKLM", `SOFTWARE\Policies\Microsoft\Edge`, "BackgroundModeEnabled", 0},
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize`, "StartupDelayInMSec", 0},
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`, "TaskbarDa", 0},
	}
	for _, n := range []string{"SubscribedContent-338388Enabled", "SubscribedContent-338389Enabled",
		"SubscribedContent-353694Enabled", "SubscribedContent-353696Enabled",
		"SystemPaneSuggestionsEnabled", "SoftLandingEnabled", "SilentInstalledAppsEnabled"} {
		items = append(items, regItem{"HKCU", cdm, n, 0})
	}
	regApply(items, true)
	j.Ok("Applis du Store bloquées en arrière-plan")
	j.Ok("Enregistrement vidéo Xbox (Game DVR) coupé")
	j.Ok("Pubs, suggestions et installations silencieuses coupées")
	j.Ok("Edge ne tourne plus en cachette une fois fermé")
	j.Ok("Programmes de démarrage lancés sans délai artificiel")
	if disableService("DiagTrack") {
		j.Ok("Envoi de données de diagnostic à Microsoft arrêté")
	}
	disableService("dmwappushservice")
}

func turboSearch(j *Job) {
	if disableService("WSearch") {
		j.Ok("Indexation coupée : la recherche marche toujours, un peu plus lentement")
	} else {
		j.Skip("Indexation introuvable")
	}
}

func cleanTemp(j *Job) {
	_, before := diskSpace()
	win := os.Getenv("SystemRoot")
	local := os.Getenv("LOCALAPPDATA")
	runHidden(system32("net.exe"), "stop", "wuauserv")
	for _, dir := range []string{os.Getenv("TEMP"), filepath.Join(win, "Temp"),
		filepath.Join(win, `SoftwareDistribution\Download`),
		filepath.Join(local, `Microsoft\Windows\INetCache`), filepath.Join(local, "CrashDumps"),
		filepath.Join(os.Getenv("ProgramData"), `Microsoft\Windows\WER\ReportArchive`)} {
		emptyDir(dir)
	}
	runHidden(system32("net.exe"), "start", "wuauserv")
	_, after := diskSpace()
	freed := int64(after) - int64(before)
	if freed < 0 {
		freed = 0
	}
	j.Ok("%d Mo de fichiers temporaires supprimés", freed>>20)
}

// Vide un dossier en ignorant les fichiers encore utilisés.
func emptyDir(dir string) {
	if dir == "" || len(dir) < 4 {
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, e := range entries {
		os.RemoveAll(filepath.Join(dir, e.Name()))
	}
}

func retrim(j *Job) {
	if _, code := runHidden(system32("defrag.exe"), sysDrive(), "/L"); code == 0 {
		j.Ok("SSD optimisé (TRIM)")
	} else {
		j.Skip("Optimisation du disque non disponible")
	}
}

// --- Tâches planifiées -----------------------------------------------------

const (
	taskClean = `BoitePC\Nettoyage hebdomadaire`
	taskApps  = `BoitePC\Mise a jour des applis`
)

// Copie l'appli dans ProgramData pour que la tâche marche même si le
// fichier téléchargé est déplacé ou supprimé.
func installSelf() (string, error) {
	src, err := os.Executable()
	if err != nil {
		return "", err
	}
	dst := filepath.Join(dataDir(), "BoitePC.exe")
	if strings.EqualFold(src, dst) {
		return dst, nil
	}
	data, err := os.ReadFile(src)
	if err != nil {
		return "", err
	}
	os.MkdirAll(dataDir(), 0o755)
	return dst, os.WriteFile(dst, data, 0o755)
}

func createTask(name, exe, args, day, hour string, asSystem bool) error {
	principal := `<UserId>S-1-5-18</UserId><RunLevel>HighestAvailable</RunLevel>`
	network := ""
	if !asSystem {
		principal = `<UserId>` + os.Getenv("USERDOMAIN") + `\` + os.Getenv("USERNAME") +
			`</UserId><LogonType>InteractiveToken</LogonType><RunLevel>HighestAvailable</RunLevel>`
		network = `<RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>`
	}
	start := time.Now().AddDate(0, 0, 1).Format("2006-01-02") + "T" + hour + ":00"
	xml := `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers><CalendarTrigger><StartBoundary>` + start + `</StartBoundary>
    <ScheduleByWeek><DaysOfWeek><` + day + ` /></DaysOfWeek><WeeksInterval>1</WeeksInterval></ScheduleByWeek>
  </CalendarTrigger></Triggers>
  <Principals><Principal id="Author">` + principal + `</Principal></Principals>
  <Settings>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>` + network + `
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author"><Exec><Command>` + exe + `</Command><Arguments>` + args + `</Arguments></Exec></Actions>
</Task>`
	// schtasks attend un fichier XML en UTF-16 avec BOM.
	u := utf16.Encode([]rune(xml))
	buf := make([]byte, 2+2*len(u))
	buf[0], buf[1] = 0xFF, 0xFE
	for i, c := range u {
		binary.LittleEndian.PutUint16(buf[2+2*i:], c)
	}
	file := filepath.Join(os.TempDir(), "boitepc-tache.xml")
	if err := os.WriteFile(file, buf, 0o644); err != nil {
		return err
	}
	defer os.Remove(file)
	if out, code := runHidden(system32("schtasks.exe"), "/Create", "/TN", name, "/XML", file, "/F"); code != 0 {
		return &taskError{strings.TrimSpace(out)}
	}
	return nil
}

type taskError struct{ msg string }

func (e *taskError) Error() string { return e.msg }

func scheduleClean(j *Job) {
	exe, err := installSelf()
	if err == nil {
		err = createTask(taskClean, exe, "--nettoyage", "Sunday", "12:00", true)
	}
	if err != nil {
		j.Skip("Nettoyage automatique non programmé (%v)", err)
		return
	}
	j.Ok("Nettoyage automatique chaque dimanche (rattrapé au prochain allumage si le PC était éteint)")
}
