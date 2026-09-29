#!/usr/bin/env bash
# Replaces the code in your existing GitHub repo with City P&L Control Center,
# keeping the Firebase web config found in the old code. Run ON YOUR COMPUTER:
#
#   cd city-pl
#   bash publish.sh https://github.com/<owner>/<repo>.git
#
# Uses your normal git login. No token is stored anywhere.
# The old code is kept as the git tag "backup-before-city-pl" (nothing is lost).
set -euo pipefail

REPO="${1:?Usage: bash publish.sh https://github.com/<owner>/<repo>.git}"
SRC="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
echo "→ Cloning $REPO"
git clone --quiet "$REPO" "$WORK/repo"
cd "$WORK/repo"

# 1. Find Firebase web config in the old code
find_val() {
  grep -rhoE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
    "[\"']?$1[\"']?[[:space:]]*[:=][[:space:]]*[\"'][^\"']+[\"']" . 2>/dev/null \
    | head -1 | sed -E "s/.*[:=][[:space:]]*[\"']([^\"']+)[\"'].*/\1/" || true
}
API_KEY=$(find_val apiKey); AUTH_DOMAIN=$(find_val authDomain); PROJECT_ID=$(find_val projectId)
BUCKET=$(find_val storageBucket); SENDER=$(find_val messagingSenderId); APP_ID=$(find_val appId)
DB_URL=$(find_val databaseURL)

# 2. Reuse the existing service-account secret name if the old workflows had one
SA_SECRET=$(grep -rhoE 'secrets\.FIREBASE_SERVICE_ACCOUNT[A-Z0-9_]*' .github 2>/dev/null | head -1 | sed 's/secrets\.//' || true)
SA_SECRET=${SA_SECRET:-FIREBASE_SERVICE_ACCOUNT}

echo
echo "Found in existing code:"
echo "  projectId          $PROJECT_ID"
echo "  authDomain         $AUTH_DOMAIN"
echo "  storageBucket      $BUCKET"
echo "  messagingSenderId  $SENDER"
echo "  appId              $APP_ID"
echo "  apiKey             ${API_KEY:0:8}…"
echo "  deploy secret      $SA_SECRET"
[ -n "$DB_URL" ] && echo "  NOTE: old code used Realtime Database ($DB_URL). The new app uses Firestore in the same project."
if [ -z "$API_KEY" ] || [ -z "$PROJECT_ID" ] || [ -z "$APP_ID" ]; then
  echo "✗ Could not find a complete Firebase config. Nothing was changed."; exit 1
fi
echo
read -r -p "Replace ALL code in this repo with City P&L and push to main? (y/N) " ok
[ "$ok" = "y" ] || [ "$ok" = "Y" ] || { echo "Cancelled. Nothing was changed."; exit 0; }

# 3. Keep a backup of the old code
git tag -f backup-before-city-pl
git push --quiet -f origin backup-before-city-pl

# 4. Replace the code
git rm -rq --ignore-unmatch . >/dev/null
( cd "$SRC" && tar --exclude=node_modules --exclude=dist --exclude=dist-preview --exclude=functions/lib \
    --exclude=.env.local --exclude=publish.sh --exclude="*.tsbuildinfo" -cf - . ) | tar -xf -

cat > .env.production <<EOF
# Firebase web config (public by design; access is controlled by firestore.rules / storage.rules)
VITE_FIREBASE_API_KEY=$API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$SENDER
VITE_FIREBASE_APP_ID=$APP_ID
EOF
printf '{ "projects": { "default": "%s" } }\n' "$PROJECT_ID" > .firebaserc
perl -pi -e "s/__SA_SECRET__/$SA_SECRET/g; s/__PROJECT_ID__/$PROJECT_ID/g" .github/workflows/deploy.yml

git add -A
git commit -qm "Replace with City P&L Control Center (Phase 1)"
git push --quiet origin HEAD:main
echo
echo "✓ Pushed to main. GitHub Actions is now deploying: ${REPO%.git}/actions"
echo "  Before it can succeed, make sure in GitHub → Settings → Secrets → Actions the secret"
echo "  '$SA_SECRET' exists (service account JSON of project $PROJECT_ID)."
echo "  Old code: tag 'backup-before-city-pl'."
rm -rf "$WORK"
