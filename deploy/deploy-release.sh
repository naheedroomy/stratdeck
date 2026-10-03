#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
exec 9>/run/lock/stratdeck-deploy.lock
flock -n 9 || { echo 'Another Stratdeck deployment is running.' >&2; exit 1; }
ROOT=/opt/stratdeck
INCOMING=$ROOT/incoming/release.tar
COMPOSE=$ROOT/config/compose.yaml
source "$ROOT/config/public.env"
[[ -s $INCOMING ]] || { echo 'No release archive found.' >&2; exit 1; }
command -v docker >/dev/null && docker compose version >/dev/null || { echo 'Docker Compose unavailable.' >&2; exit 1; }
# Copy once into a root-only snapshot before validating or building.
SNAP=$(mktemp "$ROOT/releases/.upload.XXXXXX.tar")
trap 'rm -f "$SNAP"' EXIT
install -o root -g root -m 0600 "$INCOMING" "$SNAP"
python3 "$ROOT/config/validate_release.py" "$SNAP"
RELEASE_ID=$(date -u +%Y%m%d%H%M%S)-$(sha256sum "$SNAP" | cut -c1-12)
STAGE=$ROOT/releases/$RELEASE_ID
mkdir -m 0700 "$STAGE"
python3 - "$SNAP" "$STAGE" <<'PY'
import sys,tarfile
with tarfile.open(sys.argv[1],'r:*') as t:
    t.extractall(sys.argv[2],filter='data')
PY
chown -R root:root "$STAGE"
# The archive contains files only; extraction under umask 077 creates
# root-only parent directories. Make runtime content traversable by USER node,
# while keeping the outer staging directory inaccessible to the upload user.
find "$STAGE" -mindepth 1 -type d -exec chmod 0755 {} +
find "$STAGE" -type f -exec chmod 0644 {} +
docker build --pull -f "$ROOT/config/Dockerfile" -t "stratdeck:$RELEASE_ID" "$STAGE"
PREVIOUS=$(cat "$ROOT/config/current-release" 2>/dev/null || true)
export RELEASE_ID PUBLIC_IP
compose(){ docker compose --project-name stratdeck --env-file "$ROOT/config/public.env" -f "$COMPOSE" "$@"; }
if ! compose up -d app caddy; then
  echo 'Compose activation failed; restoring previous release.' >&2
  if [[ -n $PREVIOUS ]]; then export RELEASE_ID=$PREVIOUS; compose up -d app caddy || true
  else compose down || true; fi
  exit 1
fi
healthy=0
for _ in $(seq 1 36); do
  if docker exec "$(compose ps -q app)" node -e "Promise.all([fetch('http://127.0.0.1:4178/healthz').then(r=>{if(!r.ok)throw Error('health')}),fetch('http://127.0.0.1:4178/api/library').then(r=>{if(r.status!==401)throw Error('auth')})]).then(()=>process.exit(0)).catch(()=>process.exit(1))"; then
    if docker exec "$(compose ps -q app)" node --input-type=module -e "import {loadPassword} from './dist/src/auth/password.js'; if(!await loadPassword(process.env.PASSWORD_FILE))process.exit(1)" &&
       curl --silent --show-error --fail --max-time 5 --cacert "$ROOT/shared/caddy-data/caddy/pki/authorities/local/root.crt" "https://$PUBLIC_IP:8443/healthz" >/dev/null &&
       [[ $(curl --silent --show-error --max-time 5 --cacert "$ROOT/shared/caddy-data/caddy/pki/authorities/local/root.crt" -o /dev/null -w '%{http_code}' "https://$PUBLIC_IP:8443/api/library") == 401 ]]; then healthy=1; break; fi
  fi
  sleep 5
done
if [[ $healthy -ne 1 ]]; then
  echo 'New release health checks failed; restoring previous release.' >&2
  if [[ -n $PREVIOUS ]]; then export RELEASE_ID=$PREVIOUS; compose up -d app caddy || true
  else compose down || true; fi
  exit 1
fi
printf '%s\n' "$RELEASE_ID" > "$ROOT/config/current-release.new"
mv -f "$ROOT/config/current-release.new" "$ROOT/config/current-release"
rm -f "$INCOMING"
printf 'Deployed release %s (previous %s).\n' "$RELEASE_ID" "${PREVIOUS:-none}"
