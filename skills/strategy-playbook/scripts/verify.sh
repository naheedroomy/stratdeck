#!/bin/sh
set -eu
cd "$(dirname "$0")/../../.."
npm run validate-export -- skills/strategy-playbook/fixtures/export.json
npm test
npm run typecheck
npm run lint
npm run build
