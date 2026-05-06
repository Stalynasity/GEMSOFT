// src/services/driveService.js
/**
 * Descarga archivos de Google Drive y los convierte a base64.
 *
 * Soporta dos tipos de URL que pueden venir en el sheet:
 *   • https://drive.google.com/file/d/FILE_ID/view
 *   • https://drive.google.com/open?id=FILE_ID
 *   • https://docs.google.com/...  (con exportación automática)
 */

const { google } = require('googleapis');
const sheetsService = require('./sheetsService'); // reutiliza la auth ya inicializada
const logger = require('../utils/logger');

class DriveService {
  constructor() {
    this.drive = null;
  }

  // Llamar DESPUÉS de sheetsService.init()
  init() {
    this.drive = google.drive({ version: 'v3', auth: sheetsService.authClient });
    logger.info('Drive API lista');
  }

  /**
   * Descarga el archivo de Drive y devuelve su contenido en base64.
   * @param {string} driveUrl  URL de Drive del sheet
   * @returns {Promise<{ base64: string, mimeType: string } | null>}
   */
  async descargarComoBase64(driveUrl) {
    const fileId = extraerFileId(driveUrl);
    if (!fileId) {
      logger.warn(`No se pudo extraer el fileId de la URL: ${driveUrl}`);
      return null;
    }

    try {
      // 1. Obtener metadata para conocer el mimeType real
      const meta = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType',
      });

      const mimeType = meta.data.mimeType;
      logger.debug(`Descargando archivo Drive: ${meta.data.name} (${mimeType})`);

      let buffer;

      // 2. Si es un Google Doc/Sheet/Slide, exportar como PDF
      if (mimeType.startsWith('application/vnd.google-apps')) {
        const exportMime = 'application/pdf';
        const res = await this.drive.files.export(
          { fileId, mimeType: exportMime },
          { responseType: 'arraybuffer' }
        );
        buffer = Buffer.from(res.data);
        return { base64: buffer.toString('base64'), mimeType: exportMime };
      }

      // 3. Archivos binarios normales (PDF, imágenes, docx, etc.)
      const res = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      buffer = Buffer.from(res.data);
      return { base64: buffer.toString('base64'), mimeType };

    } catch (err) {
      const msg = err?.response?.data?.error?.message ?? err.message;
      logger.error(`Error descargando fileId ${fileId}: ${msg}`);
      return null;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extrae el fileId de los formatos de URL más comunes de Drive:
 *   /file/d/FILE_ID/view
 *   /file/d/FILE_ID/edit
 *   ?id=FILE_ID
 *   /d/FILE_ID/
 */
function extraerFileId(url) {
  if (!url) return null;

  // Formato: /file/d/ID/  o  /d/ID/
  const matchD = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (matchD) return matchD[1];

  // Formato: ?id=ID  o  &id=ID
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (matchId) return matchId[1];

  return null;
}

module.exports = new DriveService();
