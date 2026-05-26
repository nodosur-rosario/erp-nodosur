import { describe, it, expect } from "vitest";
import { roundCommercial, calculateFinalPrice } from "../pricing-rules";

describe("Pricing and Rounding Rules Tests", () => {
  describe("roundCommercial", () => {
    it("should round to the nearest $10 by default", () => {
      expect(roundCommercial(123.45)).toBe(120);
      expect(roundCommercial(126.78)).toBe(130);
      expect(roundCommercial(125.00)).toBe(130); // Standard round-half-up behavior
      expect(roundCommercial(0)).toBe(0);
      expect(roundCommercial(5.01)).toBe(10);
      expect(roundCommercial(4.99)).toBe(0);
    });

    it("should round to the nearest $50 if specified", () => {
      expect(roundCommercial(123.45, 50)).toBe(100);
      expect(roundCommercial(126.78, 50)).toBe(150);
      expect(roundCommercial(174.99, 50)).toBe(150);
      expect(roundCommercial(175.00, 50)).toBe(200);
    });
  });

  describe("calculateFinalPrice", () => {
    it("should calculate correct gross price adding VAT on top of net price", () => {
      expect(calculateFinalPrice(100, 21)).toBe(121);
      expect(calculateFinalPrice(100, 10.5)).toBe(110.5);
      expect(calculateFinalPrice(100, 0)).toBe(100);
      expect(calculateFinalPrice(250.50, 21)).toBeCloseTo(303.105, 3);
    });

    it("should return 0 for invalid inputs", () => {
      expect(calculateFinalPrice(-50, 21)).toBe(0);
      expect(calculateFinalPrice(0, 21)).toBe(0);
      expect(calculateFinalPrice(NaN, 21)).toBe(0);
    });
  });
});
