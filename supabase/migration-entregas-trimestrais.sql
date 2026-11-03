-- ==============================================================
-- DAILY CORE & CRÉDITO v9.0 | MIGRAÇÃO INCREMENTAL
-- Entrega Trimestral: dados persistidos por registro no Supabase.
--
-- PARA BANCOS EXISTENTES: execute SOMENTE este arquivo no SQL Editor.
-- Seguro reexecutar: não apaga dados nem duplica tabelas/políticas.
-- Não altera dailies/analistas/entregas/destaques/locks.
-- O trimestre é calculado da data_entrega no front-end (não duplica dado).
-- ==============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.entregas_trimestrais (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owners       TEXT        NOT NULL CHECK (length(btrim(owners)) > 0),
  numero_epico TEXT        NOT NULL CHECK (length(btrim(numero_epico)) > 0),
  iniciativa   TEXT        NOT NULL CHECK (length(btrim(iniciativa)) > 0),
  data_entrega DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.entregas_trimestrais IS
  'Histórico independente de entregas por trimestre do time Core & Crédito: owners, épico, iniciativa e data de entrega.';

CREATE INDEX IF NOT EXISTS idx_entregas_trimestrais_data
  ON public.entregas_trimestrais(data_entrega DESC);
CREATE INDEX IF NOT EXISTS idx_entregas_trimestrais_epico
  ON public.entregas_trimestrais(numero_epico);

CREATE OR REPLACE FUNCTION public.fn_entregas_trimestrais_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entregas_trimestrais_updated_at ON public.entregas_trimestrais;
CREATE TRIGGER trg_entregas_trimestrais_updated_at
  BEFORE UPDATE ON public.entregas_trimestrais
  FOR EACH ROW EXECUTE FUNCTION public.fn_entregas_trimestrais_updated_at();

ALTER TABLE public.entregas_trimestrais ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: mantém o comportamento de acesso público/anon do app atual.
-- Como o GitHub Pages é público, qualquer pessoa com a URL consegue
-- consultar e modificar os dados. O bloqueio no front-end é cooperativo,
-- não é autenticação/controle de acesso no banco. Para dados sensíveis,
-- considere Supabase Auth + RLS restritiva (mudança arquitetural futura).
DROP POLICY IF EXISTS "entregas_trimestrais_leitura_publica" ON public.entregas_trimestrais;
CREATE POLICY "entregas_trimestrais_leitura_publica"
  ON public.entregas_trimestrais FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "entregas_trimestrais_escrita_publica" ON public.entregas_trimestrais;
CREATE POLICY "entregas_trimestrais_escrita_publica"
  ON public.entregas_trimestrais FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas_trimestrais TO anon, authenticated;

-- Verificação opcional no SQL Editor:
-- SELECT id, owners, numero_epico, iniciativa, data_entrega, created_at, updated_at
-- FROM public.entregas_trimestrais ORDER BY data_entrega DESC LIMIT 20;
