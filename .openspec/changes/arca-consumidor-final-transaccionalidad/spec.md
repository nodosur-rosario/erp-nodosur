# Especificación Técnica: Consistencia Fiscal y Transaccional de AFIP

## 1. Requerimiento Técnico POS (Front-end)

Se deben interceptar los intentos de checkout en [ventas/page.tsx](file:///c:/Users/juanr/OneDrive/Escritorio/Proyectos/Beast-Driven-Development/src/app/protected/%28dashboard%29/ventas/page.tsx) dentro de `handleCheckout`.

### Reglas de Bloqueo a Implementar:
1.  **Límite de Consumidor Final**:
    *   **Identificador del CUIT de Consumidor Final**: `salesStore.clientCuit.trim() === "99999999999"` (o si `salesStore.clientName.toLowerCase()` contiene `"consumidor final"`).
    *   **Pago en Efectivo**: Si `salesStore.paymentMethod === "efectivo"` y `totalAmount > 191104`:
        *   Bloquear emisión.
        *   Mostrar Toast de error: `AFIP exige identificar al cliente (DNI/CUIT) para compras en efectivo mayores a $191,104. Por favor, selecciona un cliente identificado.`
    *   **Pago Electrónico**: Si `(salesStore.paymentMethod === "tarjeta" || salesStore.paymentMethod === "transferencia")` y `totalAmount > 382208`:
        *   Bloquear emisión.
        *   Mostrar Toast de error: `AFIP exige identificar al cliente (DNI/CUIT) para compras con tarjeta/transferencia mayores a $382,208. Por favor, selecciona un cliente identificado.`
2.  **Límite de Factura A**:
    *   Si `salesStore.voucherType === "Factura A"`, forzar:
        *   `docTipo` debe ser `80` (CUIT).
        *   `docNro` debe tener longitud exacta de 11 dígitos numéricos.
        *   El CUIT no puede ser `99999999999`.
        *   `salesStore.clientIvaCondition` debe ser `"Responsable Inscripto"`.
        *   Si no se cumple alguno, bloquear checkout y alertar: `La Factura A exige un cliente Responsable Inscripto con CUIT válido de 11 dígitos.`

---

## 2. Requerimiento Técnico de Base de Datos (PostgreSQL)

Se debe implementar una transacción compensatoria atómica ejecutada en el servidor ante fallas de autorización o descartes de vouchers provisionales.

### Schema del Trigger y Función Compensatoria:
Ubicación: [04_arca_compensation_trigger.sql](file:///c:/Users/juanr/OneDrive/Escritorio/Proyectos/Beast-Driven-Development/scripts/04_arca_compensation_trigger.sql)

```sql
-- Función de Reversión
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
    -- Determinar si la operación aplica (cambio a 'rechazado_afip' o delete de un voucher no autorizado)
    IF (TG_OP = 'UPDATE' AND NEW.status = 'rechazado_afip' AND OLD.status != 'rechazado_afip') OR 
       (TG_OP = 'DELETE' AND OLD.status IN ('pendiente_cae', 'error_temporal', 'rechazado_afip')) THEN
       
       -- Usar OLD para referenciar los datos del voucher
       
       -- 1. RESTITUIR STOCK DE ARTÍCULOS
       IF OLD.items IS NOT NULL THEN
           FOR v_item IN SELECT * FROM jsonb_array_elements(OLD.items)
           LOOP
               v_id := (v_item->>'id')::uuid;
               v_cantidad := (v_item->>'cantidad')::integer;
               
               -- Incrementar el stock actual de forma transaccional
               UPDATE public.articulo
               SET stock_actual = stock_actual + v_cantidad
               WHERE id = v_id;
           END LOOP;
       END IF;

       -- 2. LOCALIZAR TRANSACCIÓN CONTABLE ASOCIADA
       SELECT id INTO v_tx_id 
       FROM public.accounting_transactions 
       WHERE description LIKE '%' || OLD.id || '%' 
         AND company_cuit = OLD.company_cuit 
       LIMIT 1;

       IF v_tx_id IS NOT NULL THEN
           -- 3. ANULAR REGISTRO CONTABLE (Haber/Debe)
           DELETE FROM public.accounting_entries WHERE transaction_id = v_tx_id;
           DELETE FROM public.accounting_transactions WHERE id = v_tx_id;

           -- 4. REVERTIR MOVIMIENTO DE CAJA DIARIA
           SELECT sesion_id INTO v_caja_sesion_id 
           FROM public.caja_movimiento 
           WHERE accounting_transaction_id = v_tx_id 
           LIMIT 1;

           IF v_caja_sesion_id IS NOT NULL THEN
               -- Descontar del monto_teorico de la sesión
               UPDATE public.caja_sesion
               SET monto_teorico = GREATEST(0, monto_teorico - OLD.total_amount)
               WHERE id = v_caja_sesion_id;

               -- Eliminar movimiento
               DELETE FROM public.caja_movimiento WHERE accounting_transaction_id = v_tx_id;
           END IF;

           -- 5. REVERTIR MOVIMIENTOS Y SALDO DE CUENTA CORRIENTE
           SELECT credit_account_id INTO v_credit_acc_id 
           FROM public.customer_credit_movements 
           WHERE accounting_transaction_id = v_tx_id 
           LIMIT 1;

           IF v_credit_acc_id IS NOT NULL THEN
               -- Devolver saldo al límite anterior
               UPDATE public.customer_credit_accounts
               SET saldo_actual = GREATEST(0, saldo_actual - OLD.total_amount)
               WHERE id = v_credit_acc_id;

               -- Eliminar movimientos
               DELETE FROM public.customer_credit_movements WHERE accounting_transaction_id = v_tx_id;
           END IF;
       END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
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
```

---

## 3. Requerimiento Técnico Edge Function (Deno)

Ubicación: [index.ts](file:///c:/Users/juanr/OneDrive/Escritorio/Proyectos/Beast-Driven-Development/supabase/functions/autorizar-comprobante/index.ts)

Se debe configurar un timeout estricto de **15 segundos** para impedir que la Edge Function sea terminada a la fuerza por la infraestructura de Supabase cuando AFIP está caído, permitiendo atrapar el error en el bloque `catch` y registrar el estado `'error_temporal'` de manera consistente.

### Implementación del Timeout en Deno Fetch:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

try {
  const caeResponse = await fetch(wsfeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=UTF-8",
      "SOAPAction": "http://ar.gov.afip.dif.FEV1/FECAESolicitar"
    },
    body: caeSoapEnvelope,
    signal: controller.signal // Inyectar señal de cancelación
  });
  
  clearTimeout(timeoutId); // Limpiar timeout si responde a tiempo
  ...
} catch (err: any) {
  clearTimeout(timeoutId);
  if (err.name === "AbortError") {
    throw new Error("Timeout: El servidor de AFIP no respondió dentro de los 15 segundos permitidos.");
  }
  throw err;
}
```
Esto mismo debe aplicarse a la llamada de `FECompUltimoAutorizado` para evitar bloqueos secuenciales.
