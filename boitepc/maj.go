//go:build windows

package main

import (
	"os/exec"
	"strings"
)

func majPlan(req RunRequest) toolPlan {
	steps := []step{
		{"Définitions de virus", updateSignatures},
		{"Windows Update (système et pilotes)", windowsUpdate},
		{"Applications", upgradeApps},
	}
	if opt(req, "majAuto", true) {
		steps = append(steps, step{"Mises à jour automatiques", scheduleApps})
	}
	return toolPlan{"MajPC", steps}
}

func updateSignatures(j *Job) {
	if _, code := runHidden(mpCmdRun(), "-SignatureUpdate"); code == 0 {
		j.Ok("Antivirus à jour")
	} else {
		j.Skip("Mise à jour de l'antivirus impossible (pas d'Internet, ou autre antivirus installé)")
	}
}

func windowsUpdate(j *Job) {
	j.Info("Recherche des mises à jour : 2 à 10 minutes sur ce PC.")
	session := newDispatch("Microsoft.Update.Session")
	defer session.Release()
	searcher := mustDispatch(session, "CreateUpdateSearcher")
	defer searcher.Release()
	result := mustDispatch(searcher, "Search", "IsInstalled=0 and IsHidden=0")
	defer result.Release()
	updates := mustProp(result, "Updates").ToIDispatch()
	defer updates.Release()

	todo := newDispatch("Microsoft.Update.UpdateColl")
	defer todo.Release()
	count := int(asInt(mustProp(updates, "Count").Value()))
	selected := 0
	for i := 0; i < count; i++ {
		u := mustProp(updates, "Item", i).ToIDispatch()
		// Les mises à jour « facultatives » (aperçus, pilotes optionnels) sont laissées de côté.
		if asBool(mustProp(u, "BrowseOnly").Value()) {
			u.Release()
			continue
		}
		if !asBool(mustProp(u, "EulaAccepted").Value()) {
			callQuiet(u, "AcceptEula")
		}
		j.Info("%s", asString(mustProp(u, "Title").Value()))
		mustCall(todo, "Add", u)
		selected++
		u.Release()
	}
	if selected == 0 {
		j.Ok("Windows est déjà à jour")
		return
	}

	j.Info("Téléchargement de %d mise(s) à jour…", selected)
	dl := mustDispatch(session, "CreateUpdateDownloader")
	defer dl.Release()
	putProp(dl, "Updates", todo)
	mustCall(dl, "Download")

	j.Info("Installation…")
	inst := mustDispatch(session, "CreateUpdateInstaller")
	defer inst.Release()
	putProp(inst, "Updates", todo)
	res := mustDispatch(inst, "Install")
	defer res.Release()
	if asBool(mustProp(res, "RebootRequired").Value()) {
		j.NeedReboot()
		j.Info("Un redémarrage est nécessaire pour finir l'installation.")
	}
	// ResultCode : 2 = réussi, 3 = réussi avec erreurs.
	switch asInt(mustProp(res, "ResultCode").Value()) {
	case 2:
		j.Ok("%d mise(s) à jour Windows installée(s)", selected)
	case 3:
		j.Skip("Mises à jour installées, sauf certaines : Windows les retentera")
	default:
		j.Bad("L'installation a échoué : relancez MajPC après un redémarrage")
	}
}

func wingetPath() string {
	p, err := exec.LookPath("winget.exe")
	if err != nil {
		return ""
	}
	return p
}

func upgradeApps(j *Job) {
	w := wingetPath()
	if w == "" {
		j.Skip("Outil winget absent : ouvrez le Microsoft Store, cherchez « Programme d'installation d'application » et installez-le")
		return
	}
	j.Info("Mise à jour de Chrome, Firefox, VLC, Zoom, 7-Zip… : 5 à 20 minutes.")
	runHidden(w, "source", "update", "--disable-interactivity")
	out, code := runHidden(w, "upgrade", "--all", "--silent", "--accept-source-agreements",
		"--accept-package-agreements", "--disable-interactivity")
	switch {
	case code == 0:
		j.Ok("Applications à jour")
	case strings.Contains(out, "No installed package") || strings.Contains(out, "Aucun"):
		j.Ok("Toutes les applications étaient déjà à jour")
	default:
		j.Skip("Certaines applis n'ont pas pu être mises à jour (fermez-les et relancez MajPC)")
	}
	j.Info("Applis du Microsoft Store : ouvrez le Store > Bibliothèque > « Obtenir les mises à jour ».")
}

func scheduleApps(j *Job) {
	if wingetPath() == "" {
		return
	}
	exe, err := installSelf()
	if err == nil {
		err = createTask(taskApps, exe, "--maj-applis", "Wednesday", "13:00", false)
	}
	if err != nil {
		j.Skip("Mise à jour automatique non programmée (%v)", err)
		return
	}
	j.Ok("Applis mises à jour automatiquement chaque mercredi")
}
