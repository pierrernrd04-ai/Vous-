//go:build windows

package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	ole "github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

func dataDir() string { return filepath.Join(os.Getenv("ProgramData"), "BoitePC") }

func sysDrive() string {
	if d := os.Getenv("SystemDrive"); d != "" {
		return d
	}
	return "C:"
}

// --- Programmes Windows ----------------------------------------------------

const createNoWindow = 0x08000000

// Lance un outil intégré à Windows sans ouvrir de fenêtre noire.
func runHidden(name string, args ...string) (string, int) {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
	out, err := cmd.CombinedOutput()
	code := 0
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		code = exitErr.ExitCode()
	} else if err != nil {
		code = -1
	}
	return string(out), code
}

func startVisible(name string, args ...string) {
	exec.Command(name, args...).Start()
}

func system32(exe string) string {
	return filepath.Join(os.Getenv("SystemRoot"), "System32", exe)
}

// --- Registre, avec sauvegarde des valeurs d'origine -----------------------

type savedValue struct {
	Root    string `json:"root"`
	Path    string `json:"path"`
	Name    string `json:"name"`
	Existed bool   `json:"existed"`
	Kind    uint32 `json:"kind"`
	Data    string `json:"data"` // base64 des octets bruts
}

type backupFile struct {
	Values      []savedValue `json:"values"`
	PowerScheme string       `json:"powerScheme"`
}

var (
	backupMu sync.Mutex
	roots    = map[string]registry.Key{"HKCU": registry.CURRENT_USER, "HKLM": registry.LOCAL_MACHINE}
)

func backupPath() string { return filepath.Join(dataDir(), "sauvegarde.json") }

func loadBackup() backupFile {
	var b backupFile
	if data, err := os.ReadFile(backupPath()); err == nil {
		json.Unmarshal(data, &b)
	}
	return b
}

func saveBackup(b backupFile) {
	os.MkdirAll(dataDir(), 0o755)
	data, _ := json.MarshalIndent(b, "", "  ")
	os.WriteFile(backupPath(), data, 0o644)
}

var (
	advapi32         = windows.NewLazySystemDLL("advapi32.dll")
	regQueryValueExW = advapi32.NewProc("RegQueryValueExW")
	regSetValueExW   = advapi32.NewProc("RegSetValueExW")
)

// Lit une valeur brute (type + octets) ; ok=false si elle n'existe pas.
func regRaw(k registry.Key, name string) (kind uint32, data []byte, ok bool) {
	n, _ := windows.UTF16PtrFromString(name)
	var size uint32
	r, _, _ := regQueryValueExW.Call(uintptr(k), uintptr(unsafe.Pointer(n)), 0, uintptr(unsafe.Pointer(&kind)), 0, uintptr(unsafe.Pointer(&size)))
	if r != 0 {
		return 0, nil, false
	}
	data = make([]byte, size+2)
	r, _, _ = regQueryValueExW.Call(uintptr(k), uintptr(unsafe.Pointer(n)), 0, uintptr(unsafe.Pointer(&kind)), uintptr(unsafe.Pointer(&data[0])), uintptr(unsafe.Pointer(&size)))
	if r != 0 {
		return 0, nil, false
	}
	return kind, data[:size], true
}

func regWriteRaw(k registry.Key, name string, kind uint32, data []byte) error {
	n, _ := windows.UTF16PtrFromString(name)
	var p uintptr
	if len(data) > 0 {
		p = uintptr(unsafe.Pointer(&data[0]))
	}
	r, _, _ := regSetValueExW.Call(uintptr(k), uintptr(unsafe.Pointer(n)), 0, uintptr(kind), p, uintptr(len(data)))
	if r != 0 {
		return syscall.Errno(r)
	}
	return nil
}

