// Dossiers et pages : arbre, déplacements, ordre. Fonctions pures, testées hors navigateur.

/** Dossiers enfants d'un dossier (null = racine), triés. */
export function childFolders(folders, parentId = null) {
  return folders.filter((f) => (f.parentId ?? null) === parentId).sort(byOrder);
}

/** Pages d'un dossier (null = sans dossier) : épinglées d'abord, puis les plus récentes. */
export function pagesIn(pages, folderId = null) {
  return pages
    .filter((p) => (p.folderId ?? null) === folderId)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt));
}

export function byOrder(a, b) {
  return (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'fr');
}

/** Ids du dossier et de tous ses sous-dossiers. */
export function descendantIds(folders, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Un dossier ne peut pas aller dans lui-même ni dans un de ses descendants. */
export function canMoveFolder(folders, id, targetParentId) {
  if (targetParentId === null || targetParentId === undefined) return true;
  return !descendantIds(folders, id).has(targetParentId);
}

/** Chemin de la racine jusqu'au dossier (pour le fil d'Ariane). */
export function folderPath(folders, id) {
  const path = [];
  const seen = new Set();
  let cur = folders.find((f) => f.id === id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = folders.find((f) => f.id === cur.parentId);
  }
  return path;
}

/** Nombre de pages dans un dossier et ses sous-dossiers. */
export function deepCount(folders, pages, id) {
  const ids = descendantIds(folders, id);
  return pages.filter((p) => p.folderId && ids.has(p.folderId)).length;
}

/** Liste à plat pour un sélecteur « Déplacer vers… » : [{ folder, depth }]. */
export function flatTree(folders, parentId = null, depth = 0, out = []) {
  for (const f of childFolders(folders, parentId)) {
    out.push({ folder: f, depth });
    flatTree(folders, f.id, depth + 1, out);
  }
  return out;
}

export function nextOrder(items) {
  return items.reduce((max, i) => Math.max(max, i.order ?? 0), 0) + 1;
}
