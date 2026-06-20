-- ================================================================
-- DAILY CORE & CRÉDITO — Schema Supabase v3.0 (sem IA, sem login)
-- Confederação Sicredi · Time DevOps Core & Crédito
--
-- Execute no SQL Editor do seu projeto Supabase.
--
-- Filosofia desta versão:
--   - Sem Edge Functions, sem IA, sem chaves de API pagas.
--   - Sem autenticação: qualquer pessoa com o link do app pode
--     visualizar E editar/salvar, exatamente como funcionava antes
--     (quando os dados ficavam só no localStorage do navegador).
--     Agora os dados ficam no Supabase para criar histórico
--     permanente e compartilhado entre todos os dispositivos.
--   - Os destaques executivos do cabeçalho (1 a 4 por daily) são
--     escolhidos de uma biblioteca local pré-definida (ver
--     js/destaques.js) — não há geração nem chamada externa
--     nenhuma envolvida. Ver tabela destaques_cabecalho.
--   - v3.0: suporte a MÚLTIPLOS destaques no cabeçalho (antes era
--     apenas 1, guardado direto em colunas de "dailies"). Quem já
--     tinha o schema v2.0 em produção: este script migra os dados
--     automaticamente e remove as colunas antigas — basta rodar de
--     novo no SQL Editor (idempotente, seguro reexecutar).
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- TABELAS
-- ================================================================

-- Daily: cada reunião de acompanhamento, uma por data (UNIQUE)
CREATE TABLE IF NOT EXISTS public.dailies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data_daily      DATE        NOT NULL UNIQUE,
  titulo          TEXT        NOT NULL DEFAULT 'Principais Entregas da Semana',
  subtitulo       TEXT        NOT NULL DEFAULT 'Time Core & Crédito',
  descricao       TEXT        DEFAULT 'Resultados, melhorias operacionais, estabilidade e evolução contínua dos ambientes.',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.dailies IS 'Cada registro representa uma reunião Daily do time DevOps, uma por data.';

