// src/services/soapService.js
const axios              = require('axios');
const { XMLParser }      = require('fast-xml-parser');
const { buildSoapEnvelope } = require('../utils/xmlBuilder');
const config             = require('../config');
const logger             = require('../utils/logger');

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

class SoapService {
  /**
   * Envía una fila al gestor documental con reintentos automáticos.
   * @param {object} fila  - { nombre, tipoIdentificacion, oficina, fechaProceso, url }
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async insertar(fila) {
    const xml    = buildSoapEnvelope(fila, config);
    const maxTry = config.processing.maxRetries; // default 3

    for (let intento = 1; intento <= maxTry; intento++) {
      try {
        logger.debug(`SOAP intento ${intento}/${maxTry}`, { nombre: fila.nombre });

        const response = await axios.post(config.soap.endpoint, xml, {
          headers: {
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction':   '"InsertarDocumento"', // ajusta según tu WSDL
          },
          timeout: 30_000, // 30 s
        });

        // ── Parsear respuesta SOAP ──────────────────────────────────────────
        const parsed   = parser.parse(response.data);
        const body     = parsed?.Envelope?.Body ?? {};
        const resultado = body?.InsertarDocumentoResponse?.resultado
                       ?? body?.InsertarDocumentoResult
                       ?? null;

        // Ajusta la lógica de éxito según lo que devuelva tu WSDL real
        if (isSuccess(resultado)) {
          logger.info(`SOAP OK (intento ${intento})`, { nombre: fila.nombre });
          return { ok: true };
        }

        // Respuesta SOAP recibida pero con error de negocio
        const msg = String(resultado ?? 'Respuesta inesperada del servidor SOAP');
        logger.warn(`SOAP respuesta de error (intento ${intento}): ${msg}`, { nombre: fila.nombre });

        if (intento === maxTry) return { ok: false, error: msg };

      } catch (err) {
        const msg = err.response?.data
          ? extraerMensajeSOAP(err.response.data)
          : err.message;

        logger.warn(`SOAP excepción (intento ${intento}): ${msg}`, { nombre: fila.nombre });

        if (intento === maxTry) return { ok: false, error: `Error tras ${maxTry} intentos: ${msg}` };
      }

      // Espera antes de reintentar
      await sleep(config.processing.retryDelayMs * intento); // backoff progresivo
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function isSuccess(resultado) {
  if (resultado === null || resultado === undefined) return false;
  const str = String(resultado).toLowerCase();
  // Adapta estas condiciones a lo que tu WSDL devuelve como éxito
  return str === 'ok' || str === 'true' || str === '1' || str === 'success';
}

function extraerMensajeSOAP(xml) {
  try {
    const parsed = parser.parse(xml);
    return parsed?.Envelope?.Body?.Fault?.faultstring
        ?? parsed?.Envelope?.Body?.Fault?.detail
        ?? xml.slice(0, 300);
  } catch {
    return String(xml).slice(0, 300);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = new SoapService();
