'use strict';

// ----------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------

const THEMES = {
  broadband:           { label: 'Broadband & Digital Access',  color: '#2563EB' },
  'community-wealth':  { label: 'Community Wealth-Building',   color: '#059669' },
  'rural-placemaking': { label: 'Rural Placemaking',           color: '#7C3AED' },
  'small-communities': { label: 'Small Communities',           color: '#D97706' },
  'native-nations':    { label: 'Native Nations',              color: '#DC2626' },
  philanthropy:        { label: 'Philanthropy & Grants',       color: '#C9922A' },
};

const OUTLET_TIERS = {
  1: { label: 'T1 · Home Area',       short: 'T1', color: '#059669', bg: '#D1FAE5' },
  2: { label: 'T2 · Statewide Rural', short: 'T2', color: '#2563EB', bg: '#DBEAFE' },
  3: { label: 'T3 · National',        short: 'T3', color: '#6B7280', bg: '#F3F4F6' },
  0: { label: 'Major Metro',          short: 'MET', color: '#D97706', bg: '#FEF3C7' },
};

const PROMINENCE_OPTS = {
  headline: { label: 'Headline',       score: 1.00 },
  body:     { label: 'Body Coverage',  score: 0.55 },
  passing:  { label: 'Passing Ref.',   score: 0.20 },
};

const SENTIMENT_OPTS = {
  'very-positive': { label: 'Very Positive',    score: 1.00 },
  positive:        { label: 'Positive',          score: 0.75 },
  neutral:         { label: 'Neutral',           score: 0.50 },
  critical:        { label: 'Mixed',  score: 0.20 },
};

const PULL_OPTS = {
  yes:     { label: 'On Message',     score: 1.00 },
  partial: { label: 'Partial',         score: 0.50 },
  no:      { label: 'Off Message',    score: 0.10 },
};

const NARRATIVE_OPTS = {
  primary:    { label: 'Primary Subject' },
  source:     { label: 'Source/Quoted' },
  comparison: { label: 'Comparison' },
  passing:    { label: 'Passing' },
};

const GEO_LABELS  = { national: 'National', state: 'State', local: 'Local' };
const TYPE_LABELS = { news: 'News', blog: 'Blog', government: 'Gov.', advocacy: 'Advocacy', academic: 'Academic', social: 'Social', other: 'Other' };
const METHOD_LABELS = { 'google-alerts': 'Google Alerts', 'rss-feed': 'RSS Feed', 'web-search': 'Web Search', manual: 'Manual' };

const DEFAULT_WEIGHTS = { tier: 30, prominence: 25, sentiment: 25, pullThrough: 20 };

// ----------------------------------------------------------------
// STATE
// ----------------------------------------------------------------

let state = {
  filters: { source: '', theme: '', tier: '', method: '', notable: false },
  sortOrder: 'newest',
  weights: { ...DEFAULT_WEIGHTS },
  manualEntries: [],
  pressReleases: [],
  overrides: {},
  editingMentionId: null,
  charts: {},
};

// ----------------------------------------------------------------
// INIT
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  state.manualEntries  = loadLS('blandin_manual', []);
  state.weights        = loadLS('blandin_weights', { ...DEFAULT_WEIGHTS });
  state.pressReleases  = loadLS('blandin_press_releases', []);
  state.overrides      = loadLS('blandin_overrides', {});

  const dateInput = document.getElementById('e-date');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  const prDateInput = document.getElementById('pr-date');
  if (prDateInput) prDateInput.value = new Date().toISOString().slice(0, 10);

  renderDashboard();
  renderScoringTab();
  renderSearchLogTab();
  renderAllStoriesTab();
  renderUpdateBadge();
  renderManualTab();
  renderPressReleasesTab();
});

// ----------------------------------------------------------------
// TAB SWITCHING
// ----------------------------------------------------------------

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'scoring') renderScoringTab();
}

function togglePanel(id) {
  document.getElementById(id).classList.toggle('hidden');
}

// ----------------------------------------------------------------
// SCORING ENGINE
// ----------------------------------------------------------------

function calculateScore(mention, weights) {
  const w = weights || state.weights;
  const tierScores = { 1: 1.0, 2: 0.65, 3: 0.45, 0: 0.30 };
  const tScore  = tierScores[mention.tier ?? 2] ?? 0.5;
  const pScore  = PROMINENCE_OPTS[mention.prominence || 'body']?.score ?? 0.5;
  const sScore  = SENTIMENT_OPTS[mention.sentiment || 'neutral']?.score ?? 0.5;
  const ptScore = PULL_OPTS[mention.pullThrough || 'partial']?.score ?? 0.5;

  const total = w.tier + w.prominence + w.sentiment + w.pullThrough;
  if (!total) return 0;

  const raw = (tScore * w.tier + pScore * w.prominence + sScore * w.sentiment + ptScore * w.pullThrough) / total;
  const bonus = mention.notable ? 0.05 : 0;
  return Math.min(100, Math.round((raw + bonus) * 100));
}

function scoreClass(score) {
  if (score >= 70) return 'score-high';
  if (score >= 45) return 'score-mid';
  return 'score-low';
}

function scoreBadge(mention) {
  const s = calculateScore(mention);
  return `<div class="score-badge ${scoreClass(s)}">${s}</div>`;
}

// ----------------------------------------------------------------
// DATA HELPERS
// ----------------------------------------------------------------

function getBaseMentions() {
  return [...AUTO_MENTIONS, ...state.manualEntries.map(e => ({ ...e, method: 'manual' }))];
}

function applyOverrides(list) {
  return list.map(m => state.overrides[m.id] ? { ...m, ...state.overrides[m.id] } : m);
}

function isManualId(id) { return id.startsWith('manual-'); }

function getAllMentions() {
  return applyOverrides(getBaseMentions()).filter(m => !m._hidden);
}

