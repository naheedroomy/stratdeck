# Verification

Local checks cover unit and integration behavior against synthetic fixture data. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; validate the bundled fixture with `npm run validate-export -- skills/strategy-playbook/fixtures/export.json`.

The production workflow packages the tested build and has an optional gated deploy job. Neither successful local checks nor CI establish that a live VPS, firewall, SSH host key, browser certificate trust, external Discord permissions, backups, or a production restore work. Those must be checked by the operator; see `DEPLOYMENT.md`. No live server access or production deployment is claimed here.
