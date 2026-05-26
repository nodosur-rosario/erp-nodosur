/**
 * Tipos de datos estrictos para el Web Service de Facturación Electrónica (WSFE v1)
 * de ARCA / AFIP. Evitan errores tipográficos de mapeo de propiedades SOAP.
 */

export interface AFIPInvoiceRequest {
  CantReg: number;       // Cantidad de registros del detalle (siempre 1 para envíos individuales)
  CbteTipo: number;      // 1 = Factura A, 6 = Factura B, 11 = Factura C, etc.
  PtoVta: number;        // Punto de venta fiscal habilitado
  Concepto: number;      // 1 = Productos, 2 = Servicios, 3 = Productos y Servicios
  DocTipo: number;       // 80 = CUIT, 96 = DNI, 99 = Consumidor Final / Sin Identificar
  DocNro: number;        // Número de CUIT o documento del cliente
  CbteDesde: number;     // Número de comprobante inicial del rango
  CbteHasta: number;     // Número de comprobante final del rango
  CbteFch: string;       // Fecha del comprobante (AAAAMMDD, ej: '20260523')
  ImpTotal: number;      // Importe total (neto + tributos + IVA)
  ImpTotConc: number;    // Importe neto no gravado
  ImpNeto: number;       // Importe neto gravado
  ImpOpEx: number;       // Importe exento
  ImpTrib: number;       // Importe total de tributos/percepciones
  ImpIVA: number;        // Importe total de IVA
  MonId: string;         // Identificador de moneda ('PES' = Pesos Argentinos)
  MonCotiz: number;      // Cotización de la moneda (siempre 1 para 'PES')
}

export interface AFIPInvoiceResponse {
  CAE: string;
  CAEFchVto: string;     // Fecha de vencimiento del CAE (AAAA-MM-DD o AAAAMMDD)
  CbteNro: number;
  RepuestaXML?: string;  // Payload crudo recibido para auditorías
  Resultado: "A" | "R";  // A = Aceptado, R = Rechazado
  Observaciones?: Array<{
    Code: number;
    Msg: string;
  }>;
}

export interface AFIPPadrónRequest {
  cuit: string;
  token: string;
  sign: string;
}

export interface AFIPPadrónResponse {
  cuit: string;
  razonSocial: string;
  condicionIva: "Responsable Inscripto" | "Monotributista" | "Exento" | "Consumidor Final";
  direccion?: string;
  domicilioFiscal?: {
    calle?: string;
    numero?: number;
    piso?: string;
    oficina?: string;
    localidad?: string;
    provincia?: string;
  };
  estado?: string;
}