function getFilteredMentions() {
  const { source, theme, tier, method, notable } = state.filters;
  return getAllMentions().filter(m => {
    if (source  && m.sourceType !== source)                 return false;
    if (theme   && !m.themes.includes(theme))               return false;
    if (tier    && String(m.tier ?? 2) !== String(tier))    return false;
    if (method  && m.method !== method)                     return false;
    if (notable && !m.notable)                              return false;
    return true;
  });
}

function applyFilters() {
  state.filters = {
    source:  document.getElementById('f-source').value,
    theme:   document.getElementById('f-theme').value,
    tier:    document.getElementById('f-tier').value,
    method:  document.getElementById('f-method').value,
    notable: document.getElementById('f-notable').checked,
  };
  updateDashboard();
}

function clearFilters() {
  ['f-source','f-theme','f-tier','f-method'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-notable').checked = false;
  state.filters = { source: '', theme: '', tier: '', method: '', notable: false };
  updateDashboard();
}

function weekKey(d) {
  const dt = new Date(d + 'T12:00:00');
  const mon = new Date(dt);
  mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return mon.toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${+day}, ${y}`;
}

// ----------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------

function renderDashboard() { updateDashboard(); renderLatestAdded(); }

function refreshAllViews() {
  renderManualTab();
  updateDashboard();
  renderLatestAdded();
  renderScoringTab();
  renderAllStoriesTab();
}

function updateDashboard() {
  const data = getFilteredMentions();
  renderMetrics(data);
  renderThemePills(data);
  renderCharts(data);
  renderMentionTable(data);
}

function renderLatestAdded() {
  const c = document.getElementById('latest-added-list');
  if (!c) return;
  const recent = [...AUTO_MENTIONS, ...state.manualEntries.map(e => ({ ...e, method: 'manual' }))]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  c.innerHTML = recent.length
    ? recent.map(m => articleRow(m)).join('')
    : '<div style="padding:20px;color:var(--muted);text-align:center">No auto-discovered or manually added articles yet — check back after the scheduled search runs.</div>';
}

function renderUpdateBadge() {
  const el = document.getElementById('last-updated-date');
  if (!el) return;
  const lastRunDate = SEARCH_LOG.length
    ? [...SEARCH_LOG].sort((a, b) => b.date.localeCompare(a.date))[0].date
    : null;
  el.textContent = lastRunDate ? fmtDate(lastRunDate) : 'Not yet run';
}

function renderSearchLogTab() {
  const tbody = document.getElementById('search-log-tbody');
  const box = document.getElementById('search-log-stats-box');
  const countEl = document.getElementById('search-log-count');
  if (!tbody) return;

  const runs = [...SEARCH_LOG].sort((a, b) => b.date.localeCompare(a.date));
  const foundRuns = runs.filter(r => r.found > 0).length;

  if (countEl) countEl.textContent = `${runs.length} run${runs.length === 1 ? '' : 's'}`;
  if (box) box.innerHTML = `<div class="stat-line"><strong>${runs.length}</strong> total runs</div><div class="stat-line"><strong>${foundRuns}</strong> found articles</div><div class="stat-line">${runs.length - foundRuns} came up empty</div>`;

  tbody.innerHTML = runs.length ? runs.map(r => `
    <tr>
      <td>${fmtDate(r.date)}</td>
      <td>${r.found > 0
        ? `<span class="status-pill status-found">&#10003; Found ${r.found}</span>`
        : `<span class="status-pill status-none">No new articles</span>`}</td>
      <td>${(r.articles || []).map(a => a.url
        ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>`
        : esc(a.title)).join('<br>') || '&mdash;'}</td>
    </tr>`).join('') : `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--muted)">No search runs logged yet — check back after the scheduled search runs.</td></tr>`;
}

// ----------------------------------------------------------------
// ALL STORIES TAB (view / edit every story regardless of source)
// ----------------------------------------------------------------

function renderAllStoriesTab() {
  const tbody = document.getElementById('all-stories-tbody');
  const countEl = document.getElementById('all-stories-count');
  if (!tbody) return;

  const showHidden = document.getElementById('all-stories-show-hidden')?.checked;
  const q = (document.getElementById('all-stories-search')?.value || '').toLowerCase().trim();

  let list = applyOverrides(getBaseMentions());
  if (!showHidden) list = list.filter(m => !m._hidden);
  if (q) list = list.filter(m => m.title.toLowerCase().includes(q) || m.source.toLowerCase().includes(q));
  list = list.sort((a, b) => b.date.localeCompare(a.date));

  if (countEl) countEl.textContent = `${list.length} ${list.length === 1 ? 'story' : 'stories'}`;

  tbody.innerHTML = list.length ? list.map(m => `
    <tr${m._hidden ? ' style="opacity:.5"' : ''}>
      <td>${scoreBadge(m)}</td>
      <td style="white-space:nowrap">${fmtDate(m.date)}</td>
      <td class="headline-cell">
        ${m.url ? `<a class="headline-link" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : `<span class="headline-link">${esc(m.title)}</span>`}
        ${m._hidden ? '<div class="headline-snippet">Hidden from dashboard &amp; log</div>' : ''}
      </td>
      <td>${sourceCell(m)}</td>
      <td>${methodTag(m.method)}</td>
      <td><span class="attr-tag sentiment-${m.sentiment || 'neutral'}">${SENTIMENT_OPTS[m.sentiment]?.label || '—'}</span></td>
      <td>${m.notable ? '<span class="notable-yes">&#9733; Yes</span>' : '<span class="notable-no">—</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn-sm btn-outline" onclick="openEditModal('${m.id}')">Edit</button>
        ${m._hidden
          ? `<button class="btn-sm btn-ghost" onclick="restoreStory('${m.id}')">Restore</button>`
          : `<button class="btn-delete" onclick="hideStory('${m.id}')" title="Hide from dashboard">&#10005;</button>`}
      </td>
    </tr>`).join('') : '<tr><td colspan="8" class="empty-state">No stories match.</td></tr>';
}

function hideStory(id) {
  if (isManualId(id)) {
    if (!confirm('Delete this manually logged entry? This cannot be undone.')) return;
    state.manualEntries = state.manualEntries.filter(e => e.id !== id);
    saveLS('blandin_manual', state.manualEntries);
  } else {
    state.overrides[id] = { ...(state.overrides[id] || {}), _hidden: true };
    saveLS('blandin_overrides', state.overrides);
  }
  refreshAllViews();
  showToast('Story hidden from dashboard.');
}

function restoreStory(id) {
  if (state.overrides[id]) {
    const { _hidden, ...rest } = state.overrides[id];
    if (Object.keys(rest).length) state.overrides[id] = rest; else delete state.overrides[id];
    saveLS('blandin_overrides', state.overrides);
  }
  refreshAllViews();
  showToast('Story restored.');
}

function openEditModal(id) {
  const base = getBaseMentions().find(m => m.id === id);
  if (!base) return;
  const m = state.overrides[id] ? { ...base, ...state.overrides[id] } : base;
  state.editingMentionId = id;

  document.getElementById('edit-title').value = m.title || '';
  document.getElementById('edit-source').value = m.source || '';
  document.getElementById('edit-url').value = m.url || '';
  document.getElementById('edit-date').value = m.date || '';
  document.getElementById('edit-source-type').value = m.sourceType || 'news';
  document.getElementById('edit-tier').value = String(m.tier ?? 2);
  document.getElementById('edit-geo').value = m.geography || 'state';
  document.getElementById('edit-prominence').value = m.prominence || 'body';
  document.getElementById('edit-sentiment').value = m.sentiment || 'positive';
  document.getElementById('edit-pull').value = m.pullThrough || 'partial';
  document.getElementById('edit-narrative').value = m.narrativeRole || 'primary';
  document.getElementById('edit-notable').checked = !!m.notable;
  document.getElementById('edit-snippet').value = m.snippet || '';
  document.querySelectorAll('input[name="edit-theme"]').forEach(cb => { cb.checked = (m.themes || []).includes(cb.value); });

  document.getElementById('edit-modal-title').textContent = `Edit Story`;
  document.getElementById('edit-modal-source-note').textContent =
    isManualId(id) ? 'Manually logged entry — edits save directly.'
    : `Originally from ${METHOD_LABELS[base.method] || base.method}. Edits are saved as a local override on top of the original.`;
  document.getElementById('edit-reset-btn').classList.toggle('hidden', isManualId(id) || !state.overrides[id]);

  document.getElementById('edit-modal-overlay').classList.remove('hidden');
}

function closeEditModal() {
  state.editingMentionId = null;
  document.getElementById('edit-modal-overlay').classList.add('hidden');
}

function saveEditModal(e) {
  e.preventDefault();
  const id = state.editingMentionId;
  if (!id) return;
  const themes = Array.from(document.querySelectorAll('input[name="edit-theme"]:checked')).map(i => i.value);
  const fields = {
    title:        document.getElementById('edit-title').value.trim(),
    source:       document.getElementById('edit-source').value.trim(),
    url:          document.getElementById('edit-url').value.trim(),
    date:         document.getElementById('edit-date').value,
    sourceType:   document.getElementById('edit-source-type').value,
    tier:         parseInt(document.getElementById('edit-tier').value),
    geography:    document.getElementById('edit-geo').value,
    prominence:   document.getElementById('edit-prominence').value,
    sentiment:    document.getElementById('edit-sentiment').value,
    pullThrough:  document.getElementById('edit-pull').value,
    narrativeRole:document.getElementById('edit-narrative').value,
    themes,
    notable:      document.getElementById('edit-notable').checked,
    snippet:      document.getElementById('edit-snippet').value.trim(),
  };
  if (isManualId(id)) {
    const idx = state.manualEntries.findIndex(e => e.id === id);
    if (idx !== -1) state.manualEntries[idx] = { ...state.manualEntries[idx], ...fields };
    saveLS('blandin_manual', state.manualEntries);
  } else {
    state.overrides[id] = { ...(state.overrides[id] || {}), ...fields };
    saveLS('blandin_overrides', state.overrides);
  }
  closeEditModal();
  refreshAllViews();
  showToast('Story updated.');
}

function resetStoryToOriginal() {
  const id = state.editingMentionId;
  if (!id) return;
  delete state.overrides[id];
  saveLS('blandin_overrides', state.overrides);
  closeEditModal();
  refreshAllViews();
  showToast('Reverted to original.');
}

function renderMetrics(data) {
  const scores   = data.map(m => calculateScore(m));
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const t1count  = data.filter(m => m.tier === 1).length;

  set('m-total',    data.length);
  set('m-notable',  data.filter(m => m.notable).length);
  set('m-avg-score', avgScore);
  set('m-t1-count', t1count);
}

function renderThemePills(data) {
  const counts = {};
  data.forEach(m => m.themes.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('theme-pills');
  if (!el) return;
  el.innerHTML = sorted.length
    ? sorted.map(([t, n]) => `
        <div class="theme-pill" data-theme="${t}">
          ${THEMES[t]?.label || t}
          <span class="pill-count">${n}</span>
        </div>`).join('')
    : '<span style="color:var(--muted);font-size:13px;padding:4px 0">No data for current filters.</span>';
}

// ----------------------------------------------------------------
// CHARTS
// ----------------------------------------------------------------

const CHART_COLORS = {
  broadband: '#2563EB', 'community-wealth': '#059669', 'rural-placemaking': '#7C3AED',
  'small-communities': '#D97706', 'native-nations': '#DC2626', philanthropy: '#C9922A',
  'google-alerts': '#4285F4', 'rss-feed': '#F26522', 'web-search': '#0D9488', manual: '#6B7280',
  1: '#059669', 2: '#2563EB', 3: '#9CA3AF', 0: '#D97706',
};

function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

function renderCharts(data) {
  renderWeeklyChart(data);
  renderTierChart(data);
  renderThemeChart(data);
  renderMethodChart(data);
}

function renderWeeklyChart(data) {
  destroyChart('weekly');
  const ctx = document.getElementById('chart-weekly');
  if (!ctx) return;
  const wm = {};
  const methods = ['google-alerts', 'rss-feed', 'web-search', 'manual'];
  data.forEach(m => { const w = weekKey(m.date); if (!wm[w]) wm[w] = {}; wm[w][m.method] = (wm[w][m.method] || 0) + 1; });
  const weeks = Object.keys(wm).sort();
  const labels = weeks.map(w => { const d = new Date(w + 'T12:00:00'); return `${d.toLocaleString('default',{month:'short'})} ${d.getDate()}`; });
  state.charts['weekly'] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: methods.map(m => ({ label: METHOD_LABELS[m], data: weeks.map(w => wm[w][m] || 0), backgroundColor: (CHART_COLORS[m] || '#aaa') + 'CC', borderColor: CHART_COLORS[m] || '#aaa', borderWidth: 1 })) },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, scales: { x: { stacked: true, ticks: { font: { size: 11 } } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } } } },
  });
}

function renderTierChart(data) {
  destroyChart('tier');
  const ctx = document.getElementById('chart-tier');
  if (!ctx) return;
  const counts = {};
  data.forEach(m => { const t = m.tier ?? 2; counts[t] = (counts[t] || 0) + 1; });
  const keys = [1, 2, 3, 0].filter(k => counts[k]);
  state.charts['tier'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: keys.map(k => OUTLET_TIERS[k]?.label || k), datasets: [{ data: keys.map(k => counts[k]), backgroundColor: keys.map(k => (CHART_COLORS[k] || '#aaa') + 'CC'), borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } } },
  });
}

function renderThemeChart(data) {
  destroyChart('theme');
  const ctx = document.getElementById('chart-theme');
  if (!ctx) return;
  const counts = {};
  data.forEach(m => m.themes.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  state.charts['theme'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: sorted.map(([t]) => THEMES[t]?.label || t), datasets: [{ data: sorted.map(([, n]) => n), backgroundColor: sorted.map(([t]) => (CHART_COLORS[t] || '#aaa') + 'CC'), borderColor: sorted.map(([t]) => CHART_COLORS[t] || '#aaa'), borderWidth: 1 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } }, y: { ticks: { font: { size: 11 } } } } },
  });
}

function renderMethodChart(data) {
  destroyChart('method');
  const ctx = document.getElementById('chart-method');
  if (!ctx) return;
  const counts = {};
  data.forEach(m => { counts[m.method] = (counts[m.method] || 0) + 1; });
  const keys = Object.keys(counts);
  state.charts['method'] = new Chart(ctx, {
    type: 'pie',
    data: { labels: keys.map(k => METHOD_LABELS[k] || k), datasets: [{ data: keys.map(k => counts[k]), backgroundColor: keys.map(k => (CHART_COLORS[k] || '#aaa') + 'CC'), borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } } } },
  });
}

// ----------------------------------------------------------------
// MENTION TABLE
// ----------------------------------------------------------------

function renderMentionTable(data) {
  if (!data) data = getFilteredMentions();
  const order = document.getElementById('sort-order')?.value || 'newest';
  const sorted = [...data].sort((a, b) => {
    if (order === 'newest')  return b.date.localeCompare(a.date);
    if (order === 'oldest')  return a.date.localeCompare(b.date);
    if (order === 'notable') return (b.notable ? 1 : 0) - (a.notable ? 1 : 0);
    if (order === 'score')   return calculateScore(b) - calculateScore(a);
    return 0;
  });

  const countEl = document.getElementById('mention-count');
  if (countEl) countEl.textContent = `${sorted.length} mention${sorted.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('mention-tbody');
  if (!tbody) return;
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No mentions match the current filters.</td></tr>';
    return;
  }
  tbody.innerHTML = sorted.map(m => `
    <tr>
      <td>${scoreBadge(m)}</td>
      <td style="white-space:nowrap">${fmtDate(m.date)}</td>
      <td class="headline-cell">
        ${m.url && m.url !== '#' ? `<a class="headline-link" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : `<span class="headline-link">${esc(m.title)}</span>`}
        ${m.snippet ? `<div class="headline-snippet">${esc(m.snippet)}</div>` : ''}
      </td>
      <td>${sourceCell(m)}</td>
      <td><span class="attr-tag">${PROMINENCE_OPTS[m.prominence]?.label || '—'}</span></td>
      <td><span class="attr-tag sentiment-${m.sentiment || 'neutral'}">${SENTIMENT_OPTS[m.sentiment]?.label || '—'}</span></td>
      <td><div class="theme-tags">${(m.themes || []).map(t => `<span class="theme-dot dot-${t.replace('-','')}">${THEMES[t]?.label || t}</span>`).join('')}</div></td>
      <td>${m.notable ? '<span class="notable-yes">&#9733; Yes</span>' : '<span class="notable-no">—</span>'}</td>
      <td>${methodTag(m.method)}</td>
    </tr>`).join('');
}

function sourceCell(m) {
  const tier = OUTLET_TIERS[m.tier ?? 2];
  return `<div>${esc(m.source)}</div><span class="tier-badge-sm" style="background:${tier?.bg};color:${tier?.color}">${tier?.label || '—'}</span>`;
}

function methodTag(method) {
  const cls = method === 'google-alerts' ? 'tag-google' : method === 'rss-feed' ? 'tag-rss' : method === 'web-search' ? 'tag-search' : 'tag-manual';
  return `<span class="method-tag-cell ${cls}">${METHOD_LABELS[method] || method}</span>`;
}

function themeDots(themes) {
  return (themes || []).map(t => `<span class="theme-dot dot-${t.replace('-','')}">${THEMES[t]?.label || t}</span>`).join('');
}

// ----------------------------------------------------------------
// SCORING TAB
// ----------------------------------------------------------------

function renderScoringTab() {
  renderWeightSliders();
  renderScoringTable();
}

function renderWeightSliders() {
  const fields = [
    { id: 'tier', pctId: 'w-tier-pct' },
    { id: 'prominence', pctId: 'w-prominence-pct' },
    { id: 'sentiment', pctId: 'w-sentiment-pct' },
    { id: 'pullThrough', pctId: 'w-pull-pct', inputId: 'w-pull' },
  ];
  const total = Object.values(state.weights).reduce((a, b) => a + b, 0);
  fields.forEach(({ id, pctId, inputId }) => {
    const slider = document.getElementById(inputId || `w-${id}`);
    const pctEl  = document.getElementById(pctId);
    if (slider) slider.value = state.weights[id];
    if (pctEl)  pctEl.textContent = `${Math.round((state.weights[id] / total) * 100)}%`;
  });
  const totalEl = document.getElementById('weight-total');
  if (totalEl) totalEl.textContent = `Total: ${total}`;
}

function updateWeights() {
  state.weights = {
    tier:        parseInt(document.getElementById('w-tier').value),
    prominence:  parseInt(document.getElementById('w-prominence').value),
    sentiment:   parseInt(document.getElementById('w-sentiment').value),
    pullThrough: parseInt(document.getElementById('w-pull').value),
  };
  saveLS('blandin_weights', state.weights);
  renderWeightSliders();
  renderScoringTable();
  updateDashboard(); // re-score dashboard too
}

function resetWeights() {
  state.weights = { ...DEFAULT_WEIGHTS };
  saveLS('blandin_weights', state.weights);
  renderScoringTab();
  updateDashboard();
  showToast('Weights reset to defaults.');
}

function renderScoringTable() {
  const tbody = document.getElementById('scoring-tbody');
  if (!tbody) return;
  const all = getAllMentions().map(m => ({ ...m, _score: calculateScore(m, state.weights) }));
  all.sort((a, b) => b._score - a._score);

  const sub = document.getElementById('scoring-subtitle');
  if (sub) {
    const high = all.filter(m => m._score >= 70).length;
    const mid  = all.filter(m => m._score >= 45 && m._score < 70).length;
    const low  = all.filter(m => m._score < 45).length;
    sub.textContent = `${high} high (70+) · ${mid} medium · ${low} low — drag sliders above to see scores shift`;
  }

  tbody.innerHTML = all.map(m => `
    <tr>
      <td><div class="score-badge ${scoreClass(m._score)}">${m._score}</div></td>
      <td style="white-space:nowrap">${fmtDate(m.date)}</td>
      <td class="headline-cell">
        ${m.url && m.url !== '#' ? `<a class="headline-link" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : `<span class="headline-link">${esc(m.title)}</span>`}
      </td>
      <td>${sourceCell(m)}</td>
      <td><span class="attr-tag">${PROMINENCE_OPTS[m.prominence]?.label || '—'}</span></td>
      <td><span class="attr-tag sentiment-${m.sentiment || 'neutral'}">${SENTIMENT_OPTS[m.sentiment]?.label || '—'}</span></td>
      <td><span class="attr-tag pull-${m.pullThrough || 'partial'}">${PULL_OPTS[m.pullThrough]?.label || '—'}</span></td>
      <td><div class="theme-tags">${themeDots(m.themes)}</div></td>
    </tr>`).join('');
}

// ----------------------------------------------------------------
// CSV EXPORT
// ----------------------------------------------------------------

function exportCSV() {
  const data = getFilteredMentions();
  const cols = ['Score','Date','Headline','Source','Tier','Source Type','Geography','Prominence','Sentiment','Pull-Through','Narrative Role','Themes','Notable','Method','Snippet'];
  const rows = data.map(m => [
    calculateScore(m), m.date, m.title, m.source,
    OUTLET_TIERS[m.tier ?? 2]?.label || '',
    m.sourceType, m.geography,
    PROMINENCE_OPTS[m.prominence]?.label || '',
    SENTIMENT_OPTS[m.sentiment]?.label || '',
    PULL_OPTS[m.pullThrough]?.label || '',
    NARRATIVE_OPTS[m.narrativeRole]?.label || '',
    m.themes.join('; '), m.notable ? 'Yes' : 'No', m.method, m.snippet || '',
  ]);
  downloadCSV('blandin-media-mentions.csv', [cols, ...rows]);
}

function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: filename });
  a.click();
}

