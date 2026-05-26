/**
 * Utilitarios de zona horaria y cálculo de fechas para la República Argentina (GMT-3).
 * Utiliza exclusivamente las APIs nativas de JavaScript Intl.DateTimeFormat para evitar
 * el uso de dependencias externas pesadas.
 * 
 * NOTA: Argentina no observa horario de verano (DST) desde 2009, lo cual simplifica
 * las operaciones ya que es constantemente UTC-3.
 */

const TIMEZONE_AR = "America/Argentina/Buenos_Aires";
const LOCALE_AR = "es-AR";

/**
 * Retorna un objeto Date que representa el instante actual ajustado a la zona de Buenos Aires.
 */
export function getARCurrentDate(): Date {
  const now = new Date();
  // Obtener representación local en Buenos Aires e instanciarla
  const formatter = new Intl.DateTimeFormat(LOCALE_AR, {
    timeZone: TIMEZONE_AR,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    fractionalSecondDigits: 3,
  });
  
  // Parsear la cadena formateada para crear un Date localmente equivalente
  // Intl formatea como "DD/MM/YYYY, HH:MM:SS"
  const parts = formatter.formatToParts(now);
  const findPart = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  
  const day = parseInt(findPart("day"), 10);
  const month = parseInt(findPart("month"), 10) - 1; // base 0 para Date
  const year = parseInt(findPart("year"), 10);
  const hour = parseInt(findPart("hour"), 10);
  const minute = parseInt(findPart("minute"), 10);
  const second = parseInt(findPart("second"), 10);
  const millisecond = parseInt(findPart("fractionalSecond") || "0", 10);

  return new Date(year, month, day, hour, minute, second, millisecond);
}

/**
 * Formatea un objeto Date en cadena DD/MM/YYYY en la zona horaria de Buenos Aires.
 */
export function formatToARDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat(LOCALE_AR, {
    timeZone: TIMEZONE_AR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return formatter.format(date);
}

/**
 * Convierte una cadena de fecha "DD/MM/YYYY" en dos límites ISO UTC correspondientes
 * al inicio y al final de ese día en hora de Argentina (GMT-3).
 * 
 * Regla:
 * - 00:00:00.000 AR = 03:00:00.000 UTC
 * - 23:59:59.999 AR = 02:59:59.999 UTC del día siguiente
 */
export function arDateToUTCBounds(dateStr: string): { startISO: string; endISO: string } {
  const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = dateStr.match(regex);
  
  if (!match) {
    throw new Error(`Formato de fecha inválido. Debe ser DD/MM/YYYY: ${dateStr}`);
  }
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // base 0
  const year = parseInt(match[3], 10);

  // Crear la fecha local inicio a las 00:00:00 hora de Buenos Aires.
  // Como estamos en UTC-3, restamos 3 horas en UTC para saber la equivalencia.
  // O podemos instanciar usando UTC directo.
  // Año, Mes, Día en GMT-3 a las 00:00:00 equivale a las 03:00:00 UTC.
  const startUTC = new Date(Date.UTC(year, month, day, 3, 0, 0, 0));
  
  // Año, Mes, Día en GMT-3 a las 23:59:59.999 equivale al día siguiente a las 02:59:59.999 UTC.
  const endUTC = new Date(Date.UTC(year, month, day + 1, 2, 59, 59, 999));

  return {
    startISO: startUTC.toISOString(),
    endISO: endUTC.toISOString(),
  };
}

/**
 * Retorna las cadenas de fechas "DD/MM/YYYY" límites para las opciones rápidas en hora de Argentina.
 */
export function getQuickSelectBounds(key: string): { startDate: string; endDate: string } {
  const arNow = getARCurrentDate();
  const year = arNow.getFullYear();
  const month = arNow.getMonth(); // base 0

  let start = new Date(year, month, 1);
  let end = new Date(arNow);

  if (key === "mes-anterior") {
    // Primer día del mes anterior
    start = new Date(year, month - 1, 1);
    // Último día del mes anterior (día 0 del mes actual)
    end = new Date(year, month, 0);
  } else if (key === "ultimos-3-meses") {
    // 90 días atrás
    start = new Date(arNow.getTime() - 90 * 24 * 60 * 60 * 1000);
    end = new Date(arNow);
  } else if (key === "este-mes") {
    start = new Date(year, month, 1);
    end = new Date(arNow);
  }

  return {
    startDate: formatToARDate(start),
    endDate: formatToARDate(end),
  };
}
