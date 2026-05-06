// src/utils/xmlBuilder.js
/**
 * Construye el XML SOAP para insertar un documento en el gestor documental.
 * Adapta el namespace, operación y campos según tu WSDL real.
 */

function buildSoapEnvelope({ nombre, tipoIdentificacion, oficina, fechaProceso, url, archivoBase64, archivoMimeType }, config) {
  // Sanitiza texto para XML (evita romper el envelope con caracteres especiales)
  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // El base64 NO necesita escape XML — solo contiene A-Z a-z 0-9 + / =
  const b64 = archivoBase64 ?? '';
  const mime = esc(archivoMimeType ?? 'application/octet-stream');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:doc="http://tu-gestor-documental.com/ws">
  <soapenv:Header>
    <doc:AuthHeader>
      <doc:Username>${esc(config.soap.username)}</doc:Username>
      <doc:Password>${esc(config.soap.password)}</doc:Password>
    </doc:AuthHeader>
  </soapenv:Header>
  <soapenv:Body>
    <doc:InsertarDocumento>
      <doc:Nombre>${esc(nombre)}</doc:Nombre>
      <doc:TipoIdentificacion>${esc(tipoIdentificacion)}</doc:TipoIdentificacion>
      <doc:Oficina>${esc(oficina)}</doc:Oficina>
      <doc:FechaProceso>${esc(fechaProceso)}</doc:FechaProceso>
      <doc:UrlArchivo>${esc(url)}</doc:UrlArchivo>
      <doc:Archivo>
        <doc:MimeType>${mime}</doc:MimeType>
        <doc:Contenido>${b64}</doc:Contenido>
      </doc:Archivo>
    </doc:InsertarDocumento>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = { buildSoapEnvelope };