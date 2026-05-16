#!/usr/bin/env bash
# Backup de pb_data a Cloudflare R2.
#
# Diseñado para correrse desde cron del host. Genera un zip via la API de
# PocketBase (no hace falta parar el contenedor) y lo sube a R2 usando
# AWS CLI con endpoint custom.
#
# Variables de entorno requeridas:
#   POCKETBASE_URL            URL del PB (ej: http://localhost:8090)
#   PB_ADMIN_EMAIL            email superuser
#   PB_ADMIN_PASSWORD         password superuser
#   R2_ACCOUNT_ID             id de cuenta Cloudflare
#   R2_ACCESS_KEY_ID          R2 token access key
#   R2_SECRET_ACCESS_KEY      R2 token secret
#   R2_BUCKET                 nombre del bucket (ej: printall-backups)
#
# Variables opcionales:
#   RETENTION_DAYS            días a retener (default 30)
#   BACKUP_PREFIX             prefijo en R2 (default "pb_data")
#
# Setup en cron (3am diario):
#   0 3 * * * cd /path/printall && ./scripts/backup-pb-to-r2.sh >> /var/log/printall-backup.log 2>&1

set -euo pipefail

: "${POCKETBASE_URL:?POCKETBASE_URL es obligatoria}"
: "${PB_ADMIN_EMAIL:?PB_ADMIN_EMAIL es obligatoria}"
: "${PB_ADMIN_PASSWORD:?PB_ADMIN_PASSWORD es obligatoria}"
: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID es obligatoria}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID es obligatoria}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY es obligatoria}"
: "${R2_BUCKET:?R2_BUCKET es obligatoria}"

RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_PREFIX="${BACKUP_PREFIX:-pb_data}"

TS=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="${BACKUP_PREFIX}_${TS}.zip"
TMP_DIR=$(mktemp -d)
trap "rm -rf '$TMP_DIR'" EXIT

# ── 1) Auth superuser ──
echo "→ Autenticando con superuser..."
TOKEN=$(curl -sf -X POST "${POCKETBASE_URL}/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"${PB_ADMIN_EMAIL}\",\"password\":\"${PB_ADMIN_PASSWORD}\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  echo "✗ No se pudo autenticar"
  exit 1
fi

# ── 2) Pedir a PB que cree el backup ──
echo "→ Solicitando backup ${BACKUP_NAME}..."
curl -sf -X POST "${POCKETBASE_URL}/api/backups" \
  -H "Authorization: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${BACKUP_NAME}\"}"

# Pequeña espera para que termine de escribir
sleep 3

# ── 3) Descargar el zip ──
echo "→ Descargando ${BACKUP_NAME}..."
DOWNLOAD_TOKEN=$(curl -sf -X POST "${POCKETBASE_URL}/api/backups/${BACKUP_NAME}/download-token" \
  -H "Authorization: ${TOKEN}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

curl -sf -o "${TMP_DIR}/${BACKUP_NAME}" \
  "${POCKETBASE_URL}/api/backups/${BACKUP_NAME}?token=${DOWNLOAD_TOKEN}"

BACKUP_SIZE=$(wc -c < "${TMP_DIR}/${BACKUP_NAME}")
echo "  ✓ ${BACKUP_SIZE} bytes"

# ── 4) Subir a R2 con AWS CLI (endpoint custom) ──
echo "→ Subiendo a R2 bucket ${R2_BUCKET}..."
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="auto"

R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

aws --endpoint-url "${R2_ENDPOINT}" s3 cp \
  "${TMP_DIR}/${BACKUP_NAME}" \
  "s3://${R2_BUCKET}/${BACKUP_NAME}" \
  --no-progress

echo "  ✓ Backup subido a s3://${R2_BUCKET}/${BACKUP_NAME}"

# ── 5) Borrar el backup local en PB (no acumular en pb_data/backups) ──
echo "→ Limpiando backup local en PB..."
curl -sf -X DELETE "${POCKETBASE_URL}/api/backups/${BACKUP_NAME}" \
  -H "Authorization: ${TOKEN}" || true

# ── 6) Rotar backups viejos en R2 (RETENTION_DAYS) ──
echo "→ Rotando backups con más de ${RETENTION_DAYS} días..."
CUTOFF_TS=$(date -d "${RETENTION_DAYS} days ago" +%Y%m%d 2>/dev/null || \
            date -v "-${RETENTION_DAYS}d" +%Y%m%d)

aws --endpoint-url "${R2_ENDPOINT}" s3 ls "s3://${R2_BUCKET}/" \
  | awk '{print $4}' \
  | grep -E "^${BACKUP_PREFIX}_[0-9]{8}_[0-9]{6}\.zip$" \
  | while read -r file; do
      FILE_TS=$(echo "$file" | sed -n "s/${BACKUP_PREFIX}_\([0-9]\{8\}\)_.*/\1/p")
      if [ -n "$FILE_TS" ] && [ "$FILE_TS" \< "$CUTOFF_TS" ]; then
        echo "  - borrando $file (TS $FILE_TS < cutoff $CUTOFF_TS)"
        aws --endpoint-url "${R2_ENDPOINT}" s3 rm "s3://${R2_BUCKET}/$file"
      fi
    done

echo "✓ Backup completo: ${BACKUP_NAME}"
