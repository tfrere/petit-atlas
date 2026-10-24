#!/usr/bin/env bash
# Publie le jeu sur un Space Hugging Face statique.
# Usage : HF_TOKEN=hf_xxx scripts/deploy-hf.sh <utilisateur-ou-org>/<nom-du-space>
set -euo pipefail

SPACE="${1:?Usage : scripts/deploy-hf.sh <utilisateur-ou-org>/<nom-du-space>}"
cd "$(dirname "$0")/.."

npm run build
rm -rf .hf-space
mkdir .hf-space
cp -R dist/. .hf-space/
cp hf/README.md .hf-space/README.md

if ! command -v hf >/dev/null 2>&1; then
  pip install --quiet --user "huggingface_hub[cli]"
  export PATH="$HOME/.local/bin:$PATH"
fi

hf repo create "$SPACE" --repo-type space --space_sdk static --exist-ok
hf upload "$SPACE" .hf-space . --repo-type space --commit-message "Déploiement du Petit Atlas"
echo "https://huggingface.co/spaces/$SPACE"
