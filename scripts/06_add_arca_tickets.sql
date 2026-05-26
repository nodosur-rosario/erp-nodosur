-- Migración: Tabla de Caché de Tickets de Acceso (WSAA)
-- Permite persistir y compartir los tokens y firmas del WSAA entre instancias Serverless de Next.js
-- para evitar cold starts redundantes y bloqueos de IP de ARCA / AFIP.

CREATE TABLE IF NOT EXISTS public.arca_access_tickets (
  cuit VARCHAR(11) NOT NULL,
  service VARCHAR(20) NOT NULL, -- ej: 'wsfe', 'ws_sr_padron_a4'
  token TEXT NOT NULL,
  sign TEXT NOT NULL,
  expired_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (cuit, service)
);

-- Habilitar Row Level Security (RLS) para evitar lecturas directas del frontend sin service_role
ALTER TABLE public.arca_access_tickets ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS con casteo explícito de UUID a TEXT:
CREATE POLICY "Permitir lectura y escritura total al backend"
  ON public.arca_access_tickets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir lectura de tickets a administradores"
  ON public.arca_access_tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()::text
      AND public.users.role = 'admin'
    )
  );

COMMENT ON TABLE public.arca_access_tickets IS 'Tabla de caché para persistencia temporal (12hs) de credenciales dinámicas WSAA (Token y Sign) por CUIT y servicio.';
