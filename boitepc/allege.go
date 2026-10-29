//go:build windows

package main

import (
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

type bloatEntry struct {
	match   string // nom du paquet, ou fragment s'il commence par *
	label   string
	checked bool // coché par défaut dans l'interface
}

// Rien d'indispensable : ni le Store, ni Photos, ni la Calculatrice, ni le
// Lecteur multimédia, ni les pilotes. Tout se réinstalle depuis le Store.
var bloatCatalog = []bloatEntry{
	{"Microsoft.BingNews", "Actualités", true},
	{"Microsoft.BingWeather", "Météo", true},
	{"Microsoft.BingSearch", "Recherche Bing", true},
	{"Microsoft.GetHelp", "Obtenir de l'aide", true},
	{"Microsoft.Getstarted", "Astuces", true},
	{"Microsoft.MicrosoftSolitaireCollection", "Solitaire", true},
	{"Microsoft.People", "Contacts", true},
	{"Microsoft.WindowsFeedbackHub", "Hub de commentaires", true},
	{"Microsoft.ZuneVideo", "Films et TV", true},
	{"Microsoft.WindowsMaps", "Cartes", true},
	{"Microsoft.MicrosoftOfficeHub", "Microsoft 365 (raccourci publicitaire)", true},
	{"Microsoft.549981C3F5F10", "Cortana", true},
	{"Microsoft.PowerAutomateDesktop", "Power Automate", true},
	{"Microsoft.Todos", "To Do", true},
	{"Microsoft.MixedReality.Portal", "Réalité mixte", true},
	{"Microsoft.SkypeApp", "Skype", true},
	{"Microsoft.XboxApp", "Xbox (ancienne appli)", true},
	{"Microsoft.GamingApp", "Xbox", true},
	{"Microsoft.XboxGamingOverlay", "Xbox Game Bar", true},
	{"Microsoft.Windows.DevHome", "Dev Home", true},
	{"Microsoft.Copilot", "Copilot", true},
	{"Clipchamp.Clipchamp", "Clipchamp", true},
	{"MicrosoftTeams", "Teams (personnel)", true},
	{"MSTeams", "Teams (personnel)", true},
	{"MicrosoftCorporationII.QuickAssist", "Assistance rapide (souvent utilisée par les arnaqueurs)", false},
	{"Microsoft.WindowsAlarms", "Horloge", false},
	{"Microsoft.YourPhone", "Lien avec le téléphone", false},
	{"*SpotifyMusic", "Spotify", true},
	{"*Disney", "Disney+", true},
	{"*TikTok", "TikTok", true},
	{"*Instagram", "Instagram", true},
	{"*Facebook", "Facebook", true},
	{"*CandyCrush", "Candy Crush", true},
	{"*LinkedIn", "LinkedIn", true},
	{"*PrimeVideo", "Prime Video", true},
	{"*McAfee", "McAfee (version d'essai)", true},
	{"*Norton", "Norton (version d'essai)", true},
}

type foundApp struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Checked  bool     `json:"checked"`
	Packages []string `json:"-"`
}

const packagesKey = `Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\Repository\Packages`

// installedPackages liste les noms complets des applis du Store installées
// pour l'utilisateur (« Nom_Version_Archi__Editeur »).
func installedPackages() []string {
	k, err := registry.OpenKey(registry.CURRENT_USER, packagesKey, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return nil
	}
	defer k.Close()
	names, _ := k.ReadSubKeyNames(-1)
	return names
}

func findBloat() []foundApp {
	pkgs := installedPackages()
	var out []foundApp
	for _, e := range bloatCatalog {
		var hits []string
		for _, full := range pkgs {
			name := strings.SplitN(full, "_", 2)[0]
			if strings.HasPrefix(e.match, "*") {
				if strings.Contains(strings.ToLower(name), strings.ToLower(e.match[1:])) {
					hits = append(hits, full)
				}
			} else if strings.EqualFold(name, e.match) {
				hits = append(hits, full)
			}
		}
		if len(hits) > 0 {
			out = append(out, foundApp{ID: e.match, Label: e.label, Checked: e.checked, Packages: hits})
		}
	}
	return out
}

