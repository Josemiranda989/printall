# Spec: add-unit-tests

## REQ-01: sanitizeSlug

La función `sanitizeSlug` MUST rechazar cualquier carácter que no sea
`[a-zA-Z0-9\-_]` para prevenir inyección en filtros de PocketBase.

**Given** un slug con caracteres especiales como `"'; DROP TABLE--"`
**When** se llama `sanitizeSlug`
**Then** el resultado solo contiene caracteres alfanuméricos, guiones y underscores

**Given** un slug válido como `"filamentos-pla"`
**When** se llama `sanitizeSlug`
**Then** el resultado es idéntico al input

**Given** un slug vacío `""`
**When** se llama `sanitizeSlug`
**Then** el resultado es `""`

## REQ-02: getFileUrl

La función `getFileUrl` MUST construir URLs de archivos de PocketBase
siguiendo el patrón `/api/files/{collectionId}/{recordId}/{fileName}`.

**Given** collectionId, recordId y fileName válidos sin thumb
**When** se llama `getFileUrl`
**Then** la URL resultante sigue el patrón `/api/files/col/rec/file.jpg`

**Given** collectionId, recordId, fileName y thumb `"400x400"` 
**When** se llama `getFileUrl` con thumb
**Then** la URL incluye el segmento `thumb_file.jpg/400x400_file.jpg`

## REQ-03: getWhatsAppUrl

La función `getWhatsAppUrl` MUST producir una URL `https://wa.me/` con
el mensaje correctamente codificado con `encodeURIComponent`.

**Given** un número de teléfono y un mensaje con caracteres especiales
**When** se llama `getWhatsAppUrl`
**Then** la URL comienza con `https://wa.me/{número}?text=`
**And** el mensaje está URL-encoded

## REQ-04: getProductWhatsAppUrl

La función `getProductWhatsAppUrl` MUST usar `product.whatsapp_message`
si está definido; SHOULD usar el mensaje por defecto en caso contrario.

**Given** un producto con `whatsapp_message` personalizado
**When** se llama `getProductWhatsAppUrl`
**Then** la URL contiene el mensaje personalizado codificado

**Given** un producto sin `whatsapp_message`
**When** se llama `getProductWhatsAppUrl`
**Then** la URL contiene el nombre del producto en el mensaje por defecto
