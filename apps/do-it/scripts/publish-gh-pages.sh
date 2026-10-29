#!/usr/bin/env bash
# Publie Do It et Encré sur GitHub Pages, dans le dossier do-it/ de la branche gh-pages.
# Le reste de la branche (les autres applis du site) n'est pas touché.
# Adresse : https://pierrernrd04-ai.github.io/Vous-/do-it/ (Encré : …/do-it/encre/)
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(git -C "$APP_DIR" rev-parse --show-toplevel)"
SOURCE_REF="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
WORKTREE="$(mktemp -d)"

git -C "$REPO_DIR" fetch -q origin gh-pages
git -C "$REPO_DIR" worktree add -q --detach "$WORKTREE" origin/gh-pages
trap 'git -C "$REPO_DIR" worktree remove --force "$WORKTREE"' EXIT

rm -rf "$WORKTREE/do-it"
cp -R "$APP_DIR/public" "$WORKTREE/do-it"

cd "$WORKTREE"
git add -A do-it
if git diff --cached --quiet; then
  echo "Rien de nouveau à publier."
  exit 0
fi
git commit -q -m "Do It et Encré : publication depuis ${SOURCE_REF}"
git push -q origin HEAD:gh-pages
echo "Publié : https://pierrernrd04-ai.github.io/Vous-/do-it/ et https://pierrernrd04-ai.github.io/Vous-/do-it/encre/"
