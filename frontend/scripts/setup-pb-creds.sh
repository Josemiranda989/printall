#!/usr/bin/env bash
# Guarda credenciales de superuser de PocketBase en macOS Keychain.
# Solo se ejecuta una vez — después seed-products.mjs las lee automáticamente.
# Para borrar: security delete-generic-password -s printall-pb-admin

set -e

if [[ "$(uname)" != "Darwin" ]]; then
  echo "✗ Este script solo funciona en macOS (usa Keychain)."
  exit 1
fi

echo "🔐 Setup de credenciales PocketBase (Print All admin)"
echo "   Service en Keychain: printall-pb-admin"
echo

read -p "PocketBase admin email: " PB_EMAIL
if [[ -z "$PB_EMAIL" ]]; then
  echo "✗ Email vacío"
  exit 1
fi

read -sp "PocketBase admin password: " PB_PASSWORD
echo
if [[ -z "$PB_PASSWORD" ]]; then
  echo "✗ Password vacío"
  exit 1
fi

security add-generic-password \
  -a "$PB_EMAIL" \
  -s "printall-pb-admin" \
  -w "$PB_PASSWORD" \
  -U

unset PB_PASSWORD

echo
echo "✓ Credenciales guardadas en macOS Keychain"
echo
echo "Ahora podés correr el seed sin pasar credenciales:"
echo "  node scripts/seed-products.mjs --file=/tmp/productos.json"
echo
echo "Para borrar las creds del Keychain:"
echo "  security delete-generic-password -s printall-pb-admin"
