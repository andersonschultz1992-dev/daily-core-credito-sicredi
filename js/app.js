/**
 * Daily Core & Crédito — app.js v7.0
 * "Cooperativismo Tech" · Sicredi Identity
 * ────────────────────────────────────────────
 * Arquitetura desta versão (volta à simplicidade, sem IA):
 *
 * - ÚNICA fonte de dados: Supabase (tabelas dailies/analistas/
 *   entregas/destaques — ver supabase/schema.sql). Não há mais
 *   data/analistas.json nem cache versionado em LocalStorage para
 *   os dados da daily.
 * - SEM autenticação: qualquer pessoa que abrir o app pode clicar
 *   em "Editar", alterar e "Salvar" — exatamente como funcionava
 *   na primeira versão (mudou apenas ONDE os dados ficam guardados:
 *   antes era o navegador local, agora é compartilhado no Supabase).
 * - SEM IA: o destaque executivo do cabeçalho é escolhido manualmente
 *   em Modo Edição a partir de uma biblioteca local estática com 34
 *   opções prontas (ver js/destaques.js) — nenhuma chamada de rede,
 *   nenhum custo, nenhuma chave de API.
 * - Ao abrir o app, a daily de HOJE é carregada automaticamente; se
 *   ainda não existir, ela é criada na hora copiando o roster de
 *   analistas da daily anterior mais recente (com entregas, badge e
 *   destaque do cabeçalho vazios — pronto para a equipe preencher).
 * - Um seletor no lugar da data do cabeçalho permite consultar
 *   qualquer daily anterior já registrada, sem recarregar a página.
 * - Removido: exportar/importar JSON (não fazem mais sentido com
 *   persistência em banco). Mantido: exportar imagem PNG, link
 *   compartilhável, tema claro/escuro, busca, ordenação, edição.
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════
     CONSTANTES
  ══════════════════════════════════════ */
  const LS_THEME = 'sicredi-daily-theme-v7'; // único uso de LocalStorage: preferência de tema (não é dado da daily)

  // Cor padrão (verde institucional) usada como fallback sempre que
  // um analista não tiver "corTema" definido ou o valor for inválido.
  const COR_PADRAO = '#259A6C';

  // Paleta cíclica usada ao adicionar novos analistas.
  const CORES_NOVO_ANALISTA = ['#259A6C', '#357F82', '#6F8794', '#BB9748', '#3FB585'];

  /* ══════════════════════════════════════
     ESTADO
  ══════════════════════════════════════ */
  const state = {
    dados:     null,   // { id, titulo, subtitulo, descricao, dataDaily, destaquesPrincipais:[{_uid,chave,texto,icone,cor}] (1-4), destaques:[{_uid,texto}], analistas:[...] }
    analistas: [],
    filtrados: [],
    query:     '',
    sortBy:    'default',
    editMode:  false,
    theme:     'dark',
    saving:    false,
    exporting: false,

    supabase:        null,   // cliente Supabase (null = não configurado → modo demonstração)
    modoDemo:        false,  // true quando rodando sem Supabase configurado
    dailiesLista:    [],      // [{ id, data_daily }] para o seletor de histórico
    currentDailyId:  null,
    todayISO:        null,    // data de hoje no formato YYYY-MM-DD (fuso local)
  };

  /* ══════════════════════════════════════
     SELETORES
  ══════════════════════════════════════ */
  const $ = (s) => document.querySelector(s);

  const ui = {
    titulo:       $('#js-titulo'),
    subtitulo:    $('#js-subtitulo'),
    descricao:    $('#js-descricao'),
    dateSelect:   $('#js-date-select'),
    datePicker:      $('#js-date-picker'),
    datePickerBtn:   $('#js-date-picker-btn'),
    historico:       $('#js-historico'),
    historicoList:   $('#js-historico-list'),
    historicoToggle: $('#js-historico-toggle'),
    historicoFab:    $('#js-historico-fab'),
    historicoBackdrop: $('#js-historico-backdrop'),
    destaqueBox:  $('#js-destaque'),
    destaqueChips:    $('#js-destaque-chips'),
    destaqueAddWrap:  $('#js-destaque-add-wrap'),
    destaqueAddSelect: $('#js-destaque-add-select'),
    destaqueMaxHint:  $('#js-destaque-max-hint'),
    avatares:     $('#js-avatares'),
    grid:         $('#js-grid'),
    empty:        $('#js-empty'),
    search:       $('#js-search'),
    sort:         $('#js-sort'),
    themeBtn:     $('#js-toggle-theme'),
    themeIcon:    $('#js-theme-icon'),
    editBtn:      $('#js-toggle-edit'),
    addAnalista:  $('#js-add-analista'),
    saveBtn:      $('#js-save'),
    deleteBtn:    $('#js-delete-daily'),
    exportImg:    $('#js-export-img'),
    shareBtn:     $('#js-share'),
    toast:        $('#js-toast'),
    loading:      $('#js-loading'),
    modal:        $('#js-modal'),
    modalMsg:     $('#js-modal-msg'),
    modalCancel:  $('#js-modal-cancel'),
    modalConfirm: $('#js-modal-confirm'),
    footerList:   $('#js-footer-list'),
    addDestaque:  $('#js-add-destaque'),
    toolbar:      $('#js-toolbar'),
    // Seletor de ícones (badge dos cards) — ver seção ÍCONE DO BADGE
    iconPicker:       $('#js-icon-picker'),
    iconPickerGrid:   $('#js-icon-picker-grid'),
    iconPickerCancel: $('#js-icon-picker-cancel'),
  };

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  async function init() {
    loadTheme();
    state.todayISO = getTodayISO();
    state.supabase = initSupabase();

    if (state.supabase) {
      try {
        await ensureTodayDaily();
      } catch (e) {
        console.error('[Init] Falha ao carregar/criar a daily de hoje, usando dados de demonstração:', e);
        ativarModoDemo();
      }
    } else {
      ativarModoDemo();
    }

    bindGlobalEvents();
    restoreFromHash();
    hideLoading();
  }

  /* ══════════════════════════════════════
     SUPABASE — INICIALIZAÇÃO
  ══════════════════════════════════════ */
  function initSupabase() {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anonKey) return null;
    if (cfg.url.includes('XXXXXXXXXX') || cfg.anonKey === '') return null;
    // O SDK vem de um CDN; se a rede o bloqueou, window.supabase não
    // existe. Cai para modo demo de forma limpa (sem TypeError).
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.warn('[Supabase] SDK não carregou (CDN bloqueado?). Usando modo demonstração.');
      return null;
    }
    try {
      const { createClient } = window.supabase; // UMD build
      return createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } });
    } catch (e) {
      console.warn('[Supabase] Não foi possível inicializar:', e);
      return null;
    }
  }

  /** Modo demonstração: usado quando o Supabase não está configurado
   *  ou está inacessível. O app continua 100% funcional para visualização
   *  e edição na sessão atual — só não persiste nada entre recarregamentos. */
  function ativarModoDemo() {
    state.modoDemo = true;
    state.dados    = getDemoData();
    if (ui.dateSelect) {
      ui.dateSelect.innerHTML = '<option value="">Sem Supabase</option>';
      ui.dateSelect.disabled  = true;
      ui.dateSelect.title     = 'Configure o Supabase em js/config.js para habilitar o histórico de dailies';
    }
    processarDados();
  }

  /* ══════════════════════════════════════
     GARANTIR DAILY DE HOJE
     ------------------------------------
     1. Busca uma daily com data_daily = hoje.
     2. Se existir no banco, carrega.
     3. Se NÃO existir, monta um RASCUNHO em memória (não grava nada
        no banco). A daily só é persistida quando o usuário clicar em
        "Salvar" com algum conteúdo — isso evita criar registros
        vazios para dias em que ninguém preencheu nada.
  ══════════════════════════════════════ */
  async function ensureTodayDaily() {
    await carregarListaDailies();

    const existente = state.dailiesLista.find(d => d.data_daily === state.todayISO);
    if (existente) {
      await carregarDailyPorId(existente.id);
      return;
    }

    await montarRascunhoDaily(state.todayISO);
  }

  async function carregarListaDailies() {
    const { data, error } = await state.supabase
      .from('dailies')
      .select('id, data_daily')
      .order('data_daily', { ascending: false })
      .limit(120);
    if (error) throw error;
    state.dailiesLista = data || [];
  }

  /** Monta uma daily VAZIA em memória (rascunho), sem gravar no banco.
   *  Copia o roster (nome/cargo/foto/cor/tags/ícone) da daily existente
   *  mais recente anterior à data alvo — assim planejar uma daily futura
   *  herda o time da última já cadastrada. Entregas/badge/destaques
   *  começam vazios. A persistência só acontece no salvar(), quando há
   *  conteúdo (ver temConteudoParaSalvar / salvar). */
  async function montarRascunhoDaily(dataISO) {
    const alvoISO = dataISO || state.todayISO;

    const anterior = state.dailiesLista.find(d => d.data_daily < alvoISO)
                  || state.dailiesLista[0]
                  || null;

    let tituloBase    = 'Principais Entregas da Semana';
    let subtituloBase = 'Time Core & Crédito';
    let descricaoBase = 'Resultados, melhorias operacionais, estabilidade e evolução contínua dos ambientes.';
    let rosterBase    = seedRosterPadrao();

    if (anterior) {
      const { data: dailyAnterior } = await state.supabase
        .from('dailies').select('titulo, subtitulo, descricao').eq('id', anterior.id).single();
      if (dailyAnterior) {
        tituloBase    = dailyAnterior.titulo    || tituloBase;
        subtituloBase = dailyAnterior.subtitulo || subtituloBase;
        descricaoBase = dailyAnterior.descricao || descricaoBase;
      }
      const { data: analistasAnteriores } = await state.supabase
        .from('analistas').select('*').eq('daily_id', anterior.id).order('ordem');
      if (Array.isArray(analistasAnteriores) && analistasAnteriores.length) {
        rosterBase = analistasAnteriores.map((a, i) => ({
          nome: a.nome, cargo: a.cargo, foto: a.foto || '',
          cor_tema: a.cor_tema || COR_PADRAO,
          tags: Array.isArray(a.tags) ? a.tags : ['SRE', 'DevOps'],
          badge_icone: a.badge_icone || 'fa-solid fa-chart-line',
          ordem: i,
        }));
      }
    }

    // id: null marca o rascunho como "ainda não persistido". O salvar()
    // detecta isso e faz INSERT em vez de UPDATE.
    state.dados = {
      id: null,
      titulo: tituloBase, subtitulo: subtituloBase, descricao: descricaoBase,
      dataDaily: formatarDataBR(alvoISO), dataDailyISO: alvoISO,
      destaquesPrincipais: [],
      destaques: [],
      analistas: rosterBase.map((a, i) => ({
        _uid: 'rascunho_a' + i, id: null,
        nome: a.nome, cargo: a.cargo, foto: a.foto || '',
        badgeNumero: '', badgeTexto: '', badgeIcone: a.badge_icone || 'fa-solid fa-chart-line',
        corTema: a.cor_tema || COR_PADRAO,
        tags: Array.isArray(a.tags) ? a.tags : ['SRE', 'DevOps'],
        entregas: [],
      })),
    };
    state.currentDailyId = null;
    processarDados();

    const ehHoje = alvoISO === state.todayISO;
    showToast(ehHoje
      ? '📅 Daily de hoje — preencha e clique em Salvar para registrar.'
      : `📅 Nova daily para ${formatarDataBR(alvoISO)} — preencha e clique em Salvar para registrar.`);
  }

  /** Vai para a daily de uma data: se já existe no banco, carrega; se
   *  não, monta um RASCUNHO em memória (sem gravar). A persistência só
   *  acontece no salvar(). Usado pelo date picker do cabeçalho. */
  async function irParaData(dataISO) {
    if (!dataISO) return;
    if (state.modoDemo || !state.supabase) {
      showToast('⚠️ Configure o Supabase em js/config.js para criar dailies de outras datas.');
      return;
    }
    const existente = state.dailiesLista.find(d => d.data_daily === dataISO);
    try {
      if (existente) {
        if (existente.id !== state.currentDailyId) await carregarDailyPorId(existente.id);
      } else {
        await montarRascunhoDaily(dataISO);
      }
    } catch (err) {
      console.error('[irParaData]', err);
      showToast('❌ Não foi possível abrir a daily dessa data.');
    }
  }

  /** Verdadeiro se a daily atual tem ALGO que valha a pena persistir:
   *  ao menos uma entrega, um destaque (cabeçalho ou rodapé), ou um
   *  badge preenchido. Apenas ter o roster (nomes/cargos copiados) NÃO
   *  conta como conteúdo — é o que evita registros vazios no banco. */
  function temConteudoParaSalvar() {
    const d = state.dados;
    if (!d) return false;

    const temEntrega = (d.analistas || []).some(a =>
      (a.entregas || []).some(t => t && t.trim()));
    if (temEntrega) return true;

    const temBadge = (d.analistas || []).some(a =>
      (a.badgeNumero && a.badgeNumero.trim()) || (a.badgeTexto && a.badgeTexto.trim()));
    if (temBadge) return true;

    const temDestaqueCabecalho = (d.destaquesPrincipais || []).length > 0;
    if (temDestaqueCabecalho) return true;

    const temDestaqueRodape = (d.destaques || []).some(x => x.texto && x.texto.trim());
    if (temDestaqueRodape) return true;

    return false;
  }

  function seedRosterPadrao() {
    return [
      { nome: 'Anderson Schultz Ribeiro',      cargo: 'Analista SRE e DevOps PL', foto: 'assets/fotos/anderson.jpg', cor_tema: '#259A6C', tags: ['SRE','DevOps'], badge_icone: 'fa-solid fa-server',        ordem: 0 },
      { nome: 'Diego Gonçalves de Oliveira',   cargo: 'Analista SRE e DevOps SR', foto: 'assets/fotos/diego.jpg',    cor_tema: '#357F82', tags: ['SRE','DevOps'], badge_icone: 'fa-solid fa-headset',       ordem: 1 },
      { nome: 'Gilson Batista da Silva Souza', cargo: 'Analista SRE e DevOps SR', foto: 'assets/fotos/gilson.jpg',   cor_tema: '#6F8794', tags: ['SRE','DevOps'], badge_icone: 'fa-solid fa-database',       ordem: 2 },
      { nome: 'Matheus da Silva de Farias',    cargo: 'Analista SRE e DevOps JR', foto: 'assets/fotos/matheus.jpg',  cor_tema: '#BB9748', tags: ['SRE','DevOps'], badge_icone: 'fa-solid fa-shield-halved',  ordem: 3 },
    ];
  }

  /* ══════════════════════════════════════
     CARREGAR DAILY ESPECÍFICA
  ══════════════════════════════════════ */
  async function carregarDailyPorId(id) {
    const sb = state.supabase;
    const [
      { data: daily,     error: e1 },
      { data: analistas, error: e2 },
      { data: entregas,  error: e3 },
      { data: destaques, error: e4 },
      { data: destaquesCabecalho, error: e5 },
    ] = await Promise.all([
      sb.from('dailies')  .select('*').eq('id', id).single(),
      sb.from('analistas').select('*').eq('daily_id', id).order('ordem'),
      sb.from('entregas') .select('*').eq('daily_id', id).order('ordem'),
      sb.from('destaques').select('*').eq('daily_id', id).order('ordem'),
      sb.from('destaques_cabecalho').select('*').eq('daily_id', id).order('ordem'),
    ]);
    if (e1) throw e1; if (e2) throw e2; if (e3) throw e3; if (e4) throw e4; if (e5) throw e5;

    state.dados          = supabaseParaAppFormat(daily, analistas, entregas, destaques, destaquesCabecalho);
    state.currentDailyId = id;
    processarDados();
  }

  function supabaseParaAppFormat(daily, analistas, entregas, destaques, destaquesCabecalho) {
    const entregasMap = {};
    (entregas || []).forEach(e => {
      if (!entregasMap[e.analista_id]) entregasMap[e.analista_id] = [];
      entregasMap[e.analista_id].push(e.texto);
    });

    return {
      id:             daily.id,
      titulo:         daily.titulo,
      subtitulo:      daily.subtitulo,
      descricao:      daily.descricao || '',
      dataDaily:      formatarDataBR(daily.data_daily),
      dataDailyISO:   daily.data_daily,
      // Até 4 destaques executivos do cabeçalho, na ordem escolhida.
      destaquesPrincipais: (destaquesCabecalho || []).map(d => ({
        _uid: d.id, chave: d.chave, texto: d.texto, icone: d.icone, cor: d.cor,
      })),
      destaques: (destaques || []).map(d => ({ _uid: d.id, texto: d.texto })),
      analistas: (analistas || []).map(a => ({
        id:          a.id,
        _uid:        a.id,
        nome:        a.nome,
        cargo:       a.cargo,
        foto:        a.foto        || '',
        badgeNumero: a.badge_numero || '',
        badgeTexto:  a.badge_texto  || '',
        badgeIcone:  a.badge_icone  || 'fa-solid fa-chart-line',
        corTema:     a.cor_tema     || COR_PADRAO,
        tags:        Array.isArray(a.tags) ? a.tags : ['SRE', 'DevOps'],
        entregas:    entregasMap[a.id] || [],
      })),
    };
  }

  /* ══════════════════════════════════════
     SELETOR DE DATA (histórico)
  ══════════════════════════════════════ */
  function renderDateSelector() {
    if (!ui.dateSelect) return;
    if (state.modoDemo) return; // já tratado em ativarModoDemo()

    if (!state.dailiesLista.length) {
      // Banco vazio: se houver um rascunho atual, mostra a data dele;
      // senão, indica que ainda não há dailies registradas.
      if (state.dados && !state.dados.id && state.dados.dataDailyISO) {
        const labelR = formatarDataBR(state.dados.dataDailyISO)
          + (state.dados.dataDailyISO === state.todayISO ? ' · Hoje' : '') + ' · (não salva)';
        ui.dateSelect.innerHTML = `<option value="__rascunho__">${labelR}</option>`;
        ui.dateSelect.value = '__rascunho__';
        ui.dateSelect.disabled = false;
      } else {
        ui.dateSelect.innerHTML = '<option value="">Nenhuma daily registrada</option>';
        ui.dateSelect.disabled  = true;
      }
      return;
    }

    ui.dateSelect.disabled = false;

    // Se a daily atual é um RASCUNHO (ainda sem id, data não está na
    // lista salva), inclui uma opção transitória para o seletor refletir
    // a data realmente exibida na tela — sem poluir o histórico.
    const ehRascunho = state.dados && !state.dados.id && state.dados.dataDailyISO
      && !state.dailiesLista.some(d => d.data_daily === state.dados.dataDailyISO);

    let html = state.dailiesLista.map(d => {
      const label = formatarDataBR(d.data_daily) + (d.data_daily === state.todayISO ? ' · Hoje' : '');
      return `<option value="${d.id}">${label}</option>`;
    }).join('');

    if (ehRascunho) {
      const labelR = formatarDataBR(state.dados.dataDailyISO)
        + (state.dados.dataDailyISO === state.todayISO ? ' · Hoje' : '') + ' · (não salva)';
      html = `<option value="__rascunho__">${labelR}</option>` + html;
    }

    ui.dateSelect.innerHTML = html;
    if (ehRascunho) ui.dateSelect.value = '__rascunho__';
    else if (state.currentDailyId) ui.dateSelect.value = state.currentDailyId;
  }

  /* ══════════════════════════════════════
     HISTÓRICO / AGENDA DE DAILIES (lateral direita)
     ------------------------------------
     Lista apenas datas que possuem daily salva (state.dailiesLista
     só contém dailies que existem no banco). Clicar carrega aquela
     daily. Passadas e futuras aparecem; a do dia atual e a que está
     aberta recebem destaque visual.
  ══════════════════════════════════════ */
  function renderHistorico() {
    if (!ui.historicoList) return;

    if (state.modoDemo || !state.dailiesLista.length) {
      ui.historicoList.innerHTML = state.modoDemo
        ? '<li class="historico-empty">Configure o Supabase para ver o histórico de dailies.</li>'
        : '<li class="historico-empty">Nenhuma daily registrada ainda.</li>';
      return;
    }

    // Já vem ordenada desc (mais recente primeiro).
    ui.historicoList.innerHTML = state.dailiesLista.map(d => {
      const ehHoje  = d.data_daily === state.todayISO;
      const ehFutura = d.data_daily > state.todayISO;
      const ativa   = d.id === state.currentDailyId;
      const tag = ehHoje ? '<span class="historico-tag hoje">Hoje</span>'
                : ehFutura ? '<span class="historico-tag futura">Futura</span>'
                : '';
      return `
        <li>
          <button type="button" class="historico-item${ativa ? ' ativa' : ''}" data-id="${d.id}" title="Abrir daily de ${formatarDataBR(d.data_daily)}">
            <i class="fa-solid fa-calendar-day"></i>
            <span class="historico-data">${formatarDataBR(d.data_daily)}</span>
            ${tag}
          </button>
        </li>`;
    }).join('');
  }

  /** Fecha o painel de histórico quando ele está em modo overlay (mobile). */
  function fecharHistoricoMobile() {
    document.body.classList.remove('historico-aberto');
  }

  /* ══════════════════════════════════════
     PROCESSAR DADOS
  ══════════════════════════════════════ */
  function processarDados() {
    const d = state.dados;

    ui.titulo.textContent    = d.titulo    || 'Principais Entregas da Semana';
    ui.subtitulo.textContent = d.subtitulo || 'Time Core & Crédito';
    ui.descricao.textContent = d.descricao || '';

    renderDateSelector();
    renderHistorico();
    if (ui.datePicker && state.dados.dataDailyISO) ui.datePicker.value = state.dados.dataDailyISO;
    renderDestaquesPrincipais();
    renderDestaqueChips();
    renderDestaqueAddSelect();

    state.analistas = Array.isArray(d.analistas) ? d.analistas : [];
    state.filtrados = [...state.analistas];

    renderAvatares();
    renderCards();
    renderFooter();

    if (state.editMode) applyEditStateToAll(true);
  }

  /* ══════════════════════════════════════
     DESTAQUES PRINCIPAIS DO CABEÇALHO (1 a 4)
     ------------------------------------
     Cada daily pode ter de 1 a 4 destaques executivos, escolhidos
     manualmente (Modo Edição) a partir da biblioteca local estática
     em js/destaques.js — sem geração automática, sem IA, sem rede.
  ══════════════════════════════════════ */
  const MAX_DESTAQUES_PRINCIPAIS = 4;

  function getDestaquesLib() {
    return Array.isArray(window.DESTAQUES_BIBLIOTECA) ? window.DESTAQUES_BIBLIOTECA : [];
  }

  /** Visualização (sempre visível, em qualquer modo): uma "pill"
   *  colorida por destaque selecionado, lado a lado, com quebra de
   *  linha automática em telas estreitas. */
  function renderDestaquesPrincipais() {
    if (!ui.destaqueBox) return;
    const lista = Array.isArray(state.dados.destaquesPrincipais) ? state.dados.destaquesPrincipais : [];

    if (!lista.length) { ui.destaqueBox.innerHTML = ''; return; }

    ui.destaqueBox.innerHTML = lista.map(d => {
      const cor   = corSegura(d.cor || COR_PADRAO);
      const icone = d.icone || 'fa-solid fa-star';
      const bg1   = hexAlpha(cor, 0.14);
      const bg2   = hexAlpha(cor, 0.09);
      const borda = hexAlpha(cor, 0.32);
      return `
      <div class="destaque-inner" style="background:linear-gradient(100deg,${bg1} 0%,${bg2} 100%);border:1px solid ${borda};color:${cor};">
        <i class="${escAttr(icone)}" style="color:${cor};" aria-hidden="true"></i>
        <span>${escHtml(d.texto)}</span>
      </div>`;
    }).join('');
  }

  /** Modo Edição: chips dos destaques já selecionados, cada um com
   *  botão de remover — equivalente visual às tags/badges já usadas
   *  no resto da aplicação, só que com um "×" para tirar da lista. */
  function renderDestaqueChips() {
    if (!ui.destaqueChips) return;
    const lista = Array.isArray(state.dados.destaquesPrincipais) ? state.dados.destaquesPrincipais : [];

    if (!lista.length) {
      ui.destaqueChips.innerHTML = '<p class="destaque-chips-empty">Nenhum destaque selecionado — escolha pelo menos 1 abaixo.</p>';
      return;
    }

    ui.destaqueChips.innerHTML = lista.map(d => {
      const cor = corSegura(d.cor || COR_PADRAO);
      return `
        <span class="destaque-chip" style="background:${hexAlpha(cor,0.14)};border-color:${hexAlpha(cor,0.36)};color:${cor};">
          <i class="${escAttr(d.icone || 'fa-solid fa-star')}" style="color:${cor};"></i>
          ${escHtml(d.texto)}
          <button type="button" class="destaque-chip-remove" data-uid="${escAttr(d._uid)}" title="Remover destaque" aria-label="Remover destaque ${escAttr(d.texto)}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>`;
    }).join('');
  }

  /** Modo Edição: select para ADICIONAR um novo destaque, mostrando
   *  apenas opções da biblioteca ainda não escolhidas (evita
   *  duplicidade). Esconde/desabilita ao atingir o máximo de 4. */
  function renderDestaqueAddSelect() {
    if (!ui.destaqueAddSelect) return;
    const lib = getDestaquesLib();
    const lista = Array.isArray(state.dados.destaquesPrincipais) ? state.dados.destaquesPrincipais : [];
    const chavesUsadas = new Set(lista.map(d => d.chave));
    const disponiveis = lib.filter(o => !chavesUsadas.has(o.chave));

    const atingiuMax = lista.length >= MAX_DESTAQUES_PRINCIPAIS;
    if (ui.destaqueAddWrap) ui.destaqueAddWrap.classList.toggle('hidden', atingiuMax);
    if (ui.destaqueMaxHint) ui.destaqueMaxHint.classList.toggle('hidden', !atingiuMax);

    ui.destaqueAddSelect.innerHTML = '<option value="">+ Adicionar destaque...</option>' +
      disponiveis.map(o => `<option value="${escHtml(o.chave)}">${escHtml(o.texto)}</option>`).join('');
    ui.destaqueAddSelect.value = '';
  }

  /** Adiciona um destaque da biblioteca à lista (máx. 4, sem
   *  duplicidade — ambas as regras já refletidas no select, mas
   *  validadas de novo aqui por segurança). */
  function adicionarDestaquePrincipal(chave) {
    if (!chave) return;
    const lib = getDestaquesLib();
    const escolhido = lib.find(o => o.chave === chave);
    if (!escolhido) return;

    if (!Array.isArray(state.dados.destaquesPrincipais)) state.dados.destaquesPrincipais = [];
    const lista = state.dados.destaquesPrincipais;

    if (lista.some(d => d.chave === chave)) return;        // evita duplicidade
    if (lista.length >= MAX_DESTAQUES_PRINCIPAIS) return;   // respeita o máximo

    lista.push({
      _uid: gerarUidTemporario(),
      chave: escolhido.chave, texto: escolhido.texto, icone: escolhido.icone, cor: escolhido.cor,
    });

    renderDestaquesPrincipais();
    renderDestaqueChips();
    renderDestaqueAddSelect();
  }

  /** Remove um destaque da lista pelo seu _uid local. */
  function removerDestaquePrincipal(uid) {
    if (!Array.isArray(state.dados.destaquesPrincipais)) return;
    state.dados.destaquesPrincipais = state.dados.destaquesPrincipais.filter(d => d._uid !== uid);
    renderDestaquesPrincipais();
    renderDestaqueChips();
    renderDestaqueAddSelect();
  }

  /* ══════════════════════════════════════
     AVATARES
  ══════════════════════════════════════ */
  function renderAvatares() {
    ui.avatares.innerHTML = '';
    state.analistas.forEach((a) => {
      const chip = document.createElement('div');
      chip.className = 'avatar-chip';
      chip.setAttribute('role', 'listitem');

      const photo = a.foto || null;
      const first = (a.nome || '').split(' ')[0];
      const inits = getInitials(a.nome);
      const cor   = corSegura(a.corTema || COR_PADRAO);

      chip.innerHTML = `
        ${photo
          ? `<img src="${escAttr(photo)}" alt="${escHtml(a.nome)}" loading="lazy"
               onerror="this.style.display='none';this.nextSibling.style.display='inline-flex'" />
             <span class="avatar-chip-initials" style="display:none;
               background:${cor}22;border:2px solid ${cor};
               color:${cor};font-size:10px;font-weight:800;">${inits}</span>`
          : `<span class="avatar-chip-initials" style="
               background:${cor}22;border:2px solid ${cor};
               color:${cor};font-size:10px;font-weight:800;">${inits}</span>`
        }
        <span class="avatar-name">${escHtml(first)}</span>`;

      ui.avatares.appendChild(chip);
    });
  }

  /* ══════════════════════════════════════
     RENDER CARDS
  ══════════════════════════════════════ */
  function renderCards() {
    ui.grid.innerHTML = '';

    if (state.filtrados.length === 0) {
      ui.empty.classList.remove('hidden');
      return;
    }
    ui.empty.classList.add('hidden');

    state.filtrados.forEach((a) => {
      const card = buildCard(a);
      ui.grid.appendChild(card);
    });

    if (state.editMode) applyEditStateToAll(true);
  }

  /* ══════════════════════════════════════
     BUILD CARD
  ══════════════════════════════════════ */
  function buildCard(a) {
    const cor      = corSegura(a.corTema || COR_PADRAO);
    const cor22    = hexAlpha(cor, 0.22);
    const cor10    = hexAlpha(cor, 0.10);
    const inits    = getInitials(a.nome);
    const photo    = a.foto || null;
    const tags     = Array.isArray(a.tags) ? a.tags : ['SRE', 'DevOps'];
    const badgeIco = a.badgeIcone || 'fa-solid fa-chart-line';
    const numE     = Array.isArray(a.entregas) ? a.entregas.length : 0;

    const card = document.createElement('article');
    card.className = 'analyst-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `Card de ${a.nome}`);
    card.dataset.uid = a._uid;
    card.style.setProperty('--tema-cor', cor);
    card.style.borderColor = cor22;

    const fotoHTML = `
      <div class="card-photo-wrap" title="Clique para trocar foto">
        <div class="card-photo-ring"></div>
        ${photo
          ? `<img class="card-photo" src="${escAttr(photo)}" alt="${escHtml(a.nome)}" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
             <div class="card-photo-fallback" style="display:none;background:linear-gradient(135deg,${cor},${hexAlpha(cor,0.4)})">${inits}</div>`
          : `<div class="card-photo-fallback" style="background:linear-gradient(135deg,${cor},${hexAlpha(cor,0.4)})">${inits}</div>`
        }
        <div class="card-photo-overlay"><i class="fa-solid fa-camera"></i><span>Trocar</span></div>
        <span class="card-photo-badge" aria-hidden="true"><i class="fa-solid fa-camera"></i></span>
        <input type="file" class="card-photo-input" accept="image/*" />
      </div>`;

    const tagsHTML = tags.map(t =>
      `<span class="card-tag" style="color:${cor};border-color:${cor22};background:${cor10};">
         <i class="fa-solid fa-circle-dot" style="font-size:6px"></i>${escHtml(t)}
       </span>`
    ).join('');

    const entregasHTML = (Array.isArray(a.entregas) ? a.entregas : [])
      .map((e, i) => buildEntregaHTML(e, i, cor)).join('');

    card.innerHTML = `
      <div class="card-accent-line" style="background:linear-gradient(90deg,${cor},${hexAlpha(cor,0.4)})"></div>

      <button type="button" class="card-remove-btn" title="Remover analista" aria-label="Remover ${escHtml(a.nome)}">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <div class="card-header">
        ${fotoHTML}
        <div class="card-info">
          <p class="card-name editable-field"
             contenteditable="false"
             data-field="nome"
             spellcheck="false"
             title="${escHtml(a.nome)}">${escHtml(a.nome)}</p>
          <p class="card-cargo editable-field"
             contenteditable="false"
             data-field="cargo"
             spellcheck="false">${escHtml(a.cargo || '')}</p>
          <div class="card-tags">${tagsHTML}</div>
        </div>
      </div>

      ${(a.badgeNumero || a.badgeTexto || state.editMode) ? `
      <div class="card-badge">
        <div class="badge-icon" style="background:linear-gradient(135deg,${cor},${hexAlpha(cor,0.6)})" title="Clique para trocar o ícone">
          <i class="${escAttr(badgeIco)}"></i>
          <span class="badge-icon-edit-badge" aria-hidden="true"><i class="fa-solid fa-pencil"></i></span>
        </div>
        <div>
          <div class="badge-number editable-field"
               contenteditable="false"
               data-field="badgeNumero"
               spellcheck="false">${escHtml(a.badgeNumero)}</div>
          <div class="badge-text editable-field"
               contenteditable="false"
               data-field="badgeTexto"
               spellcheck="false">${escHtml(a.badgeTexto || '')}</div>
        </div>
      </div>` : ''}

      <div class="card-entregas-header">
        <p class="card-entregas-title">
          <i class="fa-solid fa-circle-check"></i>
          Principais Entregas
        </p>
        <span class="entregas-count">${numE}</span>
      </div>

      <button class="card-add-entrega" type="button">
        <i class="fa-solid fa-plus"></i> Adicionar entrega
      </button>

      <ul class="card-entregas">${entregasHTML}</ul>
    `;

    bindCardEvents(card, a);
    return card;
  }

  function buildEntregaHTML(texto, idx, cor) {
    return `
      <li class="entrega-item" data-idx="${idx}">
        <span class="bullet" style="background:${cor};box-shadow:0 0 5px ${hexAlpha(cor,0.55)};"></span>
        <span class="entrega-text"
              contenteditable="false"
              data-idx="${idx}"
              spellcheck="false">${escHtml(texto)}</span>
        <button class="entrega-remove" type="button" data-idx="${idx}" title="Remover entrega" aria-label="Remover entrega">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </li>`;
  }

  /* ══════════════════════════════════════
     EVENTOS DO CARD
  ══════════════════════════════════════ */
  function bindCardEvents(card, analista) {
    const photoWrap  = card.querySelector('.card-photo-wrap');
    const photoInput = card.querySelector('.card-photo-input');

    photoWrap.addEventListener('click', () => {
      if (state.editMode) photoInput.click();
    });

    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;

      let dataUrl;
      try {
        dataUrl = await resizeImageFile(file, 480, 0.85);
      } catch (err) {
        console.error('Erro ao processar imagem:', err);
        showToast('❌ Não foi possível processar a imagem selecionada.');
        return;
      }

      const uid = card.dataset.uid;
      const a = getByUid(uid);
      if (!a) return;
      a.foto = dataUrl;

      let img = card.querySelector('.card-photo');
      const fallback = card.querySelector('.card-photo-fallback');
      if (img) {
        img.src = dataUrl;
        img.style.display = '';
        if (fallback) fallback.style.display = 'none';
      } else if (fallback) {
        img = document.createElement('img');
        img.className = 'card-photo';
        img.src = dataUrl;
        img.alt = a.nome;
        img.loading = 'lazy';
        fallback.parentNode.insertBefore(img, fallback);
        fallback.style.display = 'none';
      }
      renderAvatares();

      // Persiste imediatamente se o analista já existe no Supabase
      // (mesma UX da versão original: foto salva na hora, sem precisar
      // clicar em "Salvar"). Se for um analista novo (ainda sem id),
      // a foto fica em memória e vai junto no próximo Salvar.
      if (state.supabase && a.id) {
        try {
          const { error } = await state.supabase.from('analistas').update({ foto: dataUrl }).eq('id', a.id);
          if (error) throw error;
          showToast('📸 Foto atualizada e salva!');
        } catch (err) {
          console.warn('[Foto] Falha ao salvar imediatamente, será salva no próximo Salvar:', err);
          showToast('📸 Foto atualizada — será salva ao clicar em Salvar.');
        }
      } else {
        showToast('📸 Foto atualizada — será salva ao clicar em Salvar.');
      }
    });

    // Ícone do indicador (badge) — clicável apenas em Modo Edição,
    // abre a grade de ícones reaproveitada da biblioteca de destaques.
    const badgeIconEl = card.querySelector('.badge-icon');
    if (badgeIconEl) {
      badgeIconEl.addEventListener('click', (e) => {
        if (!state.editMode) return;
        e.stopPropagation();
        const uid = card.dataset.uid;
        const a = getByUid(uid);
        if (!a) return;
        abrirSeletorIcone(a.badgeIcone || 'fa-solid fa-chart-line', (novoIcone) => {
          a.badgeIcone = novoIcone;
          const iEl = badgeIconEl.querySelector('i');
          if (iEl) iEl.className = novoIcone;
          showToast('🎯 Ícone do indicador atualizado!');
        });
      });
    }

    card.querySelector('.card-remove-btn').addEventListener('click', () => {
      const uid = card.dataset.uid;
      const a = getByUid(uid);
      if (!a) return;
      confirmDialog(
        `Remover o analista <strong>${escHtml(a.nome)}</strong>?`,
        () => {
          state.analistas = state.analistas.filter(x => x._uid !== uid);
          state.filtrados = state.filtrados.filter(x => x._uid !== uid);
          state.dados.analistas = state.analistas;
          card.style.animation = 'cardOut 0.28s ease forwards';
          setTimeout(() => {
            renderCards();
            renderAvatares();
            showToast('🗑️ Analista removido — clique em Salvar para confirmar.');
          }, 290);
        }
      );
    });

    card.querySelector('.card-add-entrega').addEventListener('click', () => {
      const uid = card.dataset.uid;
      const a = getByUid(uid);
      if (!a) return;
      if (!Array.isArray(a.entregas)) a.entregas = [];
      const newText = 'Nova entrega — clique para editar';
      a.entregas.push(newText);

      const ul  = card.querySelector('.card-entregas');
      const idx = a.entregas.length - 1;
      const cor = a.corTema || COR_PADRAO;
      ul.insertAdjacentHTML('beforeend', buildEntregaHTML(newText, idx, cor));
      bindEntregaEvents(card, a);
      updateEntregasCount(card, a);
      applyEditStateToCard(card, true);

      const newEl = ul.querySelector(`.entrega-text[data-idx="${idx}"]`);
      if (newEl) { newEl.focus(); selectAll(newEl); }
      showToast('✅ Entrega adicionada!');
    });

    card.querySelectorAll('.editable-field').forEach(el => {
      el.addEventListener('blur', () => syncField(el, card));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      });
    });

    bindEntregaEvents(card, analista);
  }

  function bindEntregaEvents(card, analista) {
    card.querySelectorAll('.entrega-remove').forEach(btn => {
      const nb = btn.cloneNode(true);
      btn.parentNode.replaceChild(nb, btn);
      nb.addEventListener('click', () => {
        const uid = card.dataset.uid;
        const a = getByUid(uid);
        if (!a) return;
        const idx = parseInt(nb.dataset.idx, 10);
        a.entregas.splice(idx, 1);
        reRenderEntregas(card, a);
        showToast('🗑️ Entrega removida.');
      });
    });

    card.querySelectorAll('.entrega-text').forEach(el => {
      const ne = el.cloneNode(true);
      el.parentNode.replaceChild(ne, el);
      ne.addEventListener('blur', () => {
        const uid = card.dataset.uid;
        const a = getByUid(uid);
        if (!a) return;
        const idx = parseInt(ne.dataset.idx, 10);
        const txt = ne.textContent.trim();
        if (txt) a.entregas[idx] = txt;
        updateEntregasCount(card, a);
      });
      ne.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ne.blur(); }
      });
      if (state.editMode) ne.contentEditable = 'true';
    });
  }

  function reRenderEntregas(card, a) {
    const ul  = card.querySelector('.card-entregas');
    const cor = corSegura(a.corTema || COR_PADRAO);
    if (!ul) return;
    ul.innerHTML = (a.entregas || []).map((e, i) => buildEntregaHTML(e, i, cor)).join('');
    bindEntregaEvents(card, a);
    updateEntregasCount(card, a);
    applyEditStateToCard(card, state.editMode);
  }

  function updateEntregasCount(card, a) {
    const ct = card.querySelector('.entregas-count');
    if (ct) ct.textContent = (a.entregas || []).length;
  }

  function syncField(el, card) {
    const field = el.dataset.field;
    const uid   = card.dataset.uid;
    if (!field || !uid) return;
    const a = getByUid(uid);
    if (!a) return;
    const val = el.textContent.trim();

    if (field === 'nome') {
      if (val) { a.nome = val; card.setAttribute('aria-label', `Card de ${val}`); }
      else el.textContent = a.nome; // não permite nome vazio
    } else {
      a[field] = val;
    }
  }

  /* ══════════════════════════════════════
     FOOTER — DESTAQUES DA SEMANA (editável)
  ══════════════════════════════════════ */
  function renderFooter() {
    const destaques = Array.isArray(state.dados.destaques) ? state.dados.destaques : [];
    const icons = ['fa-solid fa-eye', 'fa-solid fa-shield-halved', 'fa-solid fa-gears',
                   'fa-solid fa-handshake', 'fa-solid fa-triangle-exclamation'];

    ui.footerList.innerHTML = destaques.map((d, i) => `
      <li data-uid="${d._uid}">
        <i class="${icons[i % icons.length]}"></i>
        <span class="footer-destaque-text"
              contenteditable="false"
              spellcheck="false">${escHtml(d.texto)}</span>
        <button type="button" class="footer-destaque-remove" data-uid="${d._uid}" title="Remover destaque" aria-label="Remover destaque">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </li>`).join('');

    bindFooterEvents();
  }

  function bindFooterEvents() {
    ui.footerList.querySelectorAll('.footer-destaque-text').forEach(el => {
      const li = el.closest('li');
      el.contentEditable = state.editMode ? 'true' : 'false';
      el.addEventListener('blur', () => {
        const uid = li.dataset.uid;
        const d = state.dados.destaques.find(x => x._uid === uid);
        if (!d) return;
        const val = el.textContent.trim();
        if (val) d.texto = val; else el.textContent = d.texto;
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
      });
    });

    ui.footerList.querySelectorAll('.footer-destaque-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.uid;
        state.dados.destaques = state.dados.destaques.filter(d => d._uid !== uid);
        renderFooter();
        showToast('🗑️ Destaque removido.');
      });
    });
  }

  /* ══════════════════════════════════════
     MODO EDIÇÃO
  ══════════════════════════════════════ */
  function toggleEditMode() {
    state.editMode = !state.editMode;
    document.body.classList.toggle('edit-mode', state.editMode);

    ui.editBtn.classList.toggle('active', state.editMode);
    ui.editBtn.querySelector('.btn-label').textContent =
      state.editMode ? 'Sair Edição' : 'Editar';

    document.querySelectorAll('.edit-only').forEach(el =>
      el.classList.toggle('hidden', !state.editMode)
    );

    [ui.titulo, ui.subtitulo, ui.descricao].forEach(el => {
      if (el) el.contentEditable = state.editMode ? 'true' : 'false';
    });

    applyEditStateToAll(state.editMode);
    bindFooterEvents(); // reaplica contentEditable nos destaques do rodapé
    filtrarEOrdenar();  // reconstrói os cards (badge vazio só aparece em Modo Edição)

    showToast(
      state.editMode
        ? '✏️ Modo edição ativado — clique nos textos para editar.'
        : '👁️ Modo visualização ativado.'
    );
  }

  function applyEditStateToAll(enabled) {
    document.querySelectorAll('.editable-field, .entrega-text').forEach(el => {
      el.contentEditable = enabled ? 'true' : 'false';
    });
  }

  function applyEditStateToCard(card, enabled) {
    card.querySelectorAll('.editable-field, .entrega-text').forEach(el => {
      el.contentEditable = enabled ? 'true' : 'false';
    });
  }

  /* ══════════════════════════════════════
     SALVAR (grava tudo no Supabase)
     ------------------------------------
     Estratégia: substitui por completo analistas/entregas/destaques
     da daily atual (apaga e reinsere) — simples e robusto, sem
     precisar reconciliar diffs de adições/remoções/edições. Os
     campos da própria daily (titulo/subtitulo/descricao/destaque)
     são atualizados via UPDATE.
  ══════════════════════════════════════ */
  async function salvar() {
    if (state.saving) return;

    if (state.modoDemo || !state.supabase) {
      showToast('⚠️ Configure o Supabase em js/config.js para salvar permanentemente. As alterações desta sessão não serão mantidas ao recarregar a página.');
      return;
    }

    // Antes de gravar, captura edições pendentes dos campos do cabeçalho
    // para que a checagem de conteúdo abaixo enxergue o estado atual.
    const d  = state.dados;
    d.titulo    = ui.titulo.textContent.trim()    || d.titulo;
    d.subtitulo = ui.subtitulo.textContent.trim() || d.subtitulo;
    d.descricao = ui.descricao.textContent.trim() || d.descricao;
    d.analistas = state.analistas;

    // Não cria/atualiza registros vazios: uma daily só é persistida se
    // tiver conteúdo de fato (entrega, badge ou destaque). Isso vale
    // tanto para rascunhos novos quanto para uma daily existente que o
    // usuário esvaziou — neste segundo caso, o correto é excluir.
    if (!temConteudoParaSalvar()) {
      if (d.id) {
        showToast('ℹ️ Esta daily está vazia. Para removê-la do histórico, use o botão Excluir.');
      } else {
        showToast('📝 Preencha ao menos uma entrega, badge ou destaque antes de salvar.');
      }
      return;
    }

    state.saving = true;
    ui.saveBtn.disabled = true;
    const originalHTML = ui.saveBtn.innerHTML;
    ui.saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      const sb = state.supabase;

      // 0) Se for um RASCUNHO (ainda não persistido), cria a linha da
      //    daily agora — é aqui que a daily "nasce" no banco, somente
      //    quando há conteúdo. Trata corrida de UNIQUE(data_daily).
      if (!d.id) {
        try {
          const { data: novaDaily, error: errNova } = await sb.from('dailies').insert({
            data_daily: d.dataDailyISO,
            titulo:     d.titulo,
            subtitulo:  d.subtitulo,
            descricao:  d.descricao,
          }).select('id').single();
          if (errNova) throw errNova;
          d.id = novaDaily.id;
        } catch (errInsert) {
          // Outra aba pode ter criado a daily desta data nesse meio-tempo.
          console.warn('[Salvar] Falha ao inserir daily nova (provável corrida de data):', errInsert);
          await carregarListaDailies();
          const jaCriada = state.dailiesLista.find(x => x.data_daily === d.dataDailyISO);
          if (jaCriada) {
            d.id = jaCriada.id; // reaproveita a linha existente; segue gravando o conteúdo
          } else {
            throw errInsert;
          }
        }
        // Mantém a lista/agenda em sincronia (sem duplicar).
        if (!state.dailiesLista.some(x => x.id === d.id)) {
          state.dailiesLista.push({ id: d.id, data_daily: d.dataDailyISO });
          state.dailiesLista.sort((a, b) => (a.data_daily < b.data_daily ? 1 : -1));
        }
        state.currentDailyId = d.id;
      }

      // 1) Campos da própria daily
      const { error: errDaily } = await sb.from('dailies').update({
        titulo:         d.titulo,
        subtitulo:      d.subtitulo,
        descricao:      d.descricao,
      }).eq('id', d.id);
      if (errDaily) throw errDaily;

      // 2) Substitui analistas (cascata apaga entregas automaticamente)
      const { error: errDelA } = await sb.from('analistas').delete().eq('daily_id', d.id);
      if (errDelA) throw errDelA;

      for (let i = 0; i < d.analistas.length; i++) {
        const a = d.analistas[i];
        const { data: aNova, error: errA } = await sb.from('analistas').insert({
          daily_id: d.id, nome: a.nome, cargo: a.cargo || 'Analista SRE e DevOps',
          foto: a.foto || '', badge_numero: a.badgeNumero || '', badge_texto: a.badgeTexto || '',
          badge_icone: a.badgeIcone || 'fa-solid fa-chart-line', cor_tema: a.corTema || COR_PADRAO,
          tags: Array.isArray(a.tags) ? a.tags : ['SRE', 'DevOps'], ordem: i,
        }).select('id').single();
        if (errA) throw errA;

        a.id = aNova.id; a._uid = aNova.id; // atualiza referência local

        const entregasValidas = (a.entregas || []).filter(t => t && t.trim());
        if (entregasValidas.length) {
          const { error: errE } = await sb.from('entregas').insert(
            entregasValidas.map((texto, idx) => ({ daily_id: d.id, analista_id: a.id, texto: texto.trim(), ordem: idx }))
          );
          if (errE) throw errE;
        }
      }

      // 3) Substitui destaques do rodapé
      const { error: errDelD } = await sb.from('destaques').delete().eq('daily_id', d.id);
      if (errDelD) throw errDelD;

      const destaquesValidos = (d.destaques || []).filter(x => x.texto && x.texto.trim());
      if (destaquesValidos.length) {
        const { data: novosDestaques, error: errD } = await sb.from('destaques').insert(
          destaquesValidos.map((x, idx) => ({ daily_id: d.id, texto: x.texto.trim(), ordem: idx }))
        ).select('id, texto');
        if (errD) throw errD;
        d.destaques = (novosDestaques || []).map(n => ({ _uid: n.id, texto: n.texto }));
      } else {
        d.destaques = [];
      }

      // 4) Substitui destaques principais do cabeçalho (1 a 4)
      const { error: errDelDC } = await sb.from('destaques_cabecalho').delete().eq('daily_id', d.id);
      if (errDelDC) throw errDelDC;

      const destaquesPrincipaisValidos = (d.destaquesPrincipais || []).slice(0, MAX_DESTAQUES_PRINCIPAIS);
      if (destaquesPrincipaisValidos.length) {
        const { data: novosDC, error: errDC } = await sb.from('destaques_cabecalho').insert(
          destaquesPrincipaisValidos.map((x, idx) => ({
            daily_id: d.id, chave: x.chave, texto: x.texto, icone: x.icone, cor: x.cor, ordem: idx,
          }))
        ).select('id, chave, texto, icone, cor');
        if (errDC) throw errDC;
        d.destaquesPrincipais = (novosDC || []).map(n => ({ _uid: n.id, chave: n.chave, texto: n.texto, icone: n.icone, cor: n.cor }));
      } else {
        d.destaquesPrincipais = [];
      }

      // Re-sincroniza UIDs dos cards (mudaram pois os ids foram recriados)
      // e atualiza o histórico/seletor (uma daily nova passa a aparecer).
      processarDados();
      renderHistorico();
      renderDateSelector();
      showToast('💾 Dados salvos com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      showToast('❌ Erro ao salvar — verifique sua conexão e tente novamente.');
    } finally {
      state.saving = false;
      ui.saveBtn.disabled = false;
      ui.saveBtn.innerHTML = originalHTML;
    }
  }

  /* ══════════════════════════════════════
     EXCLUIR DAILY
     ------------------------------------
     Remove por completo a daily atual do banco. As tabelas filhas
     (analistas, entregas, destaques, destaques_cabecalho) somem junto
     via ON DELETE CASCADE definido no schema — não há "estatística
     agregada" persistida em outra tabela, então não há nada a
     recalcular além de atualizar a lista/agenda em memória. Após
     excluir, navega para outra daily (a mais recente) ou monta o
     rascunho de hoje, mantendo o histórico íntegro.
  ══════════════════════════════════════ */
  async function excluirDaily() {
    if (state.saving) return;

    if (state.modoDemo || !state.supabase) {
      showToast('⚠️ Configure o Supabase em js/config.js para excluir dailies.');
      return;
    }

    const d = state.dados;

    // Rascunho ainda não salvo: não há nada no banco para excluir.
    if (!d || !d.id) {
      showToast('ℹ️ Esta daily ainda não foi salva — não há registro a excluir.');
      return;
    }

    const idAlvo  = d.id;
    const dataAlvo = d.dataDailyISO;

    confirmDialog(
      `Excluir a daily de <strong>${escHtml(formatarDataBR(dataAlvo))}</strong>?<br>
       <span style="font-size:12px;opacity:0.8">Esta ação remove o registro e todas as entregas, destaques e analistas dessa data. Não pode ser desfeita.</span>`,
      async () => {
        state.saving = true;
        try {
          // ON DELETE CASCADE remove as linhas filhas automaticamente.
          const { error } = await state.supabase.from('dailies').delete().eq('id', idAlvo);
          if (error) throw error;

          // Remove da lista/agenda em memória (mantém histórico íntegro).
          state.dailiesLista = state.dailiesLista.filter(x => x.id !== idAlvo);

          showToast('🗑️ Daily excluída com sucesso.');

          // Navega para uma daily ainda existente: a de hoje se houver,
          // senão a mais recente; se o banco ficou vazio, monta rascunho
          // de hoje (em memória, sem recriar registro).
          const hoje = state.dailiesLista.find(x => x.data_daily === state.todayISO);
          const alvo = hoje || state.dailiesLista[0] || null;
          if (alvo) {
            await carregarDailyPorId(alvo.id);
          } else {
            await montarRascunhoDaily(state.todayISO);
          }
          renderHistorico();
          renderDateSelector();
        } catch (err) {
          console.error('[Excluir daily]', err);
          showToast('❌ Não foi possível excluir a daily. Tente novamente.');
        } finally {
          state.saving = false;
        }
      }
    );
  }

  /**
   * Redimensiona uma imagem usando <canvas>, limitando o lado maior a
   * `maxSize` pixels, e retorna um data URL JPEG comprimido — mantém o
   * payload pequeno o bastante para gravar diretamente na coluna
   * `foto` (TEXT) da tabela analistas no Supabase.
   */
  function resizeImageFile(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Arquivo não é uma imagem válida'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width >= height) { height = Math.round(height * (maxSize / width)); width = maxSize; }
            else { width = Math.round(width * (maxSize / height)); height = maxSize; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ══════════════════════════════════════
     EXPORTAR IMAGEM (PNG)
  ══════════════════════════════════════ */
  async function exportarImagem() {
    if (state.exporting) return;

    // html2canvas vem de um CDN; se a rede o bloqueou, avisa de forma
    // clara em vez de estourar um ReferenceError genérico.
    if (typeof html2canvas === 'undefined') {
      showToast('❌ Biblioteca de imagem não carregou. Verifique a conexão e recarregue a página.');
      return;
    }

    state.exporting = true;

    const btn = ui.exportImg;
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    showToast('⏳ Gerando imagem... aguarde.');

    const wasEditing = state.editMode;
    if (wasEditing) {
      document.body.classList.remove('edit-mode');
      applyEditStateToAll(false);
    }

    ui.toolbar.style.setProperty('display', 'none', 'important');
    document.body.classList.add('is-exporting');
    await sleep(150);

    try {
      const docEl  = document.documentElement;
      const totalH = Math.max(document.body.scrollHeight, document.body.offsetHeight, docEl.scrollHeight, docEl.offsetHeight);
      const totalW = Math.max(document.body.scrollWidth, docEl.scrollWidth, docEl.clientWidth);
      const bgColor = getComputedStyle(document.body).backgroundColor || '#0F1B16';

      const canvas = await html2canvas(document.body, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: bgColor,
        scrollX: 0, scrollY: 0, x: 0, y: 0,
        width: totalW, height: totalH, windowWidth: totalW, windowHeight: totalH,
        logging: false, removeContainer: true, imageTimeout: 8000,
        onclone: (clonedDoc) => {
          const tb = clonedDoc.getElementById('js-toolbar');
          if (tb) tb.style.display = 'none';
          clonedDoc.querySelectorAll('.card-entregas').forEach(ul => {
            ul.style.maxHeight = 'none'; ul.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('.analyst-card').forEach(c => {
            c.style.animation = 'none'; c.style.opacity = '1'; c.style.transform = 'none';
          });
        }
      });

      const sufixo = ((state.dados && state.dados.dataDailyISO) || getSemana());
      const link = document.createElement('a');
      link.download = `Daily-Core-Credito-${sufixo}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      showToast('🖼️ Imagem gerada com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      showToast('❌ Erro ao gerar imagem. Tente novamente.');
    } finally {
      document.body.classList.remove('is-exporting');
      ui.toolbar.style.removeProperty('display');
      if (wasEditing) { document.body.classList.add('edit-mode'); applyEditStateToAll(true); }
      btn.disabled = false;
      btn.innerHTML = originalHTML;
      state.exporting = false;
    }
  }

  /* ══════════════════════════════════════
     ADICIONAR ANALISTA
  ══════════════════════════════════════ */
  function adicionarAnalista() {
    const cor = CORES_NOVO_ANALISTA[state.analistas.length % CORES_NOVO_ANALISTA.length];
    const novo = {
      _uid: gerarUidTemporario(), // sem "id" até o próximo Salvar
      nome: 'Novo Analista', cargo: 'Analista SRE e DevOps', foto: '',
      badgeNumero: '', badgeTexto: '', badgeIcone: 'fa-solid fa-chart-line',
      corTema: cor, tags: ['SRE', 'DevOps'], entregas: [],
    };
    state.analistas.push(novo);
    state.dados.analistas = state.analistas;
    filtrarEOrdenar();
    renderAvatares();

    setTimeout(() => {
      const cards = ui.grid.querySelectorAll('.analyst-card');
      if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    showToast('👤 Analista adicionado! Edite os campos e clique em Salvar.');
  }

  /* ══════════════════════════════════════
     FILTRAR E ORDENAR
  ══════════════════════════════════════ */
  function filtrarEOrdenar() {
    let lista = [...state.analistas];
    const q = state.query;

    if (q) {
      lista = lista.filter(a =>
        (a.nome || '').toLowerCase().includes(q) ||
        (a.cargo || '').toLowerCase().includes(q) ||
        (a.entregas || []).some(e => String(e || '').toLowerCase().includes(q))
      );
    }

    switch (state.sortBy) {
      case 'nome':     lista.sort((a, b) => (a.nome  || '').localeCompare(b.nome  || '', 'pt-BR')); break;
      case 'cargo':    lista.sort((a, b) => (a.cargo || '').localeCompare(b.cargo || '', 'pt-BR')); break;
      case 'entregas': lista.sort((a, b) => (b.entregas || []).length - (a.entregas || []).length); break;
    }

    state.filtrados = lista;
    renderCards();
  }

  /* ══════════════════════════════════════
     LINK COMPARTILHÁVEL
  ══════════════════════════════════════ */
  function gerarLink() {
    try {
      const params = new URLSearchParams();
      if (state.query) params.set('q', state.query);
      if (state.sortBy && state.sortBy !== 'default') params.set('ordenar', state.sortBy);
      if (state.currentDailyId) params.set('daily', state.currentDailyId);

      const hash = params.toString();
      const url  = `${location.origin}${location.pathname}${hash ? '#' + hash : ''}`;
      const msg  = hash ? '🔗 Link copiado! Inclui a daily/filtro atuais.' : '🔗 Link copiado para a área de transferência!';

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(
          () => showToast(msg),
          () => { // Permissão negada (comum em Safari/iOS fora de gesto direto) — usa fallback.
            fallbackCopy(url);
            showToast(msg);
          }
        );
      } else {
        fallbackCopy(url);
        showToast(msg);
      }
    } catch (_) {
      showToast('❌ Não foi possível gerar o link.');
    }
  }

  /** Restaura busca/ordenação/daily a partir do hash da URL. */
  async function restoreFromHash() {
    if (!location.hash || location.hash.length < 2) return;
    try {
      const params  = new URLSearchParams(location.hash.slice(1));
      const q       = params.get('q');
      const ordenar = params.get('ordenar');
      const dailyId = params.get('daily');
      let mudouFiltro = false;

      if (q) { state.query = q.toLowerCase(); if (ui.search) ui.search.value = q; mudouFiltro = true; }
      if (ordenar && ui.sort && [...ui.sort.options].some(o => o.value === ordenar)) {
        state.sortBy = ordenar; ui.sort.value = ordenar; mudouFiltro = true;
      }
      if (dailyId && state.supabase && dailyId !== state.currentDailyId) {
        // A daily do link pode ter sido excluída ou nem existir. Só
        // tenta carregar se ela está na lista; senão, avisa e mantém a
        // daily atual (não quebra o restante do fluxo).
        const existe = state.dailiesLista.some(d => d.id === dailyId);
        if (existe) {
          try {
            await carregarDailyPorId(dailyId);
          } catch (err) {
            console.warn('[restoreFromHash] Falha ao carregar daily do link:', err);
            showToast('⚠️ A daily desse link não pôde ser aberta. Exibindo a daily atual.');
          }
        } else {
          showToast('⚠️ A daily desse link não existe mais. Exibindo a daily atual.');
        }
      }
      if (mudouFiltro) filtrarEOrdenar();
    } catch (_) { /* hash inválido — ignora silenciosamente */ }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }

  /* ══════════════════════════════════════
     TEMA
  ══════════════════════════════════════ */
  // localStorage pode lançar SecurityError em navegação privada de
  // alguns navegadores (ex.: Safari iOS) ou quando o armazenamento está
  // bloqueado. Estes wrappers evitam que isso derrube o app — na pior
  // hipótese, o tema simplesmente não é lembrado entre sessões.
  function lsGet(chave) {
    try { return localStorage.getItem(chave); } catch (_) { return null; }
  }
  function lsSet(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch (_) { /* ignora */ }
  }

  function loadTheme() { applyTheme(lsGet(LS_THEME) || 'dark'); }
  function toggleTheme() { applyTheme(state.theme === 'dark' ? 'light' : 'dark'); lsSet(LS_THEME, state.theme); }
  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    if (ui.themeIcon) ui.themeIcon.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }

  /* ══════════════════════════════════════
     TOAST
  ══════════════════════════════════════ */
  let toastTimer = null;
  function showToast(msg, dur = 4200) {
    ui.toast.innerHTML = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), dur);
  }

  /* ══════════════════════════════════════
     MODAL DE CONFIRMAÇÃO
  ══════════════════════════════════════ */
  let _confirmCb = null;
  let _lastFocused = null;
  function confirmDialog(msg, cb) {
    ui.modalMsg.innerHTML = msg;
    ui.modal.classList.remove('hidden');
    _confirmCb = cb;
    _lastFocused = document.activeElement;
    ui.modalCancel.focus();
  }
  function closeModal() {
    ui.modal.classList.add('hidden');
    _confirmCb = null;
    if (_lastFocused && typeof _lastFocused.focus === 'function') _lastFocused.focus();
    _lastFocused = null;
  }

  /* ══════════════════════════════════════
     SELETOR DE ÍCONE DO BADGE
     ------------------------------------
     Reutiliza os mesmos ícones já cadastrados na biblioteca de
     destaques (js/destaques.js) — não há uma lista separada para
     manter. Clique no símbolo do indicador (em Modo Edição) abre
     este modal com uma grade de ícones; escolher um aplica na hora.
  ══════════════════════════════════════ */
  let _iconPickerCallback = null;
  let _iconPickerLastFocused = null;

  /** Ícones únicos (sem repetição) extraídos da biblioteca de destaques. */
  function getIconesUnicos() {
    const lib = getDestaquesLib();
    const vistos = new Set();
    const unicos = [];
    lib.forEach(o => {
      if (o.icone && !vistos.has(o.icone)) { vistos.add(o.icone); unicos.push(o.icone); }
    });
    return unicos;
  }

  /** Abre o modal de seleção de ícone. `onEscolher(icone)` é chamado
   *  com a classe Font Awesome escolhida; nada é alterado se o usuário
   *  cancelar (clique fora, Esc ou botão Cancelar). */
  function abrirSeletorIcone(iconeAtual, onEscolher) {
    if (!ui.iconPicker || !ui.iconPickerGrid) return;
    const icones = getIconesUnicos();

    ui.iconPickerGrid.innerHTML = icones.map(ic => `
      <button type="button"
              class="icon-picker-item${ic === iconeAtual ? ' active' : ''}"
              data-icon="${escHtml(ic)}"
              title="${escHtml(ic)}"
              aria-label="Usar ícone ${escHtml(ic)}">
        <i class="${escHtml(ic)}"></i>
      </button>`).join('');

    _iconPickerCallback = onEscolher;
    _iconPickerLastFocused = document.activeElement;
    ui.iconPicker.classList.remove('hidden');
    ui.iconPickerCancel?.focus();
  }

  function fecharSeletorIcone() {
    if (!ui.iconPicker) return;
    ui.iconPicker.classList.add('hidden');
    _iconPickerCallback = null;
    if (_iconPickerLastFocused && typeof _iconPickerLastFocused.focus === 'function') _iconPickerLastFocused.focus();
    _iconPickerLastFocused = null;
  }

  /* ══════════════════════════════════════
     LOADING
  ══════════════════════════════════════ */
  function hideLoading() { setTimeout(() => ui.loading.classList.add('hidden'), 400); }

  /* ══════════════════════════════════════
     BIND GLOBAL EVENTS
  ══════════════════════════════════════ */
  function bindGlobalEvents() {
    ui.search.addEventListener('input', (e) => { state.query = e.target.value.toLowerCase().trim(); filtrarEOrdenar(); });
    ui.sort.addEventListener('change', (e) => { state.sortBy = e.target.value; filtrarEOrdenar(); });

    ui.themeBtn.addEventListener('click', toggleTheme);
    ui.editBtn.addEventListener('click', toggleEditMode);
    ui.addAnalista.addEventListener('click', adicionarAnalista);
    ui.saveBtn.addEventListener('click', salvar);
    if (ui.deleteBtn) ui.deleteBtn.addEventListener('click', excluirDaily);
    ui.exportImg.addEventListener('click', exportarImagem);
    ui.shareBtn.addEventListener('click', gerarLink);

    if (ui.dateSelect) {
      ui.dateSelect.addEventListener('change', async (e) => {
        const id = e.target.value;
        // Ignora a opção transitória do rascunho (já é a daily exibida).
        if (id === '__rascunho__') return;
        if (!id || !state.supabase || id === state.currentDailyId) return;
        showToast('⏳ Carregando daily...');
        try { await carregarDailyPorId(id); }
        catch (err) { console.error('[Date selector]', err); showToast('❌ Erro ao carregar daily selecionada.'); }
      });
    }

    // Date picker: o botão de calendário abre o seletor de data nativo;
    // escolher uma data abre a daily dela (ou cria, se ainda não existe).
    if (ui.datePickerBtn && ui.datePicker) {
      ui.datePickerBtn.addEventListener('click', () => {
        if (state.modoDemo || !state.supabase) {
          showToast('⚠️ Configure o Supabase em js/config.js para criar dailies de outras datas.');
          return;
        }
        if (state.dados && state.dados.dataDailyISO) ui.datePicker.value = state.dados.dataDailyISO;
        // showPicker() é o método moderno; cai para .focus()+click() se indisponível.
        if (typeof ui.datePicker.showPicker === 'function') {
          try { ui.datePicker.showPicker(); return; } catch (_) {}
        }
        ui.datePicker.focus();
        ui.datePicker.click();
      });
      ui.datePicker.addEventListener('change', async (e) => {
        const dataISO = e.target.value;
        if (!dataISO) return;
        await irParaData(dataISO);
      });
    }

    // Histórico lateral: clique numa data abre a daily (delegação).
    if (ui.historicoList) {
      ui.historicoList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.historico-item');
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id || id === state.currentDailyId) { fecharHistoricoMobile(); return; }
        showToast('⏳ Carregando daily...');
        try { await carregarDailyPorId(id); fecharHistoricoMobile(); }
        catch (err) { console.error('[Histórico]', err); showToast('❌ Erro ao carregar daily.'); }
      });
    }
    // Toggle (desktop: recolher faixa lateral / mobile: fechar painel).
    if (ui.historicoToggle) {
      ui.historicoToggle.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 1024px)').matches) {
          fecharHistoricoMobile();
        } else {
          const recolhido = document.body.classList.toggle('historico-recolhido');
          ui.historicoToggle.setAttribute('aria-expanded', String(!recolhido));
        }
      });
    }
    // FAB (mobile): abre o painel de histórico como overlay.
    if (ui.historicoFab) {
      ui.historicoFab.addEventListener('click', () => {
        document.body.classList.add('historico-aberto');
      });
    }
    // Tocar no backdrop fecha o painel.
    if (ui.historicoBackdrop) {
      ui.historicoBackdrop.addEventListener('click', fecharHistoricoMobile);
    }

    if (ui.destaqueAddSelect) {
      ui.destaqueAddSelect.addEventListener('change', (e) => {
        adicionarDestaquePrincipal(e.target.value);
      });
    }

    // Delegação de evento: os chips são recriados a cada render, então
    // o listener fica no container fixo (.destaque-chips) em vez de em
    // cada botão individual.
    if (ui.destaqueChips) {
      ui.destaqueChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.destaque-chip-remove');
        if (!btn) return;
        removerDestaquePrincipal(btn.dataset.uid);
      });
    }

    if (ui.addDestaque) {
      ui.addDestaque.addEventListener('click', () => {
        if (!Array.isArray(state.dados.destaques)) state.dados.destaques = [];
        state.dados.destaques.push({ _uid: gerarUidTemporario(), texto: 'Novo destaque — clique para editar' });
        renderFooter();
        const ultimoLi = ui.footerList.querySelector('li:last-child .footer-destaque-text');
        if (ultimoLi) { ultimoLi.focus(); selectAll(ultimoLi); }
      });
    }

    // Seletor de ícones do badge (grid dentro do modal #js-icon-picker)
    if (ui.iconPickerGrid) {
      ui.iconPickerGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.icon-picker-item');
        if (!btn) return;
        const icone = btn.dataset.icon;
        const cb = _iconPickerCallback;
        fecharSeletorIcone();
        if (typeof cb === 'function') cb(icone);
      });
    }
    if (ui.iconPickerCancel) ui.iconPickerCancel.addEventListener('click', fecharSeletorIcone);
    if (ui.iconPicker) {
      ui.iconPicker.addEventListener('click', (e) => { if (e.target === ui.iconPicker) fecharSeletorIcone(); });
    }

    ui.modalCancel.addEventListener('click', closeModal);
    ui.modalConfirm.addEventListener('click', () => {
      const cb = _confirmCb; closeModal(); if (typeof cb === 'function') cb();
    });
    ui.modal.addEventListener('click', (e) => { if (e.target === ui.modal) closeModal(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ui.iconPicker && !ui.iconPicker.classList.contains('hidden')) { e.preventDefault(); fecharSeletorIcone(); return; }
      if (e.key === 'Escape' && !ui.modal.classList.contains('hidden')) { e.preventDefault(); closeModal(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (state.editMode) salvar(); }
      if (e.key === 'Escape' && state.editMode) toggleEditMode();
    });

    [ui.titulo, ui.subtitulo, ui.descricao].forEach(el => {
      if (!el) return;
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); } });
    });
  }

  /* ══════════════════════════════════════
     UTILS
  ══════════════════════════════════════ */
  function getByUid(uid) { return state.analistas.find(a => a._uid === uid) || null; }

  let _uidCounter = 0;
  function gerarUidTemporario() { return 'novo_' + (Date.now()).toString(36) + '_' + (_uidCounter++); }

  function getInitials(nome) {
    const limpo = String(nome || '').trim();
    if (!limpo) return '?';
    // Considera só "palavras" com ao menos um caractere visível — evita
    // o caso de string só com espaços, em que split retornaria [''] e
    // parts[0][0] seria undefined (quebrava o card).
    const parts = limpo.split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const ini = parts.length === 1
      ? parts[0][0]
      : parts[0][0] + parts[parts.length - 1][0];
    return ini.toUpperCase();
  }

  function hexAlpha(hex, alpha) {
    const c = String(hex || '').replace('#', '');
    const fallback = `rgba(37,154,108,${alpha})`;
    if (c.length < 6) return fallback;
    const r = parseInt(c.slice(0,2), 16), g = parseInt(c.slice(2,4), 16), b = parseInt(c.slice(4,6), 16);
    if (isNaN(r+g+b)) return fallback;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /** Escape para uso DENTRO de um atributo HTML entre aspas duplas
   *  (ex.: src="...", title="..."). Igual ao escHtml, mas com nome
   *  explícito no ponto de uso — deixa claro que o destino é um
   *  atributo, e protege contra quebra do atributo (ex.: uma foto
   *  com aspas + onerror injetando JS). */
  function escAttr(str) {
    return escHtml(str);
  }

  /** Valida uma cor antes de injetá-la em um style inline. Só aceita
   *  formatos seguros (#hex de 3/6 dígitos, rgb()/rgba()); qualquer
   *  outra coisa cai na cor padrão. Impede que um valor malicioso
   *  gravado em cor_tema escape do style e injete CSS/JS. */
  function corSegura(cor) {
    const c = String(cor || '').trim();
    if (/^#[0-9a-fA-F]{3}$/.test(c) || /^#[0-9a-fA-F]{6}$/.test(c)) return c;
    if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/.test(c)) return c;
    return COR_PADRAO;
  }

  function getSemana() {
    const n = new Date();
    const s = new Date(n.getFullYear(), 0, 1);
    const w = Math.ceil(((n - s) / 86400000 + s.getDay() + 1) / 7);
    return `${n.getFullYear()}-W${String(w).padStart(2, '0')}`;
  }

  /** Data de hoje em YYYY-MM-DD no fuso LOCAL do navegador (evita bug
   *  de "virar o dia errado" que ocorreria usando toISOString(), que
   *  é sempre UTC). */
  function getTodayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatarDataBR(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = String(isoDate).split('-');
    return `${(d||'01').padStart(2,'0')}/${(m||'01').padStart(2,'0')}/${y||''}`;
  }

  function selectAll(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s.removeAllRanges(); s.addRange(r);
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  /* ══════════════════════════════════════
     DADOS DEMO
     ------------------------------------
     Usados SOMENTE quando o Supabase não está configurado em
     js/config.js — garante que o app nunca abre em branco, mesmo
     antes de qualquer configuração de backend. Edições neste modo
     não são persistidas (ver salvar()).
  ══════════════════════════════════════ */
  function getDemoData() {
    const roster = seedRosterPadrao();
    const lib = getDestaquesLib();
    return {
      id: null,
      titulo: 'Principais Entregas da Semana',
      subtitulo: 'Time Core & Crédito',
      descricao: 'Resultados, melhorias operacionais, estabilidade e evolução contínua dos ambientes.',
      dataDaily: formatarDataBR(getTodayISO()),
      dataDailyISO: getTodayISO(),
      // Demonstra a biblioteca com até 2 exemplos prontos (se disponível).
      destaquesPrincipais: lib.slice(0, 2).map((o, i) => ({ _uid: 'demo_dp' + i, ...o })),
      destaques: [
        { _uid: 'demo_d1', texto: 'Configure o Supabase em js/config.js para habilitar o histórico' },
        { _uid: 'demo_d2', texto: 'Este é um conjunto de dados de demonstração' },
      ],
      analistas: roster.map((a, i) => ({
        _uid: 'demo_a' + i, id: null,
        nome: a.nome, cargo: a.cargo, foto: a.foto,
        badgeNumero: '', badgeTexto: '', badgeIcone: a.badge_icone,
        corTema: a.cor_tema, tags: a.tags, entregas: [],
      })),
    };
  }

  /* ══════════════════════════════════════
     START
  ══════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', init);

})();
