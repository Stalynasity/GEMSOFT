// src/processor.js
/**
 * Orquestador principal del procesamiento masivo.
 *
 * Flujo:
 *  1. Leer sheet completo       → 1 llamada API Google Sheets
 *  2. Filtrar filas válidas
 *  3. Por cada fila (paralelo controlado):
 *     a. Descargar archivo Drive → convertir a base64
 *     b. Enviar al SOAP con reintentos
 *  4. Acumular resultados en memoria
 *  5. Escribir todos los cambios → 1 llamada batchUpdate Google Sheets
 */

const pLimit = require('p-limit');
const sheetsService = require('./services/sheetsService');
const driveService = require('./services/driveService');
const soapService = require('./services/soapService');
const { parsearFilas } = require('./utils/rowParser');
const config = require('./config');
const logger = require('./utils/logger');

async function run() {
  const inicio = Date.now();
  logger.info('═══════════════════════════════════════════════');
  logger.info('  INICIO DEL PROCESO');
  logger.info('═══════════════════════════════════════════════');

  // ── 1. Autenticar y leer sheet (1 llamada API) ─────────────────────────
  await sheetsService.init();
  driveService.init(); // reutiliza la misma auth de sheetsService
  const rawRows = await sheetsService.readAllRows();

  // ── 2. Filtrar filas procesables ───────────────────────────────────────
  const { filas, totalLeidas, totalProcesables } = parsearFilas(rawRows);

  logger.info(`Filas leídas: ${totalLeidas} | Procesables: ${totalProcesables}`);

  if (totalProcesables === 0) {
    logger.info('No hay filas que procesar. Fin del proceso.');
    return;
  }

  // ── 3. Procesar en paralelo con límite de concurrencia ─────────────────
  const limit = pLimit(config.processing.concurrency);
  const updates = []; // acumula { rowIndex, value } para el batchUpdate final

  let ok = 0, fallos = 0;

  const tareas = filas.map((fila) =>
    limit(async () => {

      // 3a. Descargar archivo de Drive y convertir a base64
      logger.debug(`Descargando archivo Drive para: ${fila.nombre}`);
      const archivo = await driveService.descargarComoBase64(fila.url);

      if (!archivo) {
        // No se pudo descargar — registrar error sin intentar SOAP
        fallos++;
        const errorMsg = 'Error: no se pudo descargar el archivo de Drive';
        updates.push({ rowIndex: fila.rowIndex, value: errorMsg });
        logger.error(`✗ Sin archivo: ${fila.nombre} → ${errorMsg}`);
        return;
      }

      // 3b. Enviar al gestor documental via SOAP
      const resultado = await soapService.insertar({
        ...fila,
        archivoBase64: archivo.base64,
        archivoMimeType: archivo.mimeType,
      });

      if (resultado.ok) {
        ok++;
        updates.push({ rowIndex: fila.rowIndex, value: 'SI' });
        logger.info(`✓ Insertado: ${fila.nombre}`);
      } else {
        fallos++;
        const errorMsg = truncar(resultado.error ?? 'Error desconocido', 500);
        updates.push({ rowIndex: fila.rowIndex, value: errorMsg });
        logger.error(`✗ Falló: ${fila.nombre} → ${errorMsg}`);
      }
    })
  );

  await Promise.all(tareas);

  // ── 4. Escribir todos los cambios en 1 sola llamada batchUpdate ─────────
  await sheetsService.batchUpdateProcesado(updates);

  // ── 5. Resumen ──────────────────────────────────────────────────────────
  const duracion = ((Date.now() - inicio) / 1000).toFixed(1);
  logger.info('═══════════════════════════════════════════════');
  logger.info('  RESUMEN FINAL');
  logger.info(`  Total procesadas : ${totalProcesables}`);
  logger.info(`  Exitosas (SI)    : ${ok}`);
  logger.info(`  Fallidas         : ${fallos}`);
  logger.info(`  Tiempo total     : ${duracion}s`);
  logger.info('═══════════════════════════════════════════════');
}

function truncar(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

module.exports = { run };