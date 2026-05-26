-- MIGRATION: FIX SUPABASE SECURITY WARNINGS AND DATABASE LINTS
-- Path: scripts/07_fix_supabase_warnings.sql
-- Description: Corrige warnings de search_path mutable, políticas RLS demasiado permisivas (bypasses) y exposición pública de funciones SECURITY DEFINER.

-- ==========================================
-- 1. CORRECCIÓN DE SEARCH_PATH Y PRIVILEGIOS DE FUNCIONES
-- ==========================================

-- A. Función: handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- B. Función: buscar_articulos_inteligente
ALTER FUNCTION public.buscar_articulos_inteligente(text, uuid, uuid, text) SET search_path = public, pg_catalog;

-- C. Función: crear_asiento_venta (varias firmas en la base de datos)
ALTER FUNCTION public.crear_asiento_venta(text, text, text, numeric, numeric, numeric, boolean) SET search_path = public, pg_catalog;
ALTER FUNCTION public.crear_asiento_venta(text, text, text, numeric, numeric, numeric, boolean, text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.crear_asiento_venta(text, text, text, numeric, numeric, numeric, boolean, text, text) SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.crear_asiento_venta(text, text, text, numeric, numeric, numeric, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crear_asiento_venta(text, text, text, numeric, numeric, numeric, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crear_asiento_venta(text, text, text, numeric, numeric, numeric, boolean, text, text) FROM PUBLIC, anon, authenticated;

-- Otorgar permiso de ejecución de la firma activa a usuarios autenticados (requerido por el frontend)
GRANT EXECUTE ON FUNCTION public.crear_asiento_venta(text, text, text, numeric, numeric, numeric, boolean, text, text) TO authenticated;

-- D. Función: decrementar_stock_lote
ALTER FUNCTION public.decrementar_stock_lote(jsonb) SET search_path = public, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.decrementar_stock_lote(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrementar_stock_lote(jsonb) TO authenticated;

-- E. Función: update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- F. Función: validar_asiento_balanceado
ALTER FUNCTION public.validar_asiento_balanceado() SET search_path = public, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.validar_asiento_balanceado() FROM PUBLIC, anon, authenticated;

-- G. Función: registrar_movimiento_caja
ALTER FUNCTION public.registrar_movimiento_caja(text, text, numeric, uuid, text) SET search_path = public, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.registrar_movimiento_caja(text, text, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento_caja(text, text, numeric, uuid, text) TO authenticated;


-- ==========================================
-- 2. CORRECCIÓN DE POLÍTICAS RLS PERMISIVAS (BYPASSES DE SEGURIDAD)
-- ==========================================

-- A. Tabla: alicuota_iva
-- Eliminar la política que permite gestión completa a cualquier usuario autenticado
DROP POLICY IF EXISTS "Permitir gestión completa a usuarios autenticados" ON public.alicuota_iva;
-- Crear una política restringida que permita modificar alícuotas solo a administradores
CREATE POLICY "Permitir escritura a administradores" ON public.alicuota_iva
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'admin'::user_role));

-- B. Tabla: arca_access_tickets
-- Eliminar el bypass de seguridad crítico que permitía ALL a anon y authenticated
DROP POLICY IF EXISTS "Permitir select/insert/update de tickets a anon y authenticated" ON public.arca_access_tickets;

-- C. Tabla: arca_padron_cache
-- Eliminar la política de escritura indiscriminada para cualquier autenticado
DROP POLICY IF EXISTS "authenticated_padron_cache_write" ON public.arca_padron_cache;
-- Reemplazarla con una política que permita a los usuarios autenticados insertar registros para poblar el caché
CREATE POLICY "authenticated_padron_cache_insert" ON public.arca_padron_cache
  FOR INSERT TO authenticated
  WITH CHECK (true);
-- Los administradores pueden gestionar completamente el caché (UPDATE/DELETE/ALL)
CREATE POLICY "admin_padron_cache_all" ON public.arca_padron_cache
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'admin'::user_role));

-- D. Tabla: arca_remitos
-- Eliminar el bypass del aislamiento multi-tenant (project_admin_policy permitía USING(true) a todos)
DROP POLICY IF EXISTS "project_admin_policy" ON public.arca_remitos;
-- Permitir acceso completo a remitos de cualquier tenant exclusivamente a administradores globales
CREATE POLICY "platform_admin_remitos_policy" ON public.arca_remitos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'admin'::user_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'admin'::user_role));