function articleRow(m) {
  const score = calculateScore(m);
  return `
    <div class="feed-article">
      <div class="article-date">${fmtDate(m.date)}</div>
      <div class="article-score"><div class="score-badge score-badge-sm ${scoreClass(score)}">${score}</div></div>
      <div class="article-body">
        <div class="article-title">${m.url && m.url !== '#' ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : esc(m.title)}</div>
        <div class="article-source">${esc(m.source)} ${tierBadgeSm(m.tier)}</div>
        ${m.snippet ? `<div class="article-snippet">${esc(m.snippet)}</div>` : ''}
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${themeDots(m.themes)}${m.notable?'<span class="theme-dot" style="background:#FEF9C3;color:#713F12">&#9733; Notable</span>':''}</div>
      </div>
    </div>`;
}

function tierBadgeSm(tier) {
  const t = OUTLET_TIERS[tier ?? 2];
  return t ? `<span class="tier-badge-sm" style="background:${t.bg};color:${t.color}">${t.label}</span>` : '';
}

// ----------------------------------------------------------------
// MANUAL LOG TAB
// ----------------------------------------------------------------

function renderManualTab() {
  renderManualTable();
  const box = document.getElementById('manual-stats-box');
  if (box) box.innerHTML = `<div class="stat-line"><strong>${state.manualEntries.length}</strong> entries logged</div><div class="stat-line">${state.manualEntries.filter(e=>e.notable).length} notable</div>`;
}

