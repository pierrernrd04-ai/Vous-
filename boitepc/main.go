//go:build windows

// BoitePC : cinq outils d'entretien pour Windows 11, dans une seule appli.
// L'interface est une page locale affichée dans une fenêtre Edge sans barre
// d'adresse ; tout le travail est fait ici, avec les outils intégrés à Windows.
package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

//go:embed ui/index.html
var uiFiles embed.FS

var (
	user32      = windows.NewLazySystemDLL("user32.dll")
	shell32     = windows.NewLazySystemDLL("shell32.dll")
	messageBoxW = user32.NewProc("MessageBoxW")
)

func main() {
	args := os.Args[1:]

	// Modes sans interface, lancés par les tâches planifiées.
	if len(args) == 1 {
		switch args[0] {
		case "--nettoyage":
			j := newJob("Nettoyage hebdomadaire")
			cleanTemp(j)
			retrim(j)
			return
		case "--maj-applis":
			j := newJob("Mise à jour hebdomadaire")
			upgradeApps(j)
			return
		}
	}

	if !windows.GetCurrentProcessToken().IsElevated() {
		if err := relaunchElevated(args); err != nil {
			messageBox("BoitePC a besoin de l'autorisation administrateur pour régler Windows.\n\n"+
				"Relancez BoitePC et cliquez sur « Oui » dans la fenêtre bleue.", 0x30)
		}
		return
	}

	if err := serve(); err != nil {
		messageBox("BoitePC n'a pas pu démarrer : "+err.Error(), 0x10)
	}
}

func messageBox(text string, flags uintptr) {
	t, _ := windows.UTF16PtrFromString(text)
	c, _ := windows.UTF16PtrFromString("BoitePC")
	messageBoxW.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), flags)
}

func relaunchElevated(args []string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	verb, _ := windows.UTF16PtrFromString("runas")
	file, _ := windows.UTF16PtrFromString(exe)
	params, _ := windows.UTF16PtrFromString(strings.Join(args, " "))
	dir, _ := windows.UTF16PtrFromString(filepath.Dir(exe))
	return windows.ShellExecute(0, verb, file, params, dir, windows.SW_SHOWNORMAL)
}

func randomToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func serve() error {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	addr := ln.Addr().String()
	token := randomToken()
	app := newServer(addr, token)

	go app.watchIdle(3 * time.Minute)
	openWindow(fmt.Sprintf("http://%s/?t=%s", addr, token))
	return http.Serve(ln, app)
}

// Ouvre l'interface dans une fenêtre Edge « application » (sans onglets ni
// barre d'adresse), ou dans le navigateur par défaut si Edge est introuvable.
func openWindow(url string) {
	for _, base := range []string{os.Getenv("ProgramFiles(x86)"), os.Getenv("ProgramFiles")} {
		edge := filepath.Join(base, `Microsoft\Edge\Application\msedge.exe`)
		if _, err := os.Stat(edge); err == nil {
			// Profil séparé : la fenêtre s'ouvre même si Edge est déjà lancé.
			profile := filepath.Join(os.Getenv("LOCALAPPDATA"), "BoitePC", "fenetre")
			cmd := exec.Command(edge, "--app="+url, "--window-size=1180,860",
				"--user-data-dir="+profile, "--no-first-run", "--no-default-browser-check")
			if cmd.Start() == nil {
				return
			}
		}
	}
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	cmd.Start()
}
