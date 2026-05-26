/**
 * Utilidades para el cálculo de precios, impuestos (IVA) y redondeo comercial argentino.
 */

/**
 * Redondea un monto al múltiplo entero más cercano.
 * Por defecto redondea al múltiplo de $10 más cercano para agilizar el manejo de efectivo y facturación.
 * 
 * @param amount Monto a redondear
 * @param step Múltiplo de redondeo (por defecto 10)
 * @returns Monto redondeado
 */
export function roundCommercial(amount: number, step: number = 10): number {
  if (isNaN(amount) || amount === 0) return 0;
  return Math.round(amount / step) * step;
}

/**
 * Calcula el importe final adicionando el porcentaje de IVA sobre el neto.
 * 
 * @param net Precio neto (Base imponible)
 * @param rateAlicuota Porcentaje de IVA (ej: 21.0, 10.5, 0.0)
 * @returns Precio final con IVA
 */
export function calculateFinalPrice(net: number, rateAlicuota: number): number {
  if (isNaN(net) || net <= 0) return 0;
  const factor = 1 + (rateAlicuota / 100);
  return net * factor;
}