function submitManualEntry(e) {
  e.preventDefault();
  const themes = Array.from(document.querySelectorAll('input[name="e-theme"]:checked')).map(i => i.value);
  const entry = {
    id:           'manual-' + Date.now(),
    title:        document.getElementById('e-title').value.trim(),
    source:       document.getElementById('e-source').value.trim(),
    url:          document.getElementById('e-url').value.trim(),
    date:         document.getElementById('e-date').value,
    sourceType:   document.getElementById('e-source-type').value,
    tier:         parseInt(document.getElementById('e-tier').value),
    geography:    document.getElementById('e-geo').value,
    prominence:   document.getElementById('e-prominence').value,
    sentiment:    document.getElementById('e-sentiment').value,
    pullThrough:  document.getElementById('e-pull').value,
    narrativeRole:document.getElementById('e-narrative').value,
    themes,
    notable:      document.getElementById('e-notable').checked,
    snippet:      document.getElementById('e-snippet').value.trim(),
    method:       'manual',
  };
  state.manualEntries.unshift(entry);
  saveLS('blandin_manual', state.manualEntries);
  clearManualForm();
  refreshAllViews();
  showToast(`Mention logged — Strategic Score: ${calculateScore(entry)}`);
}

function clearManualForm() {
  document.getElementById('manual-form').reset();
  document.getElementById('e-date').value = '2026-06-29';
  document.getElementById('e-geo').value  = 'state';
  document.getElementById('e-tier').value = '2';
}