// regSet écrit une valeur (uint32, string ou []byte) et, si save est vrai,
// mémorise l'ancienne une seule fois pour pouvoir tout annuler plus tard.
func regSet(rootName, path, name string, value any, save bool) error {
	root := roots[rootName]
	k, _, err := registry.CreateKey(root, path, registry.ALL_ACCESS)
	if err != nil {
		return err
	}
	defer k.Close()

	if save {
		backupMu.Lock()
		b := loadBackup()
		known := false
		for _, v := range b.Values {
			if v.Root == rootName && strings.EqualFold(v.Path, path) && v.Name == name {
				known = true
				break
			}
		}
		if !known {
			kind, data, ok := regRaw(k, name)
			b.Values = append(b.Values, savedValue{Root: rootName, Path: path, Name: name,
				Existed: ok, Kind: kind, Data: base64.StdEncoding.EncodeToString(data)})
			saveBackup(b)
		}
		backupMu.Unlock()
	}

	switch v := value.(type) {
	case uint32:
		return k.SetDWordValue(name, v)
	case int:
		return k.SetDWordValue(name, uint32(v))
	case string:
		return k.SetStringValue(name, v)
	case []byte:
		return k.SetBinaryValue(name, v)
	}
	return errors.New("type de valeur non géré")
}

// Écrit une liste de réglages et compte ceux que Windows a refusés.
type regItem struct {
	root, path, name string
	value            any
}

func regApply(items []regItem, save bool) (failed int) {
	for _, it := range items {
		if regSet(it.root, it.path, it.name, it.value, save) != nil {
			failed++
		}
	}
	return failed
}

func regDword(rootName, path, name string) (uint32, bool) {
	k, err := registry.OpenKey(roots[rootName], path, registry.QUERY_VALUE)
	if err != nil {
		return 0, false
	}
	defer k.Close()
	v, _, err := k.GetIntegerValue(name)
	return uint32(v), err == nil
}

func regString(rootName, path, name string) string {
	k, err := registry.OpenKey(roots[rootName], path, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer k.Close()
	v, _, _ := k.GetStringValue(name)
	return v
}

func restoreBackup() (restored, failed int, scheme string) {
	backupMu.Lock()
	defer backupMu.Unlock()
	b := loadBackup()
	for _, v := range b.Values {
		k, _, err := registry.CreateKey(roots[v.Root], v.Path, registry.ALL_ACCESS)
		if err != nil {
			failed++
			continue
		}
		if v.Existed {
			data, _ := base64.StdEncoding.DecodeString(v.Data)
			err = regWriteRaw(k, v.Name, v.Kind, data)
		} else {
			err = k.DeleteValue(v.Name)
			if errors.Is(err, registry.ErrNotExist) {
				err = nil
			}
		}
		k.Close()
		if err != nil {
			failed++
		} else {
			restored++
		}
	}
	os.Remove(backupPath())
	return restored, failed, b.PowerScheme
}

// --- Services --------------------------------------------------------------

// Les services se règlent aussi par le registre (valeur Start), ce qui
// permet de les sauvegarder et de les rétablir comme le reste.
func disableService(name string) bool {
	path := `SYSTEM\CurrentControlSet\Services\` + name
	if _, ok := regDword("HKLM", path, "Start"); !ok {
		return false
	}
	if regSet("HKLM", path, "Start", uint32(4), true) != nil {
		return false
	}
	runHidden(system32("sc.exe"), "stop", name)
	return true
}

// --- Alimentation ----------------------------------------------------------

var guidRe = regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`)

func activePowerScheme() string {
	out, _ := runHidden(system32("powercfg.exe"), "/getactivescheme")
	return guidRe.FindString(out)
}

// --- WMI -------------------------------------------------------------------

// wmiQuery renvoie, pour chaque objet trouvé, les propriétés demandées.
// À appeler depuis un thread où COM est initialisé.
func wmiQuery(namespace, query string, props ...string) ([]map[string]any, error) {
	svc, err := wmiConnect(namespace)
	if err != nil {
		return nil, err
	}
	defer svc.Release()
	resRaw, err := oleutil.CallMethod(svc, "ExecQuery", query)
	if err != nil {
		return nil, err
	}
	res := resRaw.ToIDispatch()
	defer res.Release()
	countVar, err := oleutil.GetProperty(res, "Count")
	if err != nil {
		return nil, err
	}
	count := int(countVar.Val)
	var out []map[string]any
	for i := 0; i < count; i++ {
		itemRaw, err := oleutil.CallMethod(res, "ItemIndex", i)
		if err != nil {
			continue
		}
		item := itemRaw.ToIDispatch()
		row := map[string]any{}
		for _, p := range props {
			if v, err := oleutil.GetProperty(item, p); err == nil {
				row[p] = v.Value()
			}
		}
		item.Release()
		out = append(out, row)
	}
	return out, nil
}

func wmiConnect(namespace string) (*ole.IDispatch, error) {
	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return nil, err
	}
	defer unknown.Release()
	locator, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return nil, err
	}
	defer locator.Release()
	svcRaw, err := oleutil.CallMethod(locator, "ConnectServer", ".", namespace)
	if err != nil {
		return nil, err
	}
	return svcRaw.ToIDispatch(), nil
}

