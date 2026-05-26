import { describe, it, expect, beforeEach } from "vitest";
import { useSalesStore } from "../use-sales-store";

describe("Sales Zustand Store Tests", () => {
  beforeEach(() => {
    // Reset state before each test
    useSalesStore.getState().clearSales();
  });

  it("should initialize with default empty values", () => {
    const state = useSalesStore.getState();
    expect(state.cart).toEqual([]);
    expect(state.clientName).toBe("Consumidor Final");
    expect(state.clientCuit).toBe("99999999999");
    expect(state.clientIvaCondition).toBe("Consumidor Final");
    expect(state.voucherType).toBe("Factura B");
    expect(state.paymentMethod).toBe("efectivo");
  });

  it("should add a new item to the cart", () => {
    const store = useSalesStore.getState();
    const mockItem = {
      id: "art-1",
      codigo_fabricante: "F-100",
      descripcion: "Filtro de Aire Peugeot 208",
      precio_minorista: 12000,
      precio_mayorista: 9000,
    };

    store.addItem(mockItem, "minorista");

    const updatedState = useSalesStore.getState();
    expect(updatedState.cart.length).toBe(1);
    expect(updatedState.cart[0]).toEqual({
      id: "art-1",
      codigo_fabricante: "F-100",
      descripcion: "Filtro de Aire Peugeot 208",
      cantidad: 1,
      precio_unitario: 12000,
      precio_tipo: "minorista",
      alicuota_iva: 21.0,
    });
  });

  it("should increment quantity when adding a duplicate item", () => {
    const store = useSalesStore.getState();
    const mockItem = {
      id: "art-1",
      codigo_fabricante: "F-100",
      descripcion: "Filtro de Aire Peugeot 208",
      precio_minorista: 12000,
      precio_mayorista: 9000,
    };

    store.addItem(mockItem, "minorista");
    store.addItem(mockItem, "minorista");

    const updatedState = useSalesStore.getState();
    expect(updatedState.cart.length).toBe(1);
    expect(updatedState.cart[0].cantidad).toBe(2);
  });

  it("should update quantity directly", () => {
    const store = useSalesStore.getState();
    const mockItem = {
      id: "art-1",
      codigo_fabricante: "F-100",
      descripcion: "Filtro de Aire Peugeot 208",
      precio_minorista: 12000,
      precio_mayorista: 9000,
    };

    store.addItem(mockItem, "minorista");
    store.updateQuantity("art-1", 5);

    const updatedState = useSalesStore.getState();
    expect(updatedState.cart[0].cantidad).toBe(5);
  });

  it("should select the correct voucher type automatically based on client condition", () => {
    const store = useSalesStore.getState();

    // Responsable Inscripto -> Factura A
    store.setClient("30111111118", "Repuestos Warnes S.A.", "Responsable Inscripto");
    let state = useSalesStore.getState();
    expect(state.voucherType).toBe("Factura A");
    expect(state.clientName).toBe("Repuestos Warnes S.A.");

    // Consumidor Final -> Factura B
    store.setClient("99999999999", "Consumidor Final", "Consumidor Final");
    state = useSalesStore.getState();
    expect(state.voucherType).toBe("Factura B");
  });

  it("should set payment method correctly", () => {
    const store = useSalesStore.getState();
    store.setPaymentMethod("tarjeta");
    
    const state = useSalesStore.getState();
    expect(state.paymentMethod).toBe("tarjeta");
  });

  it("should reset payment method to efectivo on clearSales", () => {
    const store = useSalesStore.getState();
    store.setPaymentMethod("transferencia");
    
    store.clearSales();
    
    const state = useSalesStore.getState();
    expect(state.paymentMethod).toBe("efectivo");
  });

  it("should update alicuota_iva of a cart item correctly", () => {
    const store = useSalesStore.getState();
    const mockItem = {
      id: "art-1",
      codigo_fabricante: "F-100",
      descripcion: "Filtro de Aire Peugeot 208",
      precio_minorista: 12000,
      precio_mayorista: 9000,
    };

    store.addItem(mockItem, "minorista");
    store.updateAlicuota("art-1", 10.5);

    const updatedState = useSalesStore.getState();
    expect(updatedState.cart[0].alicuota_iva).toBe(10.5);
  });
});
