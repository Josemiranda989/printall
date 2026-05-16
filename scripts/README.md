# scripts

Scripts operacionales del proyecto.

## `backup-pb-to-r2.sh`

Backup automático de `pb_data` a Cloudflare R2.

### Setup

1. Crear bucket R2 en Cloudflare dashboard.
2. Generar API token R2 (Access Key + Secret) con permisos de **Object Read & Write** sobre el bucket.
3. Instalar AWS CLI v2 en el host.
4. Exportar variables de entorno (o ponerlas en un `.env.backup` separado y `source`earlo desde el cron):

```bash
export POCKETBASE_URL="http://localhost:8090"
export PB_ADMIN_EMAIL="admin@example.com"
export PB_ADMIN_PASSWORD="..."
export R2_ACCOUNT_ID="..."          # de Cloudflare dashboard
export R2_ACCESS_KEY_ID="..."
export R2_SECRET_ACCESS_KEY="..."
export R2_BUCKET="printall-backups"
export RETENTION_DAYS=30             # opcional
```

5. Probar manual:

```bash
./scripts/backup-pb-to-r2.sh
```

6. Cron diario (3am):

```cron
0 3 * * * cd /path/printall && source /path/.env.backup && ./scripts/backup-pb-to-r2.sh >> /var/log/printall-backup.log 2>&1
```

### Qué hace

1. Auth como superuser.
2. Pide a PocketBase generar un backup zip.
3. Descarga el zip.
4. Sube a R2 con `s3://${R2_BUCKET}/pb_data_YYYYMMDD_HHMMSS.zip`.
5. Borra el backup local en PB.
6. Rota backups en R2 más viejos que `RETENTION_DAYS`.

### Recovery

Para restaurar:

```bash
aws --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" s3 cp \
  s3://${R2_BUCKET}/pb_data_YYYYMMDD_HHMMSS.zip ./restore.zip

# Subir a PB via la API o el dashboard /_/
# (o reemplazar pb_data si el contenedor está parado)
```