-- Analistas: membros do time em cada daily (roster do dia)
CREATE TABLE IF NOT EXISTS public.analistas (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_id      UUID        NOT NULL REFERENCES public.dailies(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  cargo         TEXT        NOT NULL DEFAULT 'Analista SRE e DevOps',
  foto          TEXT        DEFAULT '',
  badge_numero  TEXT        DEFAULT '',
  badge_texto   TEXT        DEFAULT '',
  badge_icone   TEXT        DEFAULT 'fa-solid fa-chart-line',
  cor_tema      TEXT        DEFAULT '#259A6C',
  tags          TEXT[]      DEFAULT ARRAY['SRE', 'DevOps'],
  ordem         INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.analistas IS 'Membros do time para cada daily. Ao criar uma nova daily, o roster é copiado da daily anterior com entregas vazias.';

-- Entregas: itens de entrega por analista por daily
CREATE TABLE IF NOT EXISTS public.entregas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_id    UUID        NOT NULL REFERENCES public.dailies(id) ON DELETE CASCADE,
  analista_id UUID        NOT NULL REFERENCES public.analistas(id) ON DELETE CASCADE,
  texto       TEXT        NOT NULL,
  ordem       INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.entregas IS 'Entregas individuais por analista e daily. Vazias por padrão em uma daily recém-criada.';

-- Destaques: bullets do rodapé "Destaques da Semana" (lista livre,
-- editada diretamente no app — sem relação com a biblioteca do
-- destaque principal do cabeçalho).
CREATE TABLE IF NOT EXISTS public.destaques (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_id  UUID        NOT NULL REFERENCES public.dailies(id) ON DELETE CASCADE,
  texto     TEXT        NOT NULL,
  icone     TEXT        DEFAULT 'fa-solid fa-star',
  ordem     INTEGER     DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.destaques IS 'Bullets do rodapé "Destaques da Semana", editados livremente no modo edição do app.';

-- Destaques do CABEÇALHO: até 4 por daily, escolhidos manualmente da
-- biblioteca local (js/destaques.js). Tabela separada de "destaques"
-- (rodapé) — são conceitos diferentes: aqui o texto/ícone/cor vêm
-- sempre de uma opção fixa da biblioteca (por isso guardamos também
-- "chave", para re-selecionar o item certo ao reabrir a daily);
-- no rodapé o texto é livre.
CREATE TABLE IF NOT EXISTS public.destaques_cabecalho (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_id  UUID        NOT NULL REFERENCES public.dailies(id) ON DELETE CASCADE,
  chave     TEXT        NOT NULL,   -- chave do item em DESTAQUES_BIBLIOTECA (js/destaques.js)
  texto     TEXT        NOT NULL,
  icone     TEXT        NOT NULL,
  cor       TEXT        NOT NULL,
  ordem     INTEGER     DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.destaques_cabecalho IS 'Até 4 destaques executivos exibidos no cabeçalho, escolhidos manualmente da biblioteca local em js/destaques.js.';

-- ================================================================
-- MIGRAÇÃO: destaque único legado → destaques_cabecalho (múltiplos)
-- ----------------------------------------------------------------
-- Versões anteriores guardavam um único destaque do cabeçalho direto
-- em dailies.destaque_texto/destaque_icone/destaque_cor. Esta versão
-- permite de 1 a 4 destaques por daily, guardados na tabela acima.
-- Bloco idempotente: só faz algo se as colunas legadas ainda
-- existirem (seguro rodar este script várias vezes).
-- ================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dailies' AND column_name = 'destaque_texto'
  ) THEN
    -- Copia o destaque único de cada daily (quando preenchido) para a
    -- nova tabela, apenas se ela ainda não tiver nenhum registro para
    -- aquela daily (evita duplicar em reexecuções parciais).
    INSERT INTO public.destaques_cabecalho (daily_id, chave, texto, icone, cor, ordem)
    SELECT d.id, 'legado', d.destaque_texto, d.destaque_icone, d.destaque_cor, 0
    FROM public.dailies d
    WHERE d.destaque_texto IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.destaques_cabecalho dc WHERE dc.daily_id = d.id
      );

    -- Remove as colunas legadas — não são mais usadas pelo app.
    ALTER TABLE public.dailies DROP COLUMN IF EXISTS destaque_texto;
    ALTER TABLE public.dailies DROP COLUMN IF EXISTS destaque_icone;
    ALTER TABLE public.dailies DROP COLUMN IF EXISTS destaque_cor;
  END IF;
END;
$$;

-- ================================================================
-- ÍNDICES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_dailies_data      ON public.dailies(data_daily DESC);
CREATE INDEX IF NOT EXISTS idx_analistas_daily   ON public.analistas(daily_id, ordem);
CREATE INDEX IF NOT EXISTS idx_entregas_analista ON public.entregas(analista_id, ordem);
CREATE INDEX IF NOT EXISTS idx_entregas_daily    ON public.entregas(daily_id);
CREATE INDEX IF NOT EXISTS idx_destaques_daily   ON public.destaques(daily_id, ordem);
CREATE INDEX IF NOT EXISTS idx_destaques_cabecalho_daily ON public.destaques_cabecalho(daily_id, ordem);

-- ================================================================
-- TRIGGER: updated_at automático em dailies
-- ================================================================
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dailies_updated_at ON public.dailies;
CREATE TRIGGER trg_dailies_updated_at
  BEFORE UPDATE ON public.dailies
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ================================================================
-- TRIGGER: limite de 4 destaques de cabeçalho por daily
-- ----------------------------------------------------------------
-- O app já impede escolher mais de 4 destaques na interface — este
-- trigger é uma segunda camada de proteção no banco (defesa em
-- profundidade), caso algum INSERT chegue por outro caminho.
-- ================================================================
CREATE OR REPLACE FUNCTION public.fn_limitar_destaques_cabecalho()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.destaques_cabecalho WHERE daily_id = NEW.daily_id) >= 4 THEN
    RAISE EXCEPTION 'Máximo de 4 destaques de cabeçalho por daily (daily_id=%)', NEW.daily_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limitar_destaques_cabecalho ON public.destaques_cabecalho;
CREATE TRIGGER trg_limitar_destaques_cabecalho
  BEFORE INSERT ON public.destaques_cabecalho
  FOR EACH ROW EXECUTE FUNCTION public.fn_limitar_destaques_cabecalho();

-- ================================================================
-- ROW LEVEL SECURITY (RLS) — ABERTO, SEM AUTENTICAÇÃO
-- ----------------------------------------------------------------
-- Por requisito explícito do projeto, NÃO há sistema de login: o
-- app é uma ferramenta interna de equipe, e qualquer pessoa com o
-- link pode visualizar E editar/salvar — reproduzindo o mesmo nível
-- de confiança que já existia quando os dados ficavam apenas no
-- localStorage do navegador de cada um.
--
-- IMPORTANTE: a chave "anon" do Supabase fica embutida no código
-- público do GitHub Pages. Com as políticas abaixo, ela permite
-- INSERT/UPDATE/DELETE em todas as tabelas. Use este modelo apenas
-- para um app interno de baixo risco (como esta Daily). Se no
-- futuro for necessário restringir quem pode editar, basta trocar
-- as políticas de escrita abaixo por algo como
-- `USING (auth.role() = 'authenticated')` e habilitar login no
-- Supabase Authentication.
-- ================================================================
ALTER TABLE public.dailies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destaques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destaques_cabecalho ENABLE ROW LEVEL SECURITY;

-- Leitura pública
CREATE POLICY "dailies_leitura_publica"   ON public.dailies   FOR SELECT USING (true);
CREATE POLICY "analistas_leitura_publica" ON public.analistas FOR SELECT USING (true);
CREATE POLICY "entregas_leitura_publica"  ON public.entregas  FOR SELECT USING (true);
CREATE POLICY "destaques_leitura_publica" ON public.destaques FOR SELECT USING (true);
CREATE POLICY "destaques_cabecalho_leitura_publica" ON public.destaques_cabecalho FOR SELECT USING (true);

-- Escrita pública (sem autenticação — ver nota acima)
CREATE POLICY "dailies_escrita_publica"
  ON public.dailies FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "analistas_escrita_publica"
  ON public.analistas FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "entregas_escrita_publica"
  ON public.entregas FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "destaques_escrita_publica"
  ON public.destaques FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "destaques_cabecalho_escrita_publica"
  ON public.destaques_cabecalho FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- DADOS DE EXEMPLO (seed inicial)
-- ----------------------------------------------------------------
-- Se a tabela "dailies" estiver completamente vazia, semeia a daily
-- de hoje com o roster padrão do time. Isso é só uma conveniência
-- para o primeiro acesso — o app também sabe criar a daily do dia
-- automaticamente sozinho (ver js/app.js), então rodar este bloco
-- não é estritamente obrigatório.
-- ================================================================
DO $$
DECLARE
  v_daily_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dailies LIMIT 1) THEN

    INSERT INTO public.dailies (data_daily, titulo, subtitulo, descricao)
    VALUES (CURRENT_DATE, 'Principais Entregas da Semana', 'Time Core & Crédito',
            'Resultados, melhorias operacionais, estabilidade e evolução contínua dos ambientes.')
    RETURNING id INTO v_daily_id;

    INSERT INTO public.analistas (daily_id, nome, cargo, foto, cor_tema, tags, ordem) VALUES
      (v_daily_id, 'Anderson Schultz Ribeiro',      'Analista SRE e DevOps PL', 'assets/fotos/anderson.jpg', '#259A6C', ARRAY['SRE','DevOps'], 0),
      (v_daily_id, 'Diego Gonçalves de Oliveira',   'Analista SRE e DevOps SR', 'assets/fotos/diego.jpg',    '#357F82', ARRAY['SRE','DevOps'], 1),
      (v_daily_id, 'Gilson Batista da Silva Souza', 'Analista SRE e DevOps SR', 'assets/fotos/gilson.jpg',   '#6F8794', ARRAY['SRE','DevOps'], 2),
      (v_daily_id, 'Matheus da Silva de Farias',    'Analista SRE e DevOps JR', 'assets/fotos/matheus.jpg',  '#BB9748', ARRAY['SRE','DevOps'], 3);

    -- Entregas iniciam vazias propositalmente (ver requisito do projeto)
    -- — nenhum INSERT em "entregas" aqui.

  END IF;
END;
$$;
