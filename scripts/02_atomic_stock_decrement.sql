-- MIGRATION: ATOMIC STOCK DECREMENT IN LOTS
-- Path: scripts/02_atomic_stock_decrement.sql

CREATE OR REPLACE FUNCTION public.decrementar_stock_lote(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item jsonb;
    v_id uuid;
    v_cantidad integer;
BEGIN
    -- Iterar sobre el array JSONB enviado desde el POS de forma atómica
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id := (v_item->>'id')::uuid;
        v_cantidad := (v_item->>'cantidad')::integer;
        
        -- Actualización atómica de existencias físicas.
        -- Se restringe con GREATEST a 0 por política de negocio física.
        UPDATE public.articulo
        SET stock_actual = GREATEST(0, stock_actual - v_cantidad)
        WHERE id = v_id;
    END LOOP;
END;
$$;
