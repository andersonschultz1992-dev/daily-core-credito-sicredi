# Prompt técnico — Daily Core & Crédito v9.0

> Use este texto como especificação para futuras evoluções. As alterações abaixo **já estão implementadas** no ZIP v9.0, salvo onde explicitamente indicado.

## Contexto e arquitetura

Atue como engenheira de software sênior especializada em HTML5, CSS3, JavaScript Vanilla, GitHub Pages, Supabase/PostgreSQL e compatibilidade Safari iOS, Chrome, Edge e Firefox. Evolua o projeto **Daily Core & Crédito – Sicredi** sem introduzir frameworks, builds, servidores próprios ou autenticação inexistente. Preserve o HTML/CSS/JS existentes, os temas Escuro, Claro e Cooperativo, os cartões de analistas, os destaques e biblioteca com 34 opções, a exportação PNG, links de compartilhamento, a agenda histórica, a conexão Supabase e as funções RPC de bloqueio global de edição. Nunca sobrescreva o histórico das dailies nem altere desnecessariamente `js/config.js`.

## Requisito 1 — Agenda de Dailies agrupada por mês

1. Agrupar datas já salvas em seções **Mês Ano**, por exemplo **Novembro 2026**, **Outubro 2026**.
2. Ordenar grupos e respectivas dailies por data decrescente.
3. Mostrar quantidade de dailies por mês e permitir expandir/recolher cada seção com `<details>/<summary>` acessíveis, inclusive ao toque no iPhone.
4. Abrir automaticamente o mês da daily exibida e preservar outros grupos expandidos durante atualizações da interface.
5. Manter tags **Hoje** e **Futura**, realce do dia selecionado e a navegação de um clique sem recarregar a página.
6. Agrupar também o seletor de data por `<optgroup>` de mês/ano, mantendo o date picker para dias futuros e rascunhos.
7. Não criar novas dailies vazias no banco, e não quebrar a barra lateral no desktop nem o painel flutuante mobile.

## Requisito 2 — Interface Entrega Trimestral

1. Disponibilizar no topo da aplicação um menu com **Agenda de Dailies** e **Entrega Trimestral**, com indicação clara da página ativa.
2. Abrir `entrega-trimestral.html` ao selecionar a nova página, usando links relativos, compatíveis com a subpasta do GitHub Pages.
3. Reaproveitar o design institucional e os três temas. Persistir a preferência de tema com a mesma chave de LocalStorage usada pela daily, sem guardar registros de negócio em LocalStorage.
4. A nova interface contém **Novo registro**, **Editar**, **Excluir**, formulário acessível e dados obrigatórios:
   - **Owners**: nomes dos responsáveis, texto (permitir mais de um, separados por vírgula);
   - **Número do épico**: texto para aceitar identificadores como `DEVOPS-1234`;
   - **Iniciativa**: descrição livre, multiline;
   - **Data de entrega**: input nativo `date` (YYYY-MM-DD no banco).
5. Derivar trimestre e ano da **data de entrega**, sem armazenar ou exigir um trimestre preenchido manualmente.
6. Persistir o histórico independente das dailies numa tabela PostgreSQL separada (`public.entregas_trimestrais`), com UUID, `created_at`, `updated_at`, índice de data e RLS compatível com o projeto atual.
7. Exibir entregas do banco agrupadas em **1º, 2º, 3º ou 4º trimestre de AAAA**, das mais recentes para as antigas. Exibir colunas owners, épico, iniciativa, data e ações.
8. Implementar pesquisa por owner, épico e iniciativa; filtros de ano e trimestre; e indicadores de total, trimestre vigente e número de trimestres com entregas. Consultar o banco em páginas para não truncar históricos grandes.
9. No CRUD, exigir aquisição do **mesmo bloqueio global do projeto** (`daily-core-credito-global`), via RPCs `acquire_app_edit_lock`, `renew_app_edit_lock` e `release_app_edit_lock`. Manter heartbeat, verificar posse antes de salvar/excluir e liberar ao salvar, cancelar ou sair, com expiração automática em falha. Impedir acesso de outro editor simultâneo tanto na daily quanto na trimestral.
10. Validar entradas, escapar dados antes de montar HTML, indicar erros de rede/migração, mostrar confirmações de exclusão e somente anunciar persistência depois de confirmação pelo Supabase.
11. Manter compatibilidade em smartphone, especialmente Safari iPhone, sem overflow horizontal da página; permitir rolagem interna da tabela no mobile e campos touch-friendly.

## Requisito 3 — SQL e implantação segura

1. Entregar `supabase/migration-entregas-trimestrais.sql` incremental, reexecutável, sem `DROP TABLE` nem exclusão de registros antigos. Para ambientes novos, incluir a tabela no `supabase/schema.sql` completo.
2. Para **bancos já existentes**, instruir a executar **apenas** `migration-entregas-trimestrais.sql`; o antigo `migration-edit-lock.sql` não precisa ser reexecutado quando o bloqueio existente já funciona.
3. Manter inalterados os dados das tabelas `dailies`, `analistas`, `entregas`, `destaques`, `destaques_cabecalho`, `app_edit_locks`.
4. Preservar `js/config.js` do ZIP entregue (Supabase público já configurado). Nunca adicionar `service_role` ao frontend.
5. Alertar que o projeto original usa RLS aberta para `anon`/`authenticated`, sem login: bloqueio de edição via frontend **não** é uma proteção de segurança contra requisições diretas à API. Recomendar Supabase Auth/RLS restritiva para dados sensíveis.
6. Preparar um ZIP com `index.html` e `entrega-trimestral.html` na raiz, subpastas `css/`, `js/`, `assets/`, `supabase/`, README atualizado e este prompt. Não incluir `node_modules` nem arquivos temporários. Toda navegação deve funcionar com caminhos relativos.

## Critérios mínimos de aceite

- Consigo abrir a Agenda de Dailies com meses agrupados, expandir e navegar pelas datas salvas, mantendo todo o conteúdo anterior.
- Consigo acessar a página Entrega Trimestral, cadastrar um épico, atualizar sua iniciativa, recarregar o navegador e reencontrar o registro por ano e trimestre.
- Consigo excluir um registro trimestral após confirmação, sem alterar qualquer daily.
- Enquanto alguém edita a daily, outro navegador não consegue editar uma entrega trimestral; o inverso também vale.
- A aplicação funciona tanto em GitHub Pages quanto em um servidor HTTP local, em telas desktop e mobile.
- A migração SQL incremental não remove nem altera registros preexistentes.
- Os navegadores sem conexão ou sem tabela nova mostram erro explícito, sem fingir que dados foram salvos.
