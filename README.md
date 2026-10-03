# Stratdeck

Stratdeck is a private, password-protected tactical strategy reader synchronized from a selected Discord server. Discord remains the authoring source; only configured categories are synchronized. The application runs on Node.js 24. See [PRODUCT.md](PRODUCT.md), [docs/API.md](docs/API.md), and [docs/SETUP.md](docs/SETUP.md).

## Local development

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run start:fixture
```

The fixture service listens on `127.0.0.1:4179`, uses synthetic content, and requires no credentials. Configure a real private instance using `.env.example` and the instructions in `docs/SETUP.md`. Never commit credentials, password records, Discord exports, database files, or strategy media.

## VPS deployment

Deployment targets Ubuntu 24.04 x86_64 with Docker Compose, without changing host Node.js, firewall, existing Docker applications, or ports 80/443. Stratdeck uses an isolated Docker Compose project, persistent private data, backend port 4178 on its private network, and HTTPS on host port 8443. Caddy issues an internal/self-signed IP certificate, so browsers will show a certificate warning unless the operator installs/trusts its CA. Do not enter the password over plain HTTP or bypass TLS warnings on untrusted networks.

Read the full [deployment and recovery runbook](docs/DEPLOYMENT.md) before bootstrapping. Parent/operator provisions the VPS config and transfers the environment and password record privately. CI deploy is disabled by default and only runs on a successful push to `main` after CI when repository variable `DEPLOY_ENABLED=true`.

## License and origin

MIT; see [LICENSE](LICENSE) and [NOTICE](NOTICE). Stratdeck was extracted from the Papermorph workspace; no upstream examples or private exports are distributed.
