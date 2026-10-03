#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo 'Run as root.' >&2; exit 1; fi
if [[ $# -ne 2 ]]; then echo "Usage: $0 PUBLIC_IPV4 SSH_PUBLIC_KEY_FILE" >&2; exit 2; fi
public_ip=$1
key_file=$2
[[ $public_ip =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo 'PUBLIC_IPV4 must be a dotted IPv4 address.' >&2; exit 2; }
python3 - "$public_ip" <<'PY'
import ipaddress,sys
ipaddress.IPv4Address(sys.argv[1])
PY
[[ -r $key_file ]] || { echo 'SSH public key file is not readable.' >&2; exit 1; }
command -v docker >/dev/null && docker compose version >/dev/null && docker info >/dev/null || { echo 'A running Docker Engine with the Compose plugin is required.' >&2; exit 1; }
command -v ss >/dev/null || { echo 'The ss utility is required to verify host port availability.' >&2; exit 1; }
if ss -H -ltn 'sport = :8443' | grep -q . || docker ps --format '{{.Ports}}' | grep -Eq '(^|[, ])(0\.0\.0\.0:|\[::\]:|127\.0\.0\.1:)?8443->'; then echo 'Host port 8443 is already in use; refusing bootstrap.' >&2; exit 1; fi
if getent passwd stratdeck-deploy >/dev/null || getent group stratdeck-deploy >/dev/null; then echo 'stratdeck-deploy namespace already exists; refusing to assume ownership.' >&2; exit 1; fi
if [[ -e /opt/stratdeck || -e /etc/sudoers.d/stratdeck-deploy ]]; then echo 'Stratdeck filesystem/sudoers namespace already exists; refusing to assume ownership.' >&2; exit 1; fi
if docker ps -aq --filter label=com.docker.compose.project=stratdeck | grep -q .; then echo 'A Docker Compose project named stratdeck already exists; refusing to assume ownership.' >&2; exit 1; fi
if docker network inspect stratdeck-private >/dev/null 2>&1; then echo 'Docker network stratdeck-private already exists; refusing to assume ownership.' >&2; exit 1; fi
install -d -o root -g root -m 0755 /opt/stratdeck/config /opt/stratdeck/shared/data /opt/stratdeck/shared/caddy-data /opt/stratdeck/shared/caddy-config /opt/stratdeck/releases
install -d -o root -g root -m 0755 /opt/stratdeck/incoming
useradd --create-home --shell /bin/bash stratdeck-deploy
chown stratdeck-deploy:stratdeck-deploy /opt/stratdeck/incoming
chmod 0730 /opt/stratdeck/incoming
install -d -o stratdeck-deploy -g stratdeck-deploy -m 0700 /home/stratdeck-deploy/.ssh
install -o stratdeck-deploy -g stratdeck-deploy -m 0600 "$key_file" /home/stratdeck-deploy/.ssh/authorized_keys
install -o root -g root -m 0644 deploy/compose.yaml /opt/stratdeck/config/compose.yaml
install -o root -g root -m 0644 deploy/Caddyfile /opt/stratdeck/config/Caddyfile
install -o root -g root -m 0644 Dockerfile /opt/stratdeck/config/Dockerfile
install -o root -g root -m 0644 deploy/validate_release.py /opt/stratdeck/config/validate_release.py
install -o root -g root -m 0755 deploy/deploy-release.sh /opt/stratdeck/config/deploy-release
printf 'PUBLIC_IP=%s\n' "$public_ip" > /opt/stratdeck/config/public.env
chown root:root /opt/stratdeck/config/public.env && chmod 0644 /opt/stratdeck/config/public.env
install -o root -g root -m 0440 deploy/stratdeck-deploy.sudoers /etc/sudoers.d/stratdeck-deploy
visudo -cf /etc/sudoers.d/stratdeck-deploy
printf 'Bootstrap complete. Next transfer .env and data/password.json privately to /opt/stratdeck/shared/ and ensure ownership root:root and mode 0600 for .env; password.json must be root:1000 mode 0640, and shared/data UID:GID 1000:1000 mode 0750.\n'
