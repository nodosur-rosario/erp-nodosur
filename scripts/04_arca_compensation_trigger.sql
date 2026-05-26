-- MIGRATION: AFIP TRANSACTION COMPENSATORY TRIGGER
-- Path: scripts/04_arca_compensation_trigger.sql

-- 1. Crear o reemplazar la función de reversión transaccional compensatoria
CREATE OR REPLACE FUNCTION public.fn_revertir_efectos_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_item jsonb;
    v_id uuid;
    v_cantidad integer;
    v_tx_id text;
    v_credit_acc_id text;
    v_caja_sesion_id uuid;
BEGIN
    -- El trigger actúa si:
    -- A. Se actualiza el voucher al estado definitivo de rechazo ('rechazado_afip')
    -- B. Se elimina el voucher provisional y no estaba previamente autorizado
    IF (TG_OP = 'UPDATE' AND NEW.status = 'rechazado_afip' AND OLD.status != 'rechazado_afip') OR 
       (TG_OP = 'DELETE' AND OLD.status IN ('pendiente_cae', 'error_temporal', 'rechazado_afip')) THEN
       
       RAISE NOTICE '[ARCA COMPENSATION] Reverting sales effects for voucher: %', OLD.id;

       -- 1. RESTITUIR EXISTENCIAS FÍSICAS EN INVENTARIO (STOCK)
       IF OLD.items IS NOT NULL THEN
           FOR v_item IN SELECT * FROM jsonb_array_elements(OLD.items)
           LOOP
               v_id := (v_item->>'id')::uuid;
               v_cantidad := (v_item->>'cantidad')::integer;
               
               RAISE NOTICE '[ARCA COMPENSATION] Restoring % units to article ID %', v_cantidad, v_id;
               
               UPDATE public.articulo
               SET stock_actual = stock_actual + v_cantidad
               WHERE id = v_id;
           END LOOP;
       END IF;

       -- 2. IDENTIFICAR TRANSACCIÓN CONTABLE ASOCIADA
       SELECT id INTO v_tx_id 
       FROM public.accounting_transactions 
       WHERE description LIKE '%' || OLD.id || '%' 
         AND company_cuit = OLD.company_cuit 
       LIMIT 1;

       IF v_tx_id IS NOT NULL THEN
           RAISE NOTICE '[ARCA COMPENSATION] Found accounting transaction id % to delete.', v_tx_id;
           
           -- 3. ELIMINAR REGISTROS DE ASIENTOS CONTABLES (ASOCIACIONES EN CASCADA MANUAL)
           DELETE FROM public.accounting_entries WHERE transaction_id = v_tx_id;
           DELETE FROM public.accounting_transactions WHERE id = v_tx_id;

           -- 4. REVERTIR CAJA DIARIA
           SELECT sesion_id INTO v_caja_sesion_id 
           FROM public.caja_movimiento 
           WHERE accounting_transaction_id = v_tx_id 
           LIMIT 1;

           IF v_caja_sesion_id IS NOT NULL THEN
               RAISE NOTICE '[ARCA COMPENSATION] Reverting daily cash movement in session %', v_caja_sesion_id;
               
               -- Restar el monto total de la venta del saldo teórico de la caja
               UPDATE public.caja_sesion
               SET monto_teorico = GREATEST(0, monto_teorico - OLD.total_amount)
               WHERE id = v_caja_sesion_id;

               -- Eliminar el registro del movimiento
               DELETE FROM public.caja_movimiento WHERE accounting_transaction_id = v_tx_id;
           END IF;

           -- 5. REVERTIR CUENTA CORRIENTE DE CLIENTES
           SELECT credit_account_id INTO v_credit_acc_id 
           FROM public.customer_credit_movements 
           WHERE accounting_transaction_id = v_tx_id 
           LIMIT 1;

           IF v_credit_acc_id IS NOT NULL THEN
               RAISE NOTICE '[ARCA COMPENSATION] Reverting customer credit debit. CC Account: %', v_credit_acc_id;
               
               -- Reversar el saldo restándole el monto de la compra
               UPDATE public.customer_credit_accounts
               SET saldo_actual = GREATEST(0, saldo_actual - OLD.total_amount)
               WHERE id = v_credit_acc_id;

               -- Eliminar movimiento
               DELETE FROM public.customer_credit_movements WHERE accounting_transaction_id = v_tx_id;
           END IF;
       END IF;
    END IF;

    -- Retornar el valor correspondiente para la continuación de la operación
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Declarar triggers en public.arca_vouchers
DROP TRIGGER IF EXISTS trg_arca_voucher_compensation_update ON public.arca_vouchers;
CREATE TRIGGER trg_arca_voucher_compensation_update
AFTER UPDATE ON public.arca_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.fn_revertir_efectos_venta();

DROP TRIGGER IF EXISTS trg_arca_voucher_compensation_delete ON public.arca_vouchers;
CREATE TRIGGER trg_arca_voucher_compensation_delete
AFTER DELETE ON public.arca_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.fn_revertir_efectos_venta();

RAISE NOTICE '[ARCA COMPENSATION] Compensatory triggers successfully registered on public.arca_vouchers.';
