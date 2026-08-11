#!/usr/bin/env bash
# Usage:
#   1) Bump version in package.json (e.g. 1.0.1)
#   2) npm run build
#   3) ./scripts/publish-to-vps.sh user@vps:/var/www/updates
#
# Optional release notes:
#   RELEASE_NOTES="Bug fix + tray icons" ./scripts/publish-to-vps.sh user@vps:/var/www/updates

set -euo pipefail
DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  echo "Usage: $0 user@host:/path/to/updates"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REL="$ROOT/release"
if [[ ! -d "$REL" ]]; then
  echo "release/ not found — run npm run build first"
  exit 1
fi

# Prefer NSIS setup exe + latest.yml + blockmap
shopt -s nullglob
EXE=( "$REL"/*Setup*.exe "$REL"/*.exe )
YML=( "$REL"/latest.yml )
MAP=( "$REL"/*.blockmap )

if [[ ! -f "${YML[0]:-}" ]]; then
  echo "latest.yml missing in release/ — electron-builder did not publish metadata"
  echo "Ensure electron-builder.yml has publish.provider: generic"
  exit 1
fi

# Inject release notes into latest.yml if provided
if [[ -n "${RELEASE_NOTES:-}" ]]; then
  # simple append/replace releaseNotes field
  if grep -q '^releaseNotes:' "${YML[0]}"; then
    # leave as-is if already present
    true
  else
    # YAML block scalar
    {
      cat "${YML[0]}"
      echo "releaseNotes: |"
      echo "$RELEASE_NOTES" | sed 's/^/  /'
    } > "${YML[0]}.tmp"
    mv "${YML[0]}.tmp" "${YML[0]}"
  fi
fi

echo "Uploading to $DEST ..."
rsync -avz --progress \
  "${YML[0]}" \
  ${EXE[0]:+"${EXE[0]}"} \
  ${MAP[0]:+"${MAP[0]}"} \
  "$DEST/"

echo "Done. Clients will see the new version on next check."
echo "Public URL should serve:  https://YOUR_DOMAIN/updates/latest.yml"
