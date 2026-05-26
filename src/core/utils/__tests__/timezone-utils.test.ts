import { describe, it, expect } from "vitest";
import { formatToARDate, arDateToUTCBounds, getQuickSelectBounds } from "../timezone-utils";

describe("Timezone Utilities - America/Argentina/Buenos_Aires (GMT-3)", () => {
  it("should format a standard Javascript Date to es-AR DD/MM/YYYY format", () => {
    // 24th May 2026, 12:00:00 UTC
    // In Argentina (UTC-3), it is 24/05/2026 09:00:00
    const date = new Date(Date.UTC(2026, 4, 24, 12, 0, 0));
    const arStr = formatToARDate(date);
    expect(arStr).toBe("24/05/2026");
  });

  it("should calculate exact ISO bounds for a DD/MM/YYYY date representing Argentina GMT-3 start and end of day", () => {
    const { startISO, endISO } = arDateToUTCBounds("24/05/2026");

    // 00:00:00 AR is exactly 03:00:00 UTC of the same day
    expect(startISO).toBe("2026-05-24T03:00:00.000Z");

    // 23:59:59.999 AR is exactly 02:59:59.999 UTC of the next day
    expect(endISO).toBe("2026-05-25T02:59:59.999Z");
  });

  it("should throw an error for malformed dates passed to bounds parser", () => {
    expect(() => arDateToUTCBounds("24-05-2026")).toThrow();
    expect(() => arDateToUTCBounds("24/05/26")).toThrow();
  });

  it("should generate valid boundary dates for quick selection keys", () => {
    const boundsThisMonth = getQuickSelectBounds("este-mes");
    expect(boundsThisMonth.startDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(boundsThisMonth.endDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    const boundsLastMonth = getQuickSelectBounds("mes-anterior");
    expect(boundsLastMonth.startDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(boundsLastMonth.endDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});
