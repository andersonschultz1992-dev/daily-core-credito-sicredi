/**
 * Daily Core & Crédito — js/destaques.js
 * ────────────────────────────────────────────
 * Biblioteca de destaques executivos PRÉ-DEFINIDOS.
 *
 * Esta é a substituição definitiva da geração por IA: em vez de pedir
 * para um modelo de linguagem (pago ou não) redigir o destaque da
 * semana, a pessoa que está editando a Daily ESCOLHE um destaque
 * pronto desta lista no seletor que aparece em Modo Edição.
 *
 * Sem rede, sem custo, sem dependência externa — é apenas um array
 * JavaScript estático.
 *
 * Cada item tem:
 *   chave  → identificador único (string), usado pelo <select>
 *   texto  → frase exibida no destaque do cabeçalho
 *   icone  → classe Font Awesome 6
 *   cor    → cor de destaque (hex), alinhada à paleta "Cooperativismo
 *            Tech" do projeto (verde institucional, petróleo, dourado,
 *            cinza corporativo, âmbar de atenção)
 *
 * Para adicionar/editar destaques, edite apenas o array abaixo —
 * nenhuma outra alteração de código é necessária.
 */
window.DESTAQUES_BIBLIOTECA = [
  { chave: 'observabilidade',      texto: 'Evolução da observabilidade dos ambientes',          icone: 'fa-solid fa-chart-line',              cor: '#259A6C' },
  { chave: 'suporte',              texto: 'Suporte contínuo e sustentação dos ambientes',        icone: 'fa-solid fa-headset',                 cor: '#357F82' },
  { chave: 'automacao',            texto: 'Evolução da automação operacional',                   icone: 'fa-solid fa-gears',                   cor: '#BB9748' },
  { chave: 'pipelines',            texto: 'Aceleração dos pipelines de entrega',                 icone: 'fa-solid fa-rocket',                  cor: '#259A6C' },
  { chave: 'estabilidade',         texto: 'Fortalecimento da estabilidade operacional',          icone: 'fa-solid fa-shield-halved',           cor: '#357F82' },
  { chave: 'nuvem',                texto: 'Evolução dos ambientes em nuvem',                     icone: 'fa-solid fa-cloud',                   cor: '#259A6C' },
  { chave: 'indicadores',          texto: 'Ampliação da visibilidade dos indicadores',           icone: 'fa-solid fa-chart-pie',               cor: '#BB9748' },
  { chave: 'monitoracao-proativa', texto: 'Aprimoramento da monitoração proativa',               icone: 'fa-solid fa-magnifying-glass-chart',  cor: '#357F82' },
  { chave: 'deploy',               texto: 'Otimização dos processos de deploy',                  icone: 'fa-solid fa-arrows-rotate',           cor: '#259A6C' },
  { chave: 'releases',             texto: 'Evolução da gestão de releases',                      icone: 'fa-solid fa-box-archive',             cor: '#BB9748' },
  { chave: 'tratativas-criticas',  texto: 'Tratativas críticas em produção',                     icone: 'fa-solid fa-fire',                    cor: '#D6A23B' },
  { chave: 'infraestrutura',       texto: 'Evolução da infraestrutura corporativa',              icone: 'fa-solid fa-network-wired',           cor: '#357F82' },
  { chave: 'cobertura-monitor',    texto: 'Ampliação da cobertura de monitoramento',             icone: 'fa-solid fa-satellite-dish',          cor: '#259A6C' },
  { chave: 'backups',              texto: 'Melhoria na gestão de backups',                       icone: 'fa-solid fa-database',                cor: '#BB9748' },
  { chave: 'seguranca',            texto: 'Reforço das práticas de segurança operacional',       icone: 'fa-solid fa-lock',                    cor: '#357F82' },
  { chave: 'integracao-times',     texto: 'Integração entre times e ferramentas',                icone: 'fa-solid fa-puzzle-piece',            cor: '#259A6C' },
  { chave: 'capacidade',           texto: 'Expansão da capacidade dos ambientes',                icone: 'fa-solid fa-server',                  cor: '#BB9748' },
  { chave: 'manutencao-preventiva',texto: 'Manutenção preventiva dos sistemas críticos',         icone: 'fa-solid fa-screwdriver-wrench',      cor: '#357F82' },
  { chave: 'padronizacao',         texto: 'Padronização de processos operacionais',              icone: 'fa-solid fa-clipboard-list',          cor: '#259A6C' },
  { chave: 'tempo-atendimento',    texto: 'Redução do tempo médio de atendimento',               icone: 'fa-solid fa-stopwatch',               cor: '#BB9748' },
  { chave: 'qualidade',            texto: 'Evolução das práticas de testes e qualidade',         icone: 'fa-solid fa-flask',                   cor: '#357F82' },
  { chave: 'integracao-continua',  texto: 'Integração contínua entre ambientes',                 icone: 'fa-solid fa-link',                    cor: '#259A6C' },
  { chave: 'reducao-incidentes',   texto: 'Redução de incidentes operacionais',                  icone: 'fa-solid fa-arrow-trend-down',        cor: '#259A6C' },
  { chave: 'middleware',           texto: 'Evolução do middleware corporativo',                  icone: 'fa-solid fa-toolbox',                 cor: '#BB9748' },
  { chave: 'governanca-dados',     texto: 'Organização e governança de dados',                   icone: 'fa-solid fa-folder-tree',             cor: '#357F82' },
  { chave: 'modernizacao-monitor', texto: 'Modernização da infraestrutura de monitoramento',     icone: 'fa-solid fa-satellite',               cor: '#259A6C' },
  { chave: 'arquitetura',          texto: 'Fortalecimento da arquitetura de ambientes',          icone: 'fa-solid fa-cubes',                   cor: '#BB9748' },
  { chave: 'performance',          texto: 'Ajustes finos de performance operacional',            icone: 'fa-solid fa-wrench',                  cor: '#357F82' },
  { chave: 'direcionamento',       texto: 'Direcionamento estratégico das entregas técnicas',    icone: 'fa-solid fa-compass',                 cor: '#259A6C' },
  { chave: 'atualizacao-versoes',  texto: 'Atualização de versões críticas em produção',         icone: 'fa-solid fa-arrow-up',                cor: '#BB9748' },
  { chave: 'resposta-incidentes',  texto: 'Resposta rápida a incidentes críticos',               icone: 'fa-solid fa-fire-extinguisher',       cor: '#D6A23B' },
  { chave: 'microsservicos',       texto: 'Evolução da arquitetura de microsserviços',           icone: 'fa-solid fa-building',                cor: '#357F82' },
  { chave: 'sre-continuo',         texto: 'Evolução contínua das práticas de SRE',               icone: 'fa-solid fa-arrow-trend-up',          cor: '#259A6C' },
  { chave: 'sicredi-cooperativismo', texto: 'Entregas alinhadas aos valores do cooperativismo',  icone: 'fa-solid fa-handshake',               cor: '#BB9748' },
];
