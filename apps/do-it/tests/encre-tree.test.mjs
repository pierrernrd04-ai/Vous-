import test from 'node:test';
import assert from 'node:assert/strict';
import { childFolders, pagesIn, descendantIds, canMoveFolder, folderPath, deepCount, flatTree, nextOrder } from '../public/encre/js/tree.js';

const folders = [
  { id: 'a', name: 'Projets', parentId: null, order: 2 },
  { id: 'b', name: 'Idées', parentId: null, order: 1 },
  { id: 'a1', name: 'Sport', parentId: 'a', order: 1 },
  { id: 'a1x', name: 'Marathon', parentId: 'a1', order: 1 },
];
const pages = [
  { id: 'p1', folderId: 'a1x', updatedAt: '2026-10-01', pinned: false },
  { id: 'p2', folderId: 'a', updatedAt: '2026-10-03', pinned: false },
  { id: 'p3', folderId: null, updatedAt: '2026-10-02', pinned: false },
  { id: 'p4', folderId: null, updatedAt: '2026-09-01', pinned: true },
];

test('dossiers enfants triés par ordre', () => {
  assert.deepEqual(childFolders(folders).map((f) => f.id), ['b', 'a']);
  assert.deepEqual(childFolders(folders, 'a').map((f) => f.id), ['a1']);
});

test('pages d’un dossier : épinglées d’abord puis récentes', () => {
  assert.deepEqual(pagesIn(pages, null).map((p) => p.id), ['p4', 'p3']);
});

test('descendants, comptage profond et chemin', () => {
  assert.deepEqual([...descendantIds(folders, 'a')].sort(), ['a', 'a1', 'a1x']);
  assert.equal(deepCount(folders, pages, 'a'), 2);
  assert.deepEqual(folderPath(folders, 'a1x').map((f) => f.name), ['Projets', 'Sport', 'Marathon']);
});

test('un dossier ne peut pas aller dans son propre sous-dossier', () => {
  assert.equal(canMoveFolder(folders, 'a', 'a1x'), false);
  assert.equal(canMoveFolder(folders, 'a', 'a'), false);
  assert.equal(canMoveFolder(folders, 'a1', 'b'), true);
  assert.equal(canMoveFolder(folders, 'a1', null), true);
});

test('liste à plat avec profondeur et ordre suivant', () => {
  assert.deepEqual(flatTree(folders).map(({ folder, depth }) => `${folder.id}:${depth}`), ['b:0', 'a:0', 'a1:1', 'a1x:2']);
  assert.equal(nextOrder(childFolders(folders)), 3);
  assert.equal(nextOrder([]), 1);
});

test('chemin protégé contre une boucle', () => {
  const loop = [{ id: 'x', name: 'X', parentId: 'y' }, { id: 'y', name: 'Y', parentId: 'x' }];
  assert.equal(folderPath(loop, 'x').length, 2);
});
