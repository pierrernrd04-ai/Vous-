//go:build windows

package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"sync"
	"time"

	ole "github.com/go-ole/go-ole"
)

// --- Journal d'une tâche ---------------------------------------------------

type Line struct {
	N    int    `json:"n"`
	Kind string `json:"kind"` // tool, step, ok, bad, skip, info
	Text string `json:"text"`
}

type Job struct {
	mu        sync.Mutex
	lines     []Line
	running   bool
	tool      string
	step      string
	stepStart time.Time
	stepIndex int
	stepCount int
	reboot    bool
	logFile   *os.File
}

func newJob(title string) *Job {
	j := &Job{tool: title}
	dir := dataDir()
	os.MkdirAll(dir, 0o755)
	if f, err := os.OpenFile(filepath.Join(dir, "journal.txt"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644); err == nil {
		j.logFile = f
		fmt.Fprintf(f, "\r\n===== %s - %s =====\r\n", time.Now().Format("02/01/2006 15:04"), title)
	}
	return j
}

func (j *Job) add(kind, format string, a ...any) {
	text := fmt.Sprintf(format, a...)
	j.mu.Lock()
	j.lines = append(j.lines, Line{N: len(j.lines), Kind: kind, Text: text})
	if kind == "tool" {
		j.tool = text
	}
	if kind == "step" {
		j.step, j.stepStart = text, time.Now()
		j.stepIndex++
	}
	f := j.logFile
	j.mu.Unlock()
	if f != nil {
		fmt.Fprintf(f, "[%s] %s\r\n", kind, text)
	}
}

func (j *Job) Tool(f string, a ...any) { j.add("tool", f, a...) }
func (j *Job) Step(f string, a ...any) { j.add("step", f, a...) }
func (j *Job) Ok(f string, a ...any)   { j.add("ok", f, a...) }
func (j *Job) Bad(f string, a ...any)  { j.add("bad", f, a...) }
func (j *Job) Skip(f string, a ...any) { j.add("skip", f, a...) }
func (j *Job) Info(f string, a ...any) { j.add("info", f, a...) }

func (j *Job) NeedReboot() { j.mu.Lock(); j.reboot = true; j.mu.Unlock() }

// Une étape qui plante ne doit pas empêcher les suivantes.
func (j *Job) safe(fn func(*Job)) {
	defer func() {
		if r := recover(); r != nil {
			j.Skip("Étape interrompue : %v", r)
		}
	}()
	fn(j)
}

// --- Serveur ---------------------------------------------------------------

type Server struct {
	addr, token string
	mu          sync.Mutex
	job         *Job
	lastSeen    time.Time
	ui          http.Handler
}

func newServer(addr, token string) *Server {
	sub, _ := fs.Sub(uiFiles, "ui")
	return &Server{addr: addr, token: token, lastSeen: time.Now(), ui: http.FileServer(http.FS(sub))}
}

func (s *Server) touch() { s.mu.Lock(); s.lastSeen = time.Now(); s.mu.Unlock() }

func (s *Server) busy() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.job == nil {
		return false
	}
	s.job.mu.Lock()
	defer s.job.mu.Unlock()
	return s.job.running
}

// La fenêtre fermée, l'appli s'arrête d'elle-même (jamais en plein travail).
func (s *Server) watchIdle(limit time.Duration) {
	for range time.Tick(10 * time.Second) {
		s.mu.Lock()
		idle := time.Since(s.lastSeen)
		s.mu.Unlock()
		if idle > limit && !s.busy() {
			os.Exit(0)
		}
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Seule la fenêtre ouverte par BoitePC peut piloter l'appli : même
	// adresse (contre le DNS rebinding) et jeton secret.
	if r.Host != s.addr {
		http.Error(w, "interdit", http.StatusForbidden)
		return
	}
	if r.URL.Path == "/" || r.URL.Path == "/index.html" {
		if r.URL.Query().Get("t") != s.token {
			http.Error(w, "interdit", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		s.ui.ServeHTTP(w, r)
		return
	}
	if r.Header.Get("X-Token") != s.token {
		http.Error(w, "interdit", http.StatusForbidden)
		return
	}
	s.touch()
	switch r.URL.Path {
	case "/api/status":
		s.status(w, r)
	case "/api/info":
		writeJSON(w, systemInfo())
	case "/api/apps":
		writeJSON(w, findBloat())
	case "/api/run":
		s.run(w, r)
	case "/api/action":
		s.action(w, r)
	default:
		http.NotFound(w, r)
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func (s *Server) status(w http.ResponseWriter, r *http.Request) {
	since, _ := strconv.Atoi(r.URL.Query().Get("since"))
	s.mu.Lock()
	j := s.job
	s.mu.Unlock()
	out := map[string]any{"running": false, "lines": []Line{}}
	if j != nil {
		j.mu.Lock()
		if since < 0 || since > len(j.lines) {
			since = 0
		}
		out["running"] = j.running
		out["lines"] = append([]Line(nil), j.lines[since:]...)
		out["total"] = len(j.lines)
		out["tool"] = j.tool
		out["step"] = j.step
		out["stepSeconds"] = int(time.Since(j.stepStart).Seconds())
		out["stepIndex"] = j.stepIndex
		out["stepCount"] = j.stepCount
		out["reboot"] = j.reboot
		j.mu.Unlock()
	}
	writeJSON(w, out)
}

type RunRequest struct {
	Tool    string          `json:"tool"`
	Options map[string]bool `json:"options"`
	Apps    []string        `json:"apps"`
}

func (s *Server) run(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST", http.StatusMethodNotAllowed)
		return
	}
	var req RunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	plan, title := planFor(req)
	if plan == nil {
		http.Error(w, "outil inconnu", http.StatusBadRequest)
		return
	}
	if s.busy() {
		http.Error(w, "Un outil est déjà en cours.", http.StatusConflict)
		return
	}
	j := newJob(title)
	j.running = true
	j.stepCount = countSteps(plan)
	s.mu.Lock()
	s.job = j
	s.mu.Unlock()

	go func() {
		// Les appels WMI et Windows Update passent par COM, qui exige un
		// thread fixe initialisé.
		runtime.LockOSThread()
		ole.CoInitializeEx(0, ole.COINIT_MULTITHREADED)
		defer ole.CoUninitialize()
		for _, p := range plan {
			if p.tool != "" {
				j.Tool("%s", p.tool)
			}
			for _, st := range p.steps {
				j.Step("%s", st.title)
				j.safe(st.fn)
			}
		}
		j.mu.Lock()
		j.running = false
		j.step = ""
		if j.logFile != nil {
			j.logFile.Close()
			j.logFile = nil
		}
		j.mu.Unlock()
	}()
	writeJSON(w, map[string]bool{"ok": true})
}

func (s *Server) action(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	switch req.Name {
	case "startup":
		startVisible(system32("taskmgr.exe"), "/0", "/startup")
	case "reboot":
		runHidden(system32("shutdown.exe"), "/r", "/t", "10", "/c", "BoitePC : redémarrage pour finir l'entretien")
	case "folder":
		startVisible(filepath.Join(os.Getenv("SystemRoot"), "explorer.exe"), dataDir())
	case "quit":
		if !s.busy() {
			go func() { time.Sleep(300 * time.Millisecond); os.Exit(0) }()
		}
	}
	writeJSON(w, map[string]bool{"ok": true})
}