function renderManualTable() {
  const tbody  = document.getElementById('manual-tbody');
  const countEl = document.getElementById('manual-count');
  if (countEl) countEl.textContent = `${state.manualEntries.length} entr${state.manualEntries.length !== 1 ? 'ies' : 'y'}`;
  if (!tbody) return;
  if (!state.manualEntries.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No manual entries yet.</td></tr>';
    return;
  }
  tbody.innerHTML = state.manualEntries.map(m => `
    <tr>
      <td>${scoreBadge(m)}</td>
      <td style="white-space:nowrap">${fmtDate(m.date)}</td>
      <td class="headline-cell">
        ${m.url ? `<a class="headline-link" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a>` : `<span class="headline-link">${esc(m.title)}</span>`}
        ${m.snippet ? `<div class="headline-snippet">${esc(m.snippet)}</div>` : ''}
      </td>
      <td>${sourceCell(m)}</td>
      <td><span class="attr-tag">${PROMINENCE_OPTS[m.prominence]?.label || '—'}</span></td>
      <td><span class="attr-tag sentiment-${m.sentiment || 'neutral'}">${SENTIMENT_OPTS[m.sentiment]?.label || '—'}</span></td>
      <td><div class="theme-tags">${themeDots(m.themes)}</div></td>
      <td>${m.notable ? '<span class="notable-yes">&#9733; Yes</span>' : '<span class="notable-no">—</span>'}</td>
      <td><button class="btn-delete" onclick="deleteManualEntry('${m.id}')">&#10005;</button></td>
    </tr>`).join('');
}

