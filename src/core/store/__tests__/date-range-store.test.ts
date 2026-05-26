import { describe, it, expect, beforeEach } from "vitest";
import { useDateRangeStore } from "../date-range-store";

describe("Zustand Date Range Store Logic", () => {
  beforeEach(() => {
    useDateRangeStore.getState().resetStore();
  });

  it("should initialize with 'este-mes' option and valid dates", () => {
    const state = useDateRangeStore.getState();
    expect(state.quickSelect).toBe("este-mes");
    expect(state.startDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(state.endDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("should update bounds correctly when setting quick select options", () => {
    const store = useDateRangeStore.getState();
    
    store.setQuickSelect("mes-anterior");
    const updatedState = useDateRangeStore.getState();
    expect(updatedState.quickSelect).toBe("mes-anterior");
    expect(updatedState.startDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("should allow custom range selection and flag it as 'personalizado'", () => {
    const store = useDateRangeStore.getState();
    
    store.setCustomRange("10/04/2026", "20/04/2026");
    const updatedState = useDateRangeStore.getState();
    
    expect(updatedState.quickSelect).toBe("personalizado");
    expect(updatedState.startDate).toBe("10/04/2026");
    expect(updatedState.endDate).toBe("20/04/2026");
  });
});
