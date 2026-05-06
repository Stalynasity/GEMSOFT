// src/services/sheetsService.js
/**
 * Servicio Google Sheets — estrategia de mínimo consumo de cuota
 * ─────────────────────────────────────────────────────────────────
 * • Lee TODO el rango de una sola llamada API  (1 read request).
 * • Acumula todos los cambios en memoria.
 * • Escribe todos los cambios en UNA sola llamada batchUpdate (1 write request).
 * Resultado: 2 llamadas API por ejecución completa, sin importar cuántas filas.
 */

const { google } = require('googleapis');
const config = require('../config');
const logger = require('../utils/logger');

class SheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    // drive se expone para que driveService reutilice la misma auth
    this.authClient = null;
  }

  // ── Autenticación ──────────────────────────────────────────────────────────
  async init() {
    const auth = new google.auth.GoogleAuth({
      keyFile: config.google.keyFilePath,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly', // para descargar archivos
      ],
    });
    this.authClient = await auth.getClient();
    this.auth = this.authClient;
    this.sheets = google.sheets({ version: 'v4', auth: this.authClient });
    logger.info('Autenticado con Google Sheets + Drive API');
  }

  // ── Lectura completa en 1 llamada ──────────────────────────────────────────
  async readAllRows() {
    const range = `${config.google.sheetName}!A:Z`; // todas las columnas

    logger.info('Leyendo sheet completo…', { spreadsheetId: config.google.spreadsheetId, range });

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: config.google.spreadsheetId,
      range,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = response.data.values || [];
    logger.info(`Sheet leído: ${rows.length} filas en total (incluye cabecera)`);
    return rows;
  }

  // ── Escribe TODOS los cambios de una vez (1 llamada batchUpdate) ────────────
  async batchUpdateProcesado(updates) {
    /**
     * updates: Array<{ rowIndex: number, value: string }>
     *   rowIndex: 0-based (0 = fila 1 en Sheets)
     *   value:    'SI' | mensaje de error
     */
    if (updates.length === 0) {
      logger.info('Sin cambios pendientes para escribir en el sheet.');
      return;
    }

    const col = config.columns.procesado;
    const colLetter = columnIndexToLetter(col);
    const sheetName = config.google.sheetName;

    // Construimos un valueRange por cada celda actualizada
    const data = updates.map(({ rowIndex, value }) => ({
      range: `${sheetName}!${colLetter}${rowIndex + 1}`,
      values: [[value]],
    }));

    logger.info(`Escribiendo ${data.length} actualizaciones en batch…`);

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.google.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data,
      },
    });

    logger.info('Sheet actualizado correctamente.');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function columnIndexToLetter(index) {
  let letter = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

module.exports = new SheetsService();