function deleteManualEntry(id) {
  state.manualEntries = state.manualEntries.filter(e => e.id !== id);
  saveLS('blandin_manual', state.manualEntries);
  refreshAllViews();
  showToast('Entry deleted.');
}

function clearAllManual() {
  if (!state.manualEntries.length) return;
  if (!confirm(`Delete all ${state.manualEntries.length} manual entries?`)) return;
  state.manualEntries = [];
  saveLS('blandin_manual', []);
  refreshAllViews();
  showToast('All manual entries cleared.');
}

function exportManualCSV() {
  if (!state.manualEntries.length) return showToast('No manual entries to export.');
  const cols = ['Score','Date','Headline','Source','Tier','Source Type','Geography','Prominence','Sentiment','Pull-Through','Narrative Role','Themes','Notable','Snippet'];
  const rows = state.manualEntries.map(m => [
    calculateScore(m), m.date, m.title, m.source,
    OUTLET_TIERS[m.tier ?? 2]?.label || '',
    m.sourceType, m.geography,
    PROMINENCE_OPTS[m.prominence]?.label || '',
    SENTIMENT_OPTS[m.sentiment]?.label || '',
    PULL_OPTS[m.pullThrough]?.label || '',
    NARRATIVE_OPTS[m.narrativeRole]?.label || '',
    m.themes.join('; '), m.notable ? 'Yes' : 'No', m.snippet || '',
  ]);
  downloadCSV('blandin-manual-log.csv', [cols, ...rows]);
}

// ----------------------------------------------------------------
// PRESS RELEASE TRACKER
// ----------------------------------------------------------------

function renderPressReleasesTab() {
  renderPRList();
}

function renderPRList() {
  const c = document.getElementById('pr-list');
  if (!c) return;
  if (!state.pressReleases.length) {
    c.innerHTML = `<div style="padding:32px 24px;text-align:center;color:var(--muted)">No press releases yet — add one above to start tracking coverage.</div>`;
    return;
  }
  c.innerHTML = state.pressReleases.map(pr => buildPRCard(pr)).join('');
}