func allegePlan(req RunRequest) toolPlan {
	apps := req.Apps
	if req.Tool == "complet" || apps == nil {
		apps = nil
		for _, a := range findBloat() {
			if a.Checked {
				apps = append(apps, a.ID)
			}
		}
	}
	steps := []step{
		{"Applications préinstallées", func(j *Job) { removeApps(j, apps) }},
		{"Menu Démarrer et recherche", startMenu},
	}
	if opt(req, "onedrive", false) {
		steps = append(steps, step{"OneDrive", stopOneDrive})
	}
	steps = append(steps, step{"Place sur le disque", func(j *Job) { freeSpace(j, opt(req, "hibernation", false)) }})
	return toolPlan{"AllegePC", steps}
}

func removeApps(j *Job, ids []string) {
	if len(ids) == 0 {
		j.Ok("Aucune appli à supprimer")
		return
	}
	w := wingetPath()
	if w == "" {
		j.Skip("Outil winget absent : ouvrez le Microsoft Store, installez « Programme d'installation d'application », puis relancez AllegePC")
		return
	}
	want := map[string]bool{}
	for _, id := range ids {
		want[id] = true
	}
	removed := 0
	for _, app := range findBloat() {
		if !want[app.ID] {
			continue
		}
		ok := true
		for _, full := range app.Packages {
			if !uninstallPackage(w, full) {
				ok = false
			}
		}
		if ok {
			removed++
			j.Ok("%s supprimé", app.Label)
		} else {
			j.Skip("%s : Windows a refusé. Paramètres > Applications > Applications installées > ⋯ > Désinstaller.", app.Label)
		}
	}
	if removed > 0 {
		j.Info("Une appli vous manque ? Elle se réinstalle depuis le Microsoft Store.")
	}
}

// winget connaît les applis du Store sous « MSIX\nom complet » ou sous leur
// nom de famille (« Nom_Editeur ») selon les versions : on essaie les deux.
func uninstallPackage(winget, full string) bool {
	parts := strings.Split(full, "_")
	family := parts[0] + "_" + parts[len(parts)-1]
	common := []string{"--silent", "--accept-source-agreements", "--disable-interactivity"}
	for _, args := range [][]string{
		append([]string{"uninstall", "--id", `MSIX\` + full, "--exact"}, common...),
		append([]string{"uninstall", "--id", family, "--exact"}, common...),
		append([]string{"uninstall", "--product-code", family}, common...),
	} {
		if _, code := runHidden(winget, args...); code == 0 {
			return true
		}
	}
	return false
}

func startMenu(j *Job) {
	adv := `Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`
	regApply([]regItem{
		{"HKCU", `Software\Microsoft\Windows\CurrentVersion\Search`, "BingSearchEnabled", 0},
		{"HKCU", `Software\Policies\Microsoft\Windows\Explorer`, "DisableSearchBoxSuggestions", 1},
		{"HKCU", adv, "Start_IrisRecommendations", 0},
		{"HKCU", adv, "ShowCopilotButton", 0},
	}, true)
	j.Ok("Recherche Bing retirée du menu Démarrer : il s'ouvre plus vite")
	j.Ok("Recommandations et bouton Copilot retirés")
}

func stopOneDrive(j *Job) {
	k, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err == nil {
		k.DeleteValue("OneDrive")
		k.Close()
	}
	runHidden(system32("taskkill.exe"), "/IM", "OneDrive.exe", "/F")
	j.Ok("OneDrive ne démarre plus avec Windows (rien n'est supprimé, il se relance depuis le menu Démarrer)")
}

var shEmptyRecycleBin = shell32.NewProc("SHEmptyRecycleBinW")

func freeSpace(j *Job, hibernation bool) {
	_, before := diskSpace()
	// SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND
	shEmptyRecycleBin.Call(0, uintptr(unsafe.Pointer(nil)), 7)
	j.Ok("Corbeille vidée")
	cleanTemp(j)
	local := os.Getenv("LOCALAPPDATA")
	emptyDir(filepath.Join(local, `Microsoft\Windows\Explorer\ThumbCacheToDelete`))
	if hibernation {
		runHidden(system32("powercfg.exe"), "/hibernate", "off")
		j.Ok("Veille prolongée désactivée (la mise en veille normale reste disponible)")
	}
	_, after := diskSpace()
	if after > before {
		j.Ok("%.1f Go libérés au total", float64(after-before)/gb)
	}
}