func asInt(v any) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case int32:
		return int64(n)
	case int16:
		return int64(n)
	case int8:
		return int64(n)
	case uint8:
		return int64(n)
	case uint16:
		return int64(n)
	case uint32:
		return int64(n)
	case uint64:
		return int64(n)
	case int:
		return int64(n)
	case float64:
		return int64(n)
	case bool:
		if n {
			return 1
		}
	case string:
		var x int64
		for _, c := range n {
			if c < '0' || c > '9' {
				break
			}
			x = x*10 + int64(c-'0')
		}
		return x
	}
	return 0
}

func asBool(v any) bool { return asInt(v) != 0 }

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// --- Mémoire et disque -----------------------------------------------------

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

var globalMemoryStatusEx = windows.NewLazySystemDLL("kernel32.dll").NewProc("GlobalMemoryStatusEx")

func memory() (total, free uint64) {
	m := memoryStatusEx{Length: uint32(unsafe.Sizeof(memoryStatusEx{}))}
	globalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&m)))
	return m.TotalPhys, m.AvailPhys
}

func diskSpace() (total, free uint64) {
	p, _ := windows.UTF16PtrFromString(sysDrive() + `\`)
	var avail uint64
	windows.GetDiskFreeSpaceEx(p, &avail, &total, &free)
	return total, free
}

const gb = 1 << 30

// --- Raccourcis COM (une erreur devient une étape interrompue) -------------

func mustCall(d *ole.IDispatch, method string, args ...any) any {
	v, err := oleutil.CallMethod(d, method, args...)
	if err != nil {
		panic(fmt.Sprintf("%s : %v", method, err))
	}
	return v.Value()
}

func mustDispatch(d *ole.IDispatch, method string, args ...any) *ole.IDispatch {
	v, err := oleutil.CallMethod(d, method, args...)
	if err != nil {
		panic(fmt.Sprintf("%s : %v", method, err))
	}
	return v.ToIDispatch()
}

func mustProp(d *ole.IDispatch, name string, args ...any) *ole.VARIANT {
	v, err := oleutil.GetProperty(d, name, args...)
	if err != nil {
		panic(fmt.Sprintf("%s : %v", name, err))
	}
	return v
}

func callQuiet(d *ole.IDispatch, method string, args ...any) {
	oleutil.CallMethod(d, method, args...)
}

func newDispatch(progID string) *ole.IDispatch {
	unknown, err := oleutil.CreateObject(progID)
	if err != nil {
		panic(fmt.Sprintf("%s : %v", progID, err))
	}
	defer unknown.Release()
	d, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		panic(fmt.Sprintf("%s : %v", progID, err))
	}
	return d
}

func putProp(d *ole.IDispatch, name string, v any) {
	if _, err := oleutil.PutProperty(d, name, v); err != nil {
		panic(fmt.Sprintf("%s : %v", name, err))
	}
}
