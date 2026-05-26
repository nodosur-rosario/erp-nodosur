-- =====================================================================
-- MIGRATION: Double-Entry Bookkeeping Balance Enforcement
-- Table: public.accounting_entries
-- Description: Enforces SUM(debe) == SUM(haber) for every transaction_id
-- =====================================================================

-- 1. Create or replace the validation function
CREATE OR REPLACE FUNCTION public.validar_asiento_balanceado()
RETURNS TRIGGER AS $$
DECLARE
  v_debe NUMERIC;
  v_haber NUMERIC;
  v_diff NUMERIC;
  v_tx_id TEXT;
BEGIN
  -- Retrieve transaction_id from either the new record or old record (for deletions)
  v_tx_id := COALESCE(NEW.transaction_id, OLD.transaction_id);

  IF v_tx_id IS NOT NULL THEN
    -- Calculate total Debe and Haber for the modified transaction
    SELECT COALESCE(SUM(debe), 0), COALESCE(SUM(haber), 0)
    INTO v_debe, v_haber
    FROM public.accounting_entries
    WHERE transaction_id = v_tx_id;

    v_diff := ABS(v_debe - v_haber);

    -- Enforce double-entry consistency within $0.01 precision limit
    IF v_diff > 0.01 THEN
      RAISE EXCEPTION 'El asiento contable % no está balanceado. Diferencia de $% (Total Debe: $%, Total Haber: $%).',
        v_tx_id, v_diff, v_debe, v_haber;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop the trigger if it already exists to guarantee an idempotent application
DROP TRIGGER IF EXISTS trg_validar_balance_asiento ON public.accounting_entries;

-- 3. Create the AFTER constraint trigger
-- DEFERRABLE INITIALLY DEFERRED forces the evaluation at the end of the SQL transaction/statement block.
CREATE CONSTRAINT TRIGGER trg_validar_balance_asiento
AFTER INSERT OR UPDATE OR DELETE
ON public.accounting_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validar_asiento_balanceado();