function buildPRCard(pr) {
  const arts = pr.articles || [];
  const scores = arts.map(a => calculateScore(a));
  const avgScore = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
  const notable = arts.filter(a => a.notable).length;
  const tierCounts = { 1: 0, 2: 0, 3: 0, 0: 0 };
  arts.forEach(a => { tierCounts[a.tier ?? 2]++; });

  const msgStats = (pr.keyMessages || []).map(msg => ({
    msg,
    count: arts.filter(a => (a.messagesHit || []).includes(msg)).length,
    pct:   arts.length ? Math.round(arts.filter(a => (a.messagesHit || []).includes(msg)).length / arts.length * 100) : 0,
  }));

  const themeHtml = (pr.themes || []).map(t =>
    `<span class="theme-dot dot-${t.replace(/-/g,'')}" title="${esc(THEMES[t]?.label||t)}"></span><span style="font-size:12px;color:var(--subtext)">${esc(THEMES[t]?.label||t)}</span>`
  ).join('');

  const tierBadges = [1,2,3,0].filter(k => tierCounts[k]).map(k =>
    `<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;background:${OUTLET_TIERS[k].bg};color:${OUTLET_TIERS[k].color}">${OUTLET_TIERS[k].short}: ${tierCounts[k]}</span>`
  ).join('');

  const metricsHtml = arts.length ? `
    <div class="pr-metrics-row">
      <div class="pr-metric"><span class="pr-metric-val">${arts.length}</span><span class="pr-metric-label">Articles</span></div>
      ${avgScore !== null ? `<div class="pr-metric"><span class="pr-metric-val" style="color:${avgScore>=70?'var(--success)':avgScore>=45?'var(--gold)':'var(--muted)'}">${avgScore}</span><span class="pr-metric-label">Avg Score</span></div>` : ''}
      <div class="pr-metric"><span class="pr-metric-val">${notable}</span><span class="pr-metric-label">Notable</span></div>
      ${tierBadges ? `<div class="pr-metric-tiers">${tierBadges}</div>` : ''}
    </div>` : '';

  const msgReachHtml = msgStats.length && arts.length ? `
    <div class="pr-msg-section">
      <div class="pr-section-label">Key Message Reach</div>
      ${msgStats.map(ms => `
        <div class="pr-msg-row">
          <div class="pr-msg-label">${esc(ms.msg)}</div>
          <div class="pr-msg-bar-wrap"><div class="pr-msg-bar" style="width:${ms.pct}%"></div></div>
          <div class="pr-msg-pct">${ms.pct}%<span class="pr-msg-count"> (${ms.count})</span></div>
        </div>`).join('')}
    </div>` : (pr.keyMessages?.length && !arts.length ? `
    <div style="padding:8px 24px 16px;display:flex;flex-wrap:wrap;gap:6px">
      ${pr.keyMessages.map(m => `<span class="kw-chip">${esc(m)}</span>`).join('')}
    </div>` : '');

  const articlesHtml = arts.length ? `
    <div class="pr-articles-table" id="pr-articles-${pr.id}" style="display:none">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Score</th><th>Date</th><th>Headline</th><th>Source &amp; Tier</th><th>Prominence</th><th>Sentiment</th><th>Messages Picked Up</th><th>Notable</th><th></th></tr></thead>
          <tbody>
            ${arts.map(a => {
              const sc = calculateScore(a);
              const tier = OUTLET_TIERS[a.tier ?? 2];
              const msgs = (a.messagesHit || []).map(m => `<span class="kw-chip" style="font-size:10px;padding:1px 5px">${esc(m)}</span>`).join(' ');
              return `<tr>
                <td>${scoreBadge(a)}</td>
                <td style="white-space:nowrap">${fmtDate(a.date)}</td>
                <td class="headline-cell">
                  ${a.url ? `<a class="headline-link" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>` : `<span class="headline-link">${esc(a.title)}</span>`}
                  ${a.notes ? `<div class="headline-snippet">${esc(a.notes)}</div>` : ''}
                </td>
                <td>${sourceCell(a)}</td>
                <td><span class="attr-tag">${PROMINENCE_OPTS[a.prominence]?.label||'—'}</span></td>
                <td><span class="attr-tag sentiment-${a.sentiment||'neutral'}">${SENTIMENT_OPTS[a.sentiment]?.label||'—'}</span></td>
                <td>${msgs||'<span style="color:var(--muted)">—</span>'}</td>
                <td>${a.notable ? '<span class="notable-yes">&#9733; Yes</span>' : '<span class="notable-no">—</span>'}</td>
                <td><button class="btn-delete" onclick="removePRArticle('${pr.id}','${a.id}')">&#10005;</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>` : '';

  const articleFormHtml = buildPRArticleForm(pr);

  return `
    <div class="pr-card" id="pr-card-${pr.id}">
      <div class="pr-card-header">
        <div class="pr-card-meta">
          <span class="pr-date-chip">${pr.date}</span>
          ${themeHtml ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">${themeHtml}</div>` : ''}
        </div>
        <div class="pr-card-actions">
          <button class="btn-sm btn-primary" onclick="togglePRArticleForm('${pr.id}')">+ Log Article</button>
          ${arts.length ? `<button class="btn-sm btn-ghost" onclick="togglePRArticles('${pr.id}')">Articles ▾ (${arts.length})</button>` : ''}
          <button class="btn-delete" onclick="removePressRelease('${pr.id}')">&#10005;</button>
        </div>
      </div>
      <div class="pr-card-body">
        <h4 class="pr-title">${esc(pr.title)}</h4>
        ${pr.summary ? `<p class="pr-summary">${esc(pr.summary)}</p>` : ''}
      </div>
      ${metricsHtml}
      ${msgReachHtml}
      ${articlesHtml}
      <div id="pr-form-${pr.id}" style="display:none;border-top:1px solid var(--border);padding:20px 24px">
        ${articleFormHtml}
      </div>
    </div>`;
}

function buildPRArticleForm(pr) {
  const msgCheckboxes = (pr.keyMessages || []).length ? `
    <div class="form-group col-2">
      <label>Key Messages Picked Up in This Article</label>
      <div class="checkbox-grid">
        ${(pr.keyMessages || []).map(m => `<label class="check-opt"><input type="checkbox" name="pra-msg-${pr.id}" value="${esc(m)}"> ${esc(m)}</label>`).join('')}
      </div>
    </div>` : '';

  return `
    <p style="font-size:13px;font-weight:600;color:var(--navy);margin-bottom:16px">Log Article Coverage → <em style="font-weight:400;color:var(--subtext)">${esc(pr.title)}</em></p>
    <div class="form-grid">
      <div class="form-group col-2">
        <label>Headline / Title <span class="required">*</span></label>
        <input type="text" id="pra-title-${pr.id}" class="form-input" placeholder="Article headline">
      </div>
      <div class="form-group">
        <label>Source Name <span class="required">*</span></label>
        <input type="text" id="pra-source-${pr.id}" class="form-input" placeholder="e.g. MPR News">
      </div>
      <div class="form-group">
        <label>Publication Date</label>
        <input type="date" id="pra-date-${pr.id}" class="form-input" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="form-group">
        <label>URL</label>
        <input type="url" id="pra-url-${pr.id}" class="form-input" placeholder="https://…">
      </div>
      <div class="form-group">
        <label>Outlet Tier <span class="score-field-hint">&#9733; affects score</span></label>
        <select id="pra-tier-${pr.id}" class="form-input">
          <option value="1">Tier 1 — Home Area</option>
          <option value="2" selected>Tier 2 — Statewide Rural</option>
          <option value="3">Tier 3 — National</option>
          <option value="0">Major Metro</option>
        </select>
      </div>
      <div class="form-group">
        <label>Prominence <span class="score-field-hint">&#9733; affects score</span></label>
        <select id="pra-prominence-${pr.id}" class="form-input">
          <option value="headline">Headline / Lead Story</option>
          <option value="body" selected>Body Coverage</option>
          <option value="passing">Passing Reference</option>
        </select>
      </div>
      <div class="form-group">
        <label>Sentiment <span class="score-field-hint">&#9733; affects score</span></label>
        <select id="pra-sentiment-${pr.id}" class="form-input">
          <option value="very-positive">Very Positive</option>
          <option value="positive" selected>Positive</option>
          <option value="neutral">Neutral</option>
          <option value="critical">Mixed</option>
        </select>
      </div>
      <div class="form-group">
        <label>Message Pull-Through <span class="score-field-hint">&#9733; affects score</span></label>
        <select id="pra-pull-${pr.id}" class="form-input">
          <option value="yes">Yes — Uses Blandin's framing</option>
          <option value="partial" selected>Partial</option>
          <option value="no">No — Name only</option>
        </select>
      </div>
      ${msgCheckboxes}
      <div class="form-group">
        <label>Notable?</label>
        <label class="check-opt"><input type="checkbox" id="pra-notable-${pr.id}"> Mark as notable</label>
      </div>
      <div class="form-group col-2">
        <label>Notes / Key Quote</label>
        <textarea id="pra-notes-${pr.id}" class="form-input" rows="2" placeholder="Brief excerpt or relevant context…"></textarea>
      </div>
    </div>
    <div class="form-submit-row">
      <button class="btn-primary" onclick="savePRArticle('${pr.id}')">Log Article</button>
      <button class="btn-ghost" onclick="togglePRArticleForm('${pr.id}')">Cancel</button>
    </div>`;
}

function savePressRelease() {
  const title = document.getElementById('pr-title')?.value.trim();
  const date  = document.getElementById('pr-date')?.value;
  if (!title) return showToast('Title is required.');
  if (!date)  return showToast('Date is required.');

  const themes = [...document.querySelectorAll('input[name="pr-theme"]:checked')].map(i => i.value);
  const rawMsgs = document.getElementById('pr-messages')?.value || '';
  const keyMessages = rawMsgs.split('\n').map(s => s.trim()).filter(Boolean);
  const summary = document.getElementById('pr-summary')?.value.trim() || '';

  state.pressReleases.unshift({ id: 'pr_' + Date.now(), title, date, summary, themes, keyMessages, articles: [] });
  saveLS('blandin_press_releases', state.pressReleases);

  // Reset form
  ['pr-title','pr-summary','pr-messages'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.querySelectorAll('input[name="pr-theme"]').forEach(i => { i.checked = false; });
  togglePanel('add-pr-panel');
  renderPRList();
  showToast('Press release saved.');
}

function removePressRelease(id) {
  const pr = state.pressReleases.find(p => p.id === id);
  if (!pr) return;
  if (!confirm(`Remove "${pr.title}" and all its logged articles?`)) return;
  state.pressReleases = state.pressReleases.filter(p => p.id !== id);
  saveLS('blandin_press_releases', state.pressReleases);
  renderPRList();
  showToast('Press release removed.');
}

function togglePRArticleForm(prId) {
  const el = document.getElementById(`pr-form-${prId}`);
  if (!el) return;
  const opening = el.style.display === 'none';
  el.style.display = opening ? 'block' : 'none';
  if (opening) el.querySelector('input')?.focus();
}

function togglePRArticles(prId) {
  const el = document.getElementById(`pr-articles-${prId}`);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function savePRArticle(prId) {
  const pr = state.pressReleases.find(p => p.id === prId);
  if (!pr) return;

  const title  = document.getElementById(`pra-title-${prId}`)?.value.trim();
  const source = document.getElementById(`pra-source-${prId}`)?.value.trim();
  if (!title)  return showToast('Headline is required.');
  if (!source) return showToast('Source name is required.');

  const messagesHit = [...document.querySelectorAll(`input[name="pra-msg-${prId}"]:checked`)].map(i => i.value);

  const article = {
    id:           'pra_' + Date.now(),
    title,
    source,
    url:          document.getElementById(`pra-url-${prId}`)?.value.trim() || '',
    date:         document.getElementById(`pra-date-${prId}`)?.value || new Date().toISOString().slice(0,10),
    tier:         parseInt(document.getElementById(`pra-tier-${prId}`)?.value ?? '2'),
    prominence:   document.getElementById(`pra-prominence-${prId}`)?.value || 'body',
    sentiment:    document.getElementById(`pra-sentiment-${prId}`)?.value || 'neutral',
    pullThrough:  document.getElementById(`pra-pull-${prId}`)?.value || 'partial',
    messagesHit,
    notable:      document.getElementById(`pra-notable-${prId}`)?.checked || false,
    notes:        document.getElementById(`pra-notes-${prId}`)?.value.trim() || '',
  };

  pr.articles.unshift(article);
  saveLS('blandin_press_releases', state.pressReleases);
  renderPRList();
  showToast(`Article logged under "${pr.title}".`);
  // Re-open articles view so user sees what they just added
  setTimeout(() => {
    const arts = document.getElementById(`pr-articles-${prId}`);
    if (arts) arts.style.display = 'block';
  }, 50);
}

function removePRArticle(prId, articleId) {
  const pr = state.pressReleases.find(p => p.id === prId);
  if (!pr) return;
  pr.articles = pr.articles.filter(a => a.id !== articleId);
  saveLS('blandin_press_releases', state.pressReleases);
  renderPRList();
  showToast('Article removed.');
}

// ----------------------------------------------------------------
// LOCALSTORAGE / TOAST / UTIL
// ----------------------------------------------------------------

function loadLS(k, fb)  { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function saveLS(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function set(id, val)   { const el = document.getElementById(id); if (el) el.textContent = val; }
function esc(s)         { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let toastTimer;
function showToast(msg, ms = 3500) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
