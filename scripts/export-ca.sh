#!/bin/bash
# Export Caddy's internal CA root certificate for Android PWA installation.
# Usage: ./scripts/export-ca.sh [output_path]

set -e

OUTPUT="${1:-./caddy-root-ca.crt}"

docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt "$OUTPUT"

echo ""
echo "CA certificate exported to: $OUTPUT"
echo ""
echo "Install on Android:"
echo "  1. Transfer $OUTPUT to the device (ADB, email, or USB)"
echo "  2. Settings > Security > Encryption & credentials > Install a certificate > CA certificate"
echo "  3. Select the file and confirm"
echo ""
echo "After installing, Chrome will trust this server's HTTPS and enable PWA installation."
