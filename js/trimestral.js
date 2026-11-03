/** Entrega Trimestral v9.0 | GitHub Pages + Supabase | sem frameworks. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const LOCK_KEY = 'daily-core-credito-global'; // MESMA chave do app.js
  const LOCK_TTL = 120;
  const HEARTBEAT_MS = 30000;
  const THEMES = ['dark', 'light', 'cooperative'];
  const THEME_NAMES = { dark: 'Escuro', light: 'Claro', cooperative: 'Cooperativo' };
  const ui = {
    alert: $('#tri-setup-alert'), list: $('#tri-list'), total: $('#tri-count-total'),
    current: $('#tri-count-current'), quarters: $('#tri-count-quarters'), results: $('#tri-result-count'),
    search: $('#tri-search'), year: $('#tri-filter-year'), quarter: $('#tri-filter-quarter'),
    reload: $('#tri-reload'), newBtn: $('#tri-new'), theme: $('#tri-theme-toggle'),
    themeLabel: $('#tri-theme-label'), formOverlay: $('#tri-form-overlay'),
    form: $('#tri-form'), formTitle: $('#tri-form-title'),
    owners: $('#tri-owners'), epic: $('#tri-epico'), initiative: $('#tri-iniciativa'),
    delivery: $('#tri-data'), preview: $('#tri-quarter-preview'),
    save: $('#tri-form-save'), cancel: $('#tri-form-cancel'), close: $('#tri-form-close'),
    confirmOverlay: $('#tri-confirm-overlay'), confirmText: $('#tri-confirm-text'),
    confirmCancel: $('#tri-confirm-cancel'), confirmDelete: $('#tri-confirm-delete'),
    toast: $('#tri-toast'),
  };
  const app = {
    sb: null, records: [], editingId: null, deleteId: null, lockHeld: false,
    heartbeat: null, isSaving: false, transitioning: false,
    token: newUUID(), modalActive: false,
  };

  function newUUID() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  const escapeHTML = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const quarterFor = date => Math.ceil(Number(String(date).slice(5, 7)) / 3);
  const yearFor = date => String(date).slice(0, 4);
  const periodFor = date => `${quarterFor(date)}º trimestre de ${yearFor(date)}`;
  const formatDate = date => {
    const [y, m, d] = String(date || '').split('-');
    return y && m && d ? `${d}/${m}/${y}` : '—';
  };
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  let toastTimer;
  function toast(message, ms = 4900) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
  }
  function showAlert(message) {
    ui.alert.textContent = message;
    ui.alert.classList.remove('hidden');
  }
  function messageList(message, icon = 'fa-folder-open') {
    ui.list.innerHTML = `<div class="tri-placeholder"><i class="fa-solid ${icon}" aria-hidden="true"></i><p>${escapeHTML(message)}</p></div>`;
  }

  function setTheme(value) {
    const theme = THEMES.includes(value) ? value : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    ui.themeLabel.textContent = THEME_NAMES[theme];
    const colors = { dark: '#0F1B16', light: '#EEF4F1', cooperative: '#146E37' };
    $('#js-theme-color')?.setAttribute('content', colors[theme]);
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    setTheme(next);
    try { localStorage.setItem('sicredi-daily-theme-v8', next); } catch (_) {}
  }

  async function loadRecords() {
    if (!app.sb) return;
    ui.reload.disabled = true;
    try {
      // Paginação previne o corte do histórico em 100 ou 1.000 entradas.
      const records = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await app.sb.from('entregas_trimestrais')
          .select('id,owners,numero_epico,iniciativa,data_entrega,created_at,updated_at')
          .order('data_entrega', { ascending: false })
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        records.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      app.records = records;
      ui.alert.classList.add('hidden');
      render();
    } catch (err) {
      console.error('[Trimestral] Falha na consulta:', err);
      showAlert('Não foi possível consultar entregas trimestrais. Se a página é nova, execute supabase/migration-entregas-trimestrais.sql no SQL Editor do seu Supabase. Confira também a conexão e as políticas de acesso.');
      messageList('Histórico indisponível. Verifique a migração SQL e clique em Atualizar.', 'fa-triangle-exclamation');
      ui.results.textContent = 'Falha na consulta';
      ui.total.textContent = '—'; ui.current.textContent = '—'; ui.quarters.textContent = '—';
    } finally {
      ui.reload.disabled = false;
    }
  }

  function render() {
    const actual = localToday();
    const currentKey = `${yearFor(actual)}-${quarterFor(actual)}`;
    const allQuarters = new Set(app.records.map(r => `${yearFor(r.data_entrega)}-${quarterFor(r.data_entrega)}`));
    ui.total.textContent = String(app.records.length);
    ui.current.textContent = String(app.records.filter(r => `${yearFor(r.data_entrega)}-${quarterFor(r.data_entrega)}` === currentKey).length);
    ui.quarters.textContent = String(allQuarters.size);

    const selectedYear = ui.year.value;
    const years = [...new Set(app.records.map(r => yearFor(r.data_entrega)))].sort().reverse();
    ui.year.innerHTML = '<option value="">Todos os anos</option>' + years.map(y => `<option value="${escapeHTML(y)}">${escapeHTML(y)}</option>`).join('');
    if (years.includes(selectedYear)) ui.year.value = selectedYear;

    const search = ui.search.value.trim().toLocaleLowerCase('pt-BR');
    const year = ui.year.value;
    const quarter = ui.quarter.value;
    const records = app.records.filter(r =>
      (!year || yearFor(r.data_entrega) === year) &&
      (!quarter || String(quarterFor(r.data_entrega)) === quarter) &&
      (!search || [r.owners, r.numero_epico, r.iniciativa, formatDate(r.data_entrega)]
        .some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(search)))
    );
    ui.results.textContent = `${records.length} ${records.length === 1 ? 'entrega encontrada' : 'entregas encontradas'}`;
    if (!records.length) {
      messageList(app.records.length ? 'Nenhuma entrega corresponde aos filtros.' : 'Ainda não há entregas. Use “Nova entrega” para começar.');
      return;
    }
    const groups = new Map();
    for (const r of records) {
      const key = `${yearFor(r.data_entrega)}-${quarterFor(r.data_entrega)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    ui.list.innerHTML = [...groups.entries()].map(([key, entries]) => {
      const [, q] = key.split('-');
      return `<section class="tri-quarter-group" aria-label="${escapeHTML(periodFor(entries[0].data_entrega))}">
        <div class="tri-quarter-title"><i class="fa-solid fa-calendar-week" aria-hidden="true"></i>
          ${escapeHTML(periodFor(entries[0].data_entrega))} <span class="tri-count">${entries.length} ${entries.length === 1 ? 'entrega' : 'entregas'}</span></div>
        <div class="tri-table-wrap"><table class="tri-table"><thead><tr><th>Owners</th><th>Épico</th><th>Iniciativa</th><th>Data entrega</th><th>Ações</th></tr></thead>
        <tbody>${entries.map(r => `<tr><td>${escapeHTML(r.owners)}</td><td><span class="tri-epic">${escapeHTML(r.numero_epico)}</span></td>
          <td>${escapeHTML(r.iniciativa).replace(/\n/g, '<br>')}</td><td>${formatDate(r.data_entrega)}</td>
          <td><div class="tri-cell-actions"><button type="button" class="tri-action" data-action="edit" data-id="${escapeHTML(r.id)}" title="Editar entrega" aria-label="Editar épico ${escapeHTML(r.numero_epico)}"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="tri-action tri-action--danger" data-action="delete" data-id="${escapeHTML(r.id)}" title="Excluir entrega" aria-label="Excluir épico ${escapeHTML(r.numero_epico)}"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('')}</tbody></table></div></section>`;
    }).join('');
  }

  async function lockAcquire() {
    if (!app.sb) { toast('Configure o Supabase antes de editar.'); return false; }
    if (app.lockHeld) return true;
    try {
      const { data, error } = await app.sb.rpc('acquire_app_edit_lock', {
        p_lock_key: LOCK_KEY, p_owner_token: app.token, p_ttl_seconds: LOCK_TTL,
      });
      if (error) throw error;
      if (data !== true) {
        toast('🔒 Alguém já está editando a aplicação. Tente novamente em instantes.', 7500);
        return false;
      }
      app.lockHeld = true;
      clearInterval(app.heartbeat);
      app.heartbeat = setInterval(async () => {
        if (!app.lockHeld) return;
        const ok = await lockRenew();
        if (ok === false) lockLost();
      }, HEARTBEAT_MS);
      return true;
    } catch (err) {
      console.error('[Trimestral] Falha ao obter bloqueio:', err);
      toast('Não foi possível adquirir o bloqueio. Confira a conexão e a migração de edição do Supabase.', 7000);
      return false;
    }
  }
  async function lockRenew() {
    if (!app.lockHeld) return false;
    try {
      const { data, error } = await app.sb.rpc('renew_app_edit_lock', {
        p_lock_key: LOCK_KEY, p_owner_token: app.token, p_ttl_seconds: LOCK_TTL,
      });
      if (error) throw error;
      return data === true;
    } catch (err) {
      console.warn('[Trimestral] Rede falhou durante a renovação', err);
      return null; // falha transitória, não declara lock perdido
    }
  }
  async function ensureLock() {
    const ok = await lockRenew();
    if (ok === false) lockLost();
    if (ok === null) toast('Conexão indisponível: não foi possível validar a edição.', 6500);
    return ok === true;
  }
  async function lockRelease() {
    clearInterval(app.heartbeat);
    app.heartbeat = null;
    if (!app.lockHeld) return;
    app.lockHeld = false;
    try {
      const { error } = await app.sb.rpc('release_app_edit_lock', {
        p_lock_key: LOCK_KEY, p_owner_token: app.token,
      });
      if (error) throw error;
    } catch (err) {
      console.warn('[Trimestral] Falha ao liberar o bloqueio; o TTL fará a liberação', err);
    }
  }
  function releaseOnPagehide() {
    if (!app.lockHeld) return;
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg?.url || !cfg?.anonKey) return;
    try {
      fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/release_app_edit_lock', {
        method: 'POST', keepalive: true,
        headers: { 'apikey': cfg.anonKey, 'Authorization': 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_lock_key: LOCK_KEY, p_owner_token: app.token }),
      }).catch(() => {});
    } catch (_) { /* o TTL cobre fechamentos repentinos */ }
  }
  function lockLost() {
    clearInterval(app.heartbeat);
    app.heartbeat = null;
    app.lockHeld = false;
    ui.formOverlay.classList.add('hidden');
    app.modalActive = false;
    toast('O bloqueio de edição expirou. Alterações não salvas foram descartadas.', 7500);
  }

  async function openForm(record = null) {
    if (app.transitioning || app.isSaving || app.modalActive) return;
    app.transitioning = true;
    try {
      if (!await lockAcquire()) return;
      app.editingId = record?.id || null;
      ui.form.reset();
      ui.formTitle.textContent = record ? 'Editar entrega trimestral' : 'Nova entrega trimestral';
      ui.owners.value = record?.owners || '';
      ui.epic.value = record?.numero_epico || '';
      ui.initiative.value = record?.iniciativa || '';
      ui.delivery.value = record?.data_entrega || localToday();
      updateQuarterPreview();
      app.modalActive = true;
      ui.formOverlay.classList.remove('hidden');
      ui.owners.focus();
    } finally {
      app.transitioning = false;
    }
  }
  async function closeForm() {
    if (app.isSaving) return;
    ui.formOverlay.classList.add('hidden');
    app.modalActive = false;
    app.editingId = null;
    await lockRelease();
    ui.newBtn.focus();
  }
  function updateQuarterPreview() {
    ui.preview.textContent = ui.delivery.value
      ? `A entrega será registrada no ${periodFor(ui.delivery.value)}.`
      : 'Selecione a data para identificar o trimestre.';
  }
  async function saveForm(event) {
    event.preventDefault();
    if (app.isSaving || !app.modalActive) return;
    const payload = {
      owners: ui.owners.value.trim(), numero_epico: ui.epic.value.trim(),
      iniciativa: ui.initiative.value.trim(), data_entrega: ui.delivery.value,
    };
    if (!payload.owners || !payload.numero_epico || !payload.iniciativa || !/^\d{4}-\d{2}-\d{2}$/.test(payload.data_entrega)) {
      toast('Preencha os quatro campos obrigatórios.'); return;
    }
    if (!await ensureLock()) return;
    app.isSaving = true;
    ui.save.disabled = true;
    try {
      const query = app.editingId
        ? app.sb.from('entregas_trimestrais').update(payload).eq('id', app.editingId)
        : app.sb.from('entregas_trimestrais').insert(payload);
      const { error } = await query;
      if (error) throw error;
      ui.formOverlay.classList.add('hidden');
      app.modalActive = false;
      app.editingId = null;
      await lockRelease();
      toast('✅ Entrega trimestral salva no Supabase!');
      await loadRecords();
    } catch (err) {
      console.error('[Trimestral] Falha ao salvar:', err);
      toast('Erro ao salvar. Verifique a conexão, as permissões ou a migração SQL.', 6500);
    } finally {
      app.isSaving = false;
      ui.save.disabled = false;
    }
  }
  function showDelete(id) {
    if (app.transitioning || app.isSaving || app.modalActive) return;
    const r = app.records.find(x => x.id === id);
    if (!r) return;
    app.deleteId = id;
    ui.confirmText.textContent = `Deseja excluir o épico ${r.numero_epico}, da iniciativa “${r.iniciativa.slice(0, 90)}”? Esta ação não pode ser desfeita.`;
    ui.confirmOverlay.classList.remove('hidden');
    ui.confirmCancel.focus();
  }
  function closeDelete() {
    if (app.isSaving) return;
    ui.confirmOverlay.classList.add('hidden');
    app.deleteId = null;
  }
  async function deleteRecord() {
    if (app.isSaving || app.transitioning || !app.deleteId) return;
    app.transitioning = true;
    ui.confirmDelete.disabled = true;
    try {
      if (!await lockAcquire()) return;
      if (!await ensureLock()) return;
      app.isSaving = true;
      const { error } = await app.sb.from('entregas_trimestrais').delete().eq('id', app.deleteId);
      if (error) throw error;
      ui.confirmOverlay.classList.add('hidden');
      app.deleteId = null;
      toast('🗑️ Entrega removida do histórico.');
      await loadRecords();
    } catch (err) {
      console.error('[Trimestral] Falha ao excluir:', err);
      toast('Não foi possível excluir a entrega. Tente novamente.', 6500);
    } finally {
      app.isSaving = false;
      app.transitioning = false;
      ui.confirmDelete.disabled = false;
      await lockRelease();
    }
  }

  async function init() {
    setTheme(document.documentElement.getAttribute('data-theme'));
    ui.theme.addEventListener('click', toggleTheme);
    ui.search.addEventListener('input', render);
    ui.year.addEventListener('change', render);
    ui.quarter.addEventListener('change', render);
    ui.reload.addEventListener('click', loadRecords);
    ui.newBtn.addEventListener('click', () => openForm());
    ui.cancel.addEventListener('click', closeForm);
    ui.close.addEventListener('click', closeForm);
    ui.delivery.addEventListener('change', updateQuarterPreview);
    ui.form.addEventListener('submit', saveForm);
    ui.list.addEventListener('click', event => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      const record = app.records.find(r => r.id === btn.dataset.id);
      if (btn.dataset.action === 'edit' && record) openForm(record);
      if (btn.dataset.action === 'delete') showDelete(btn.dataset.id);
    });
    ui.confirmCancel.addEventListener('click', closeDelete);
    ui.confirmDelete.addEventListener('click', deleteRecord);
    ui.confirmOverlay.addEventListener('click', e => { if (e.target === ui.confirmOverlay) closeDelete(); });
    ui.formOverlay.addEventListener('click', e => { if (e.target === ui.formOverlay) closeForm(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !app.isSaving) {
        if (!ui.formOverlay.classList.contains('hidden')) closeForm();
        else if (!ui.confirmOverlay.classList.contains('hidden')) closeDelete();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && app.modalActive) { e.preventDefault(); ui.form.requestSubmit(); }
    });
    window.addEventListener('beforeunload', event => {
      if (app.modalActive && !app.isSaving) { event.preventDefault(); event.returnValue = ''; }
    });
    window.addEventListener('pagehide', releaseOnPagehide);
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && app.lockHeld && await lockRenew() === false) lockLost();
    });
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anonKey || cfg.url.includes('XXXXXXXXXX') || !window.supabase?.createClient) {
      ui.newBtn.disabled = true;
      showAlert('Supabase não configurado ou biblioteca de conexão indisponível. Configure js/config.js e verifique a internet para salvar e consultar entregas.');
      messageList('Nenhum banco conectado. Esta página não guarda dados apenas no navegador.', 'fa-database');
      ui.results.textContent = 'Banco não conectado';
      return;
    }
    try {
      app.sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } });
      await loadRecords();
    } catch (err) {
      console.error('[Trimestral] Falha na conexão:', err);
      showAlert('Falha ao iniciar a conexão com Supabase. Confira js/config.js.');
      messageList('Não foi possível inicializar o banco.', 'fa-triangle-exclamation');
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
