# VPS deployment and recovery

## Design and limits

The supported host is Ubuntu 24.04 x86_64 with Docker Compose v2 plugin (the planned VPS has Compose v5) and an operator-supplied public IPv4 address. Stratdeck is a separate Compose project/network; only host port 8443 is published. The app listens on private container port 4178. Host Node 18, the existing cv-maker container, host ports 80/443, the global firewall, SSH daemon configuration, and other Docker resources are not changed.

Caddy terminates HTTPS using `tls internal` and a self-signed IP certificate. Browsers do not trust it by default and warn; arrange explicit CA trust for each client if desired. No domain is required. Never submit the password over plaintext HTTP or use the service on an untrusted network while ignoring certificate warnings. There is no automated firewall opening; the operator must permit inbound 8443 in their provider/network policy.

## One-time root bootstrap

Review `deploy/` and the root `Dockerfile` before running. From a trusted checkout on the VPS (or equivalent operator-provided transfer), supply the public IP and a file containing the deploy user's SSH public key:

```sh
sudo bash deploy/bootstrap.sh PUBLIC_IPV4 /path/to/deploy-user.pub
```

The script verifies Docker Compose and checks port 8443 and `/opt/stratdeck`/user namespace conflicts before creating anything. On conflict, stop and investigate; do not delete/reuse another owner's resources. It creates SSH-only user `stratdeck-deploy`, does not add it to `docker` or grant general sudo, and grants only no-argument sudo access to the root-owned deploy helper. It installs fixed root-owned compose/Caddy/Dockerfile/helper config. It does not alter SSH, daemon, firewall, or existing apps. Keep this configuration root-owned; never replace it with CI artifacts. Remove the bootstrap checkout when finished if it is not otherwise needed.

Privately transfer the local `.env` and `data/password.json` to `/opt/stratdeck/shared/` on the VPS. Never put them in GitHub secrets, a CI artifact, a Docker build, or deployment archive. Set `/opt/stratdeck/shared/.env` owner root:root and mode 0600. Put the password hash at `/opt/stratdeck/shared/data/password.json`, owner root:1000 mode 0640; create the data directory root-owned mode 0750. These files must contain valid application configuration and a valid scrypt password record. Use a unique session secret and a strong owner-known login password. The service needs writable `/data` for database/media at runtime; initialize data directory ownership to UID 1000 (Node image's `node` user), while keeping the password record root-owned/readable. Example after transfer:

```sh
sudo chown root:root /opt/stratdeck/shared/.env && sudo chmod 0600 /opt/stratdeck/shared/.env
sudo chown 1000:1000 /opt/stratdeck/shared/data && sudo chmod 0750 /opt/stratdeck/shared/data
sudo chown root:1000 /opt/stratdeck/shared/data/password.json && sudo chmod 0640 /opt/stratdeck/shared/data/password.json
```

Do not start the app before configuring these inputs. Verify the target operator has verified the actual host key; record the exact `[host]:port` SSH known-hosts line independently. Do not populate `VPS_KNOWN_HOSTS` from an unauthenticated `ssh-keyscan` result alone.

## CI and optional automated deployment

`.github/workflows/ci.yml` runs `npm ci`, tests, typecheck, lint, build, and packages those exact built outputs. Actions are pinned to full commit SHAs. A deploy can run only after a successful push to `main` (never a pull request/fork), inside GitHub's `production` environment, with repository variable `DEPLOY_ENABLED` exactly `true`. It uses the already-built CI artifact, strict pinned SSH host keys, and a fixed remote helper invocation. Deploys serialize and are not canceled mid-run.

Create a protected GitHub production environment and set secrets `VPS_HOST`, `VPS_USER` (`stratdeck-deploy`), `VPS_PORT`, `VPS_SSH_KEY`, and `VPS_KNOWN_HOSTS`. The latter is the independently verified known-hosts entry for the selected host and port. Use a dedicated key authorized for `stratdeck-deploy`, not root. Do not store app `.env` or password data in CI. Keep `DEPLOY_ENABLED` absent/false until bootstrap, private file transfer, external network policy, TLS caveat, and reachability are confirmed. You can disable automatic deployments at any time by unsetting or changing the variable.

## Artifact and deploy behavior

CI release archive contains only `package.json`, `package-lock.json`, `config/categories.txt`, `dist/`, and `site-dist/`. Root helper serializes with `flock`, snapshots the upload into root-owned storage, rejects path traversal, links, non-regular members, and extra top-level content, extracts a release, and builds using fixed root-owned Dockerfile/config. Docker build executes the reviewed application dependencies/build output; granting a writer permission to merge trusted changes to `main` grants authority to run code as the app's Node user with access to persistent data and environment credentials. Keep `main` protected and review changes. CI cannot replace the root deployment helper or fixed configuration.

The runtime is Node 24.9.0 Bookworm slim, recorded as an exact patch tag in the Dockerfile; the tag is not digest-pinned, so an upstream tag/image retarget is a residual supply-chain risk. Native production dependencies install within the Linux image. App container runs as `node`, has no privileged mode, Docker socket, host network, or added Linux capabilities; Caddy only adds `NET_BIND_SERVICE` for 8443. Docker image supply chain includes the upstream Caddy `2.10.2-alpine` tag, likewise not digest-pinned.

After build, deployment starts the new app and Caddy, polls `/healthz` and confirms anonymous `/api/library` returns 401. Failure restores the previous release if known; first-deploy failure stops the project and returns nonzero. On success it updates `/opt/stratdeck/config/current-release`. Previous release images/files remain available; no prune or data cleanup runs. Data and Caddy state persist separately under `/opt/stratdeck/shared/`.

## Manual rollback and operations

Automatic health rollback is best-effort and does not guarantee availability if Docker/host itself fails. To roll back to the recorded previous release, as root:

```sh
cd /opt/stratdeck/config
previous=$(find /opt/stratdeck/releases -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | tail -n 2 | head -n 1)
test -n "$previous"
RELEASE_ID="$previous" docker compose --project-name stratdeck --env-file /opt/stratdeck/config/public.env -f /opt/stratdeck/config/compose.yaml up -d app caddy
```

Prefer selecting a specific prior release by directory name after inspecting `/opt/stratdeck/releases/`; the example ordering is not authoritative. To inspect status/logs, use `docker compose --project-name stratdeck --env-file /opt/stratdeck/config/public.env -f /opt/stratdeck/config/compose.yaml ps` and `logs --tail=100`. Never run `docker system prune` as part of Stratdeck recovery. Back up `/opt/stratdeck/shared/data` and Caddy's internal CA state (`caddy-data`) together under your protected backup policy. Restore database/media as a consistent pair. Password rotation is performed by replacing the scrypt JSON privately and restarting the app; sessions are invalidated by password version change.

## Verified deployment

The initial deployment was verified on 2026-10-03: GitHub Actions built and deployed the tested release; both Stratdeck containers are running, the app is healthy, and HTTPS works with the internal CA. Discord sync imported two selected categories and 19 strategies. Protected session, library, status, search, strategy and media endpoints were checked using a temporary administrator-created QA session, then that session was revoked. A real browser loaded the walkthrough and image without horizontal overflow. The existing port-80 website remained healthy and returned HTTP 200.

The owner's password record was preserved; the example password from the original specification is not assumed to be the actual password. Browser trust still requires accepting or installing the internal CA. Backup restoration and host-failure recovery have not been simulated.
