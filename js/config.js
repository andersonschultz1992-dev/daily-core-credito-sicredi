/**
 * Daily Core & Crédito — Configuração do Supabase
 * ─────────────────────────────────────────────────
 * Edite este arquivo com as suas credenciais do projeto Supabase.
 * A chave anon/public é segura para uso no frontend (controlada por RLS
 * — veja supabase/schema.sql para as políticas).
 *
 * Como obter:
 *   1. Acesse https://supabase.com/dashboard → seu projeto
 *   2. Settings → API
 *   3. Copie "Project URL" e "anon / public" key
 *
 * O Supabase é a ÚNICA fonte de dados desta aplicação (não há mais
 * arquivo JSON local). Enquanto as credenciais abaixo não forem
 * preenchidas, o app exibe um conjunto de dados de demonstração
 * (fixo, sem rede) apenas para a tela não ficar em branco — nenhuma
 * edição feita nesse modo é salva em lugar nenhum.
 */
window.SUPABASE_CONFIG = {
  url:     'https://XXXXXXXXXX.supabase.co',  // ← sua Project URL
  anonKey: '',                                 // ← sua chave anon/public
};
