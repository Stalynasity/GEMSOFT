// src/utils/rowParser.js
const config = require('../config');

const INVALIDOS = ['', 'no encontrado'];

/**
 * Convierte las filas crudas del sheet en objetos estructurados
 * y filtra únicamente las que deben procesarse.
 *
 * @param {string[][]} rows  - Todas las filas del sheet (incluyendo cabecera)
 * @returns {{ filas: object[], totalLeidas: number, totalProcesables: number }}
 */
function parsearFilas(rows) {
  const { nombre, tipoIdentificacion, oficina, fechaProceso, url, procesado } = config.columns;
  const startRow = config.dataStartRow; // 2 si hay cabecera (0-based index = 1)

  const filasProcesables = [];

  for (let i = startRow - 1; i < rows.length; i++) {
    const row = rows[i] ?? [];

    const datos = {
      rowIndex:           i,                    // índice 0-based, necesario para batchUpdate
      nombre:             (row[nombre]             ?? '').trim(),
      tipoIdentificacion: (row[tipoIdentificacion] ?? '').trim(),
      oficina:            (row[oficina]            ?? '').trim(),
      fechaProceso:       (row[fechaProceso]       ?? '').trim(),
      url:                (row[url]               ?? '').trim(),
      procesado:          (row[procesado]          ?? '').trim(),
    };

    // ── Condición 1: columna Procesado debe ser exactamente "NO" ──────────
    if (datos.procesado.toUpperCase() !== 'NO') continue;

    // ── Condición 2: ningún campo relevante vacío o "No encontrado" ────────
    const campos = [datos.nombre, datos.tipoIdentificacion, datos.oficina, datos.fechaProceso, datos.url];
    if (campos.some((v) => INVALIDOS.includes(v.toLowerCase()))) continue;

    filasProcesables.push(datos);
  }

  return {
    filas:            filasProcesables,
    totalLeidas:      rows.length - (startRow - 1),
    totalProcesables: filasProcesables.length,
  };
}

module.exports = { parsearFilas };
