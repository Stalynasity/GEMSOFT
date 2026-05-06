// src/config/index.js
require('dotenv').config();

const config = {
  google: {
    spreadsheetId: process.env.SPREADSHEET_ID,
    sheetName:     process.env.SHEET_NAME || 'Hoja1',
    keyFilePath:   process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './credentials/service-account.json',
  },
  soap: {
    endpoint:  process.env.SOAP_ENDPOINT,
    username:  process.env.SOAP_USERNAME,
    password:  process.env.SOAP_PASSWORD,
  },
  processing: {
    concurrency:    parseInt(process.env.CONCURRENCY    || '5',    10),
    maxRetries:     parseInt(process.env.MAX_RETRIES    || '3',    10),
    retryDelayMs:   parseInt(process.env.RETRY_DELAY_MS || '2000', 10),
  },

  // ── Índices de columnas (0-based) ──────────────────────────────────────────
  // Ajusta estos números según el orden real de tu sheet
  columns: {
    nombre:              0,   // A
    tipoIdentificacion:  1,   // B
    oficina:             2,   // C
    fechaProceso:        3,   // D
    url:                 4,   // E
    procesado:           5,   // F  ← columna "Procesado" (NO / SI / mensaje error)
  },

  // Fila donde empiezan los datos (1-based; 1 = sin cabecera, 2 = con cabecera)
  dataStartRow: 2,
};

// Validaciones básicas al arrancar
const required = [
  ['SPREADSHEET_ID',                   config.google.spreadsheetId],
  ['SOAP_ENDPOINT',                    config.soap.endpoint],
  ['SOAP_USERNAME',                    config.soap.username],
  ['SOAP_PASSWORD',                    config.soap.password],
];

for (const [name, value] of required) {
  if (!value) throw new Error(`Variable de entorno requerida no definida: ${name}`);
}

module.exports = config;
