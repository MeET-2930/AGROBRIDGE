#!/usr/bin/env bash
# demo-reset.sh - one command to get the mandi back to a clean, ready state.
#   bash demo-reset.sh          wipe bookings/queues/auctions/notifications, keep every user
#   bash demo-reset.sh --users  also delete all users except the 8 test accounts, then re-create them
# Centres (5 mandis) are re-seeded every time (harmless; overwrites the same 5 docs).
set -e
[ -f seedCentres.js ] && [ -f seedTestAccounts.js ] && [ -f resetTestData.js ] \
  || { echo "ERROR: run from ~/projects/AGROBRIDGE after install39."; exit 1; }
echo "==> 1/3 mandis";          node seedCentres.js | tail -1
echo "==> 2/3 clearing";        node resetTestData.js "$@" | grep -v "^Reset done"
echo "==> 3/3 test accounts";   node seedTestAccounts.js | tail -1
echo ""
echo "  READY. Log out + back in on the phone and in the browser tabs, then run the simulation."
echo "  Officers 9000000001..05  Traders 9100000001..03  OTP 1234  Farmer: register in app."
