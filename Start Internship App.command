#!/bin/sh
cd "$(dirname "$0")" || exit 1
node scripts/launch-local-app.js --no-open || exit 1
open "http://127.0.0.1:${PORT:-4318}/"
