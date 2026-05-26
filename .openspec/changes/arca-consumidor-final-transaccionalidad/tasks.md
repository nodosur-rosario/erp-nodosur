# Checklist de Tareas: Consistencia Fiscal y Transaccional de AFIP

- [ ] **Fase 1: Base de Datos (PostgreSQL Migration)**
  - [ ] Crear el script de migración SQL `scripts/04_arca_compensation_trigger.sql` con la función de reversión `fn_revertir_efectos_venta` y los triggers asociados en `arca_vouchers`.
  - [ ] Inyectar el script de migración en el servidor Supabase local / remoto usando la herramienta de base de datos.
  - [ ] Verificar que los triggers y funciones se compilaron sin advertencias en Postgres.

- [ ] **Fase 2: Frontend (POS Validaciones)**
  - [ ] Editar [ventas/page.tsx](file:///c:/Users/juanr/OneDrive/Escritorio/Proyectos/Beast-Driven-Development/src/app/protected/%28dashboard%29/ventas/page.tsx) en `handleCheckout` para interceptar y validar límites de Consumidor Final:
    - [ ] Límite Efectivo: $191.104
    - [ ] Límite Tarjeta/Transferencia: $382.208
  - [ ] Agregar validación estricta para Factura A (requerir CUIT de 11 dígitos, Responsable Inscripto y distinto a 99999999999).
  - [ ] Verificar que las alertas toast se despliegan de forma amigable y el flujo de checkout se interrumpe preventivamente.

- [ ] **Fase 3: Edge Function (Timeouts e Inestabilidad)**
  - [ ] Editar [index.ts](file:///c:/Users/juanr/OneDrive/Escritorio/Proyectos/Beast-Driven-Development/supabase/functions/autorizar-comprobante/index.ts) para implementar `AbortController`.
  - [ ] Configurar un timeout de 15 segundos para la llamada SOAP de `FECompUltimoAutorizado`.
  - [ ] Configurar un timeout de 15 segundos para la llamada SOAP de `FECAESolicitar`.
  - [ ] Desplegar o actualizar la Edge Function de Supabase (`autorizar-comprobante`).

- [ ] **Fase 4: Verificación y Testing de Integridad**
  - [ ] **Prueba de POS**:
    - [ ] Simular checkout a CF en efectivo por $200.000. Verificar que se bloquea preventivamente.
    - [ ] Simular checkout a CF con tarjeta por $400.000. Verificar que se bloquea preventivamente.
  - [ ] **Prueba de Integridad del Trigger**:
    - [ ] Registrar un comprobante provisional que falle en la autorización de AFIP (forzando un error en homologación o simulación).
    - [ ] Validar que una vez rechazado, el stock del repuesto en `articulo` incrementa en su cantidad de vuelta automáticamente.
    - [ ] Validar que la contabilidad (`accounting_transactions` y `accounting_entries`) se limpia sin dejar huérfanos.
    - [ ] Validar que los movimientos de caja y saldos de cuentas corrientes se cancelan.
    - [ ] Eliminar un voucher provisional no autorizado (`DELETE`) y validar que el stock se restituye y la contabilidad se anula instantáneamente.
