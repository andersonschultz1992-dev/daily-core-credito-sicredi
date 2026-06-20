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
  url:     'https://nijnyjfagbujxiugduge.supabase.co',  // ← sua Project URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pam55amZhZ2J1anhpdWdkdWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NzA0MjcsImV4cCI6MjA5NzU0NjQyN30.yX6qrNm0UYKabWCuqUQ83WncRYBfl55qCL2WUa6kU80',                                 // ← sua chave anon/public
};
