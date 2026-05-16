#!/usr/bin/env bash
# Wrapper para Task Scheduler de Windows.
#
# Hace tres cosas que el .sh principal asume ya estan hechas:
#   1) cd al root del repo (Task Scheduler corre con cwd vacio o impredecible)
#   2) source .env.backup
#   3) agregar AWS CLI v2 al PATH (Task Scheduler usa el PATH del Sistema,
#      que SI tiene aws.exe despues del install via winget — pero defensivo)
#
# Loguea todo a logs/backup.log con timestamp. Rota el log a >5 MB.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

LOG_DIR="${REPO_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup.log"
mkdir -p "$LOG_DIR"

# Rotacion simple del log si supera 5 MB
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 5242880 ]; then
  mv "$LOG_FILE" "${LOG_FILE}.1"
fi

{
  echo ""
  echo "================================================================"
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') — Iniciando backup-pb-to-r2"
  echo "================================================================"

  if [ ! -f "$REPO_DIR/.env.backup" ]; then
    echo "✗ Falta .env.backup en $REPO_DIR"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1091
  source "$REPO_DIR/.env.backup"
  set +a

  export PATH="/c/Program Files/Amazon/AWSCLIV2:$PATH"

  bash "$REPO_DIR/scripts/backup-pb-to-r2.sh"
  RC=$?

  echo "=== $(date '+%Y-%m-%d %H:%M:%S') — Fin (rc=$RC)"
  exit $RC
} >> "$LOG_FILE" 2>&1
