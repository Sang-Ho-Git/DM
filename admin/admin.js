(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICONS = [['ruler', '자 (측량)'], ['file', '문서 (허가)'], ['sprout', '새싹 (농지·산지)'], ['factory', '공장'], ['sun', '해 (태양광)'], ['route', '길 (도로)'], ['point', '측점']];

  // 숫자 뒤의 m2, m^2, 제곱미터, 평방미터 → ㎡ (숫자 뒤에서만 바꿔서 다른 글자는 건드리지 않음)
  const fixUnits = (s) => String(s ?? '').replace(/(\d)\s*(m\s*\^?\s*2(?![\d])|m²|제곱\s*미터|평방\s*미터|평방\s*m|㎡)/gi, '$1㎡');
  function applyUnits(el) {
    if (!el || !('value' in el) || el.tagName === 'SELECT') return;
    const v = fixUnits(el.value);
    if (v !== el.value) {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  // 입력칸에서 빠져나올 때 바꿈 (입력하는 도중에는 커서가 튀지 않게 그대로 둠)
  document.addEventListener('change', (e) => applyUnits(e.target));

  let site = null;
  let projects = [];
  let savedSnapshot = '';

  // ── 상태 표시 ─────────────────────────────
  const snapshot = () => JSON.stringify({ site, projects });
  function markDirty() {
    const dirty = snapshot() !== savedSnapshot;
    $('#save').disabled = !dirty;
    const st = $('#status');
    st.textContent = dirty ? '저장 안 된 변경 있음' : '저장됨';
    st.classList.toggle('dirty', dirty);
  }
  let toastTimer = 0;
  function toast(msg, isError) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('error', !!isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 6000 : 2500);
  }
  window.addEventListener('beforeunload', (e) => {
    if (site && snapshot() !== savedSnapshot) { e.preventDefault(); e.returnValue = ''; }
  });

  // ── 탭 ──────────────────────────────────
  function showTab(name) {
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
    $$('.panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    try { localStorage.setItem('admin-tab', name); } catch (e) { /* 저장 안 돼도 괜찮음 */ }
  }
  $('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) showTab(b.dataset.tab);
  });

  // ── 단순 입력칸 (data-bind="hero.title" 등) ─────
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : ''), obj);
  const setPath = (obj, path, v) => {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], obj)[last] = v;
  };
  function fillBound() {
    $$('[data-bind]').forEach((el) => { el.value = getPath(site, el.dataset.bind) ?? ''; });
  }
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.bind) { setPath(site, el.dataset.bind, el.value); markDirty(); }
    if (el.dataset.list) {
      const arr = listArray(el.dataset.list);
      const i = Number(el.dataset.i);
      if (el.dataset.k) arr[i][el.dataset.k] = el.value; else arr[i] = el.value;
      markDirty();
    }
  });

  // ── 업무·절차·준비물 목록 ────────────────────
  const listArray = (name) => ({ services: site.services.items, steps: site.process.steps, tips: site.contact.tips }[name]);
  const blank = { services: () => ({ icon: 'point', title: '', text: '' }), steps: () => ({ title: '', text: '' }), tips: () => '' };

  function tools(name, i, len) {
    return `<div class="item-tools">
      <button type="button" class="icon-btn" data-move="${name}" data-i="${i}" data-d="-1" aria-label="위로" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button type="button" class="icon-btn" data-move="${name}" data-i="${i}" data-d="1" aria-label="아래로" ${i === len - 1 ? 'disabled' : ''}>↓</button>
      <button type="button" class="icon-btn danger" data-del="${name}" data-i="${i}" aria-label="삭제">×</button>
    </div>`;
  }
  function renderLists() {
    const sv = site.services.items;
    $('#services').innerHTML = sv.map((s, i) => `<div class="item">
      <span class="item-no">${String(i + 1).padStart(2, '0')}</span>
      <div class="item-fields">
        <div class="row">
          <select data-list="services" data-i="${i}" data-k="icon" aria-label="아이콘">${ICONS.map(([v, l]) => `<option value="${v}" ${s.icon === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <input data-list="services" data-i="${i}" data-k="title" value="${esc(s.title)}" placeholder="업무 이름" aria-label="업무 이름">
        </div>
        <textarea rows="2" data-list="services" data-i="${i}" data-k="text" placeholder="설명" aria-label="설명">${esc(s.text)}</textarea>
      </div>${tools('services', i, sv.length)}</div>`).join('');

    const st = site.process.steps;
    $('#steps').innerHTML = st.map((s, i) => `<div class="item">
      <span class="item-no">${String(i + 1).padStart(2, '0')}</span>
      <div class="item-fields">
        <input data-list="steps" data-i="${i}" data-k="title" value="${esc(s.title)}" placeholder="단계 이름" aria-label="단계 이름">
        <textarea rows="2" data-list="steps" data-i="${i}" data-k="text" placeholder="설명" aria-label="설명">${esc(s.text)}</textarea>
      </div>${tools('steps', i, st.length)}</div>`).join('');

    const tp = site.contact.tips;
    $('#tips').innerHTML = tp.map((t, i) => `<div class="item">
      <span class="item-no">${String(i + 1).padStart(2, '0')}</span>
      <div class="item-fields"><input data-list="tips" data-i="${i}" value="${esc(t)}" placeholder="준비물" aria-label="준비물"></div>
      ${tools('tips', i, tp.length)}</div>`).join('');
  }
  document.addEventListener('click', (e) => {
    const mv = e.target.closest('[data-move]');
    const del = e.target.closest('[data-del]');
    const add = e.target.closest('[data-add]');
    if (mv) {
      const arr = listArray(mv.dataset.move);
      const i = Number(mv.dataset.i);
      const j = i + Number(mv.dataset.d);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    } else if (del) {
      listArray(del.dataset.del).splice(Number(del.dataset.i), 1);
    } else if (add) {
      listArray(add.dataset.add).push(blank[add.dataset.add]());
    } else return;
    renderLists();
    markDirty();
    if (add) { const last = $(`#${add.dataset.add} .item:last-child input, #${add.dataset.add} .item:last-child select`); if (last) last.focus(); }
  });

  // ── 실적 ────────────────────────────────
  const order = () => projects
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => b.p.year.localeCompare(a.p.year) || b.idx - a.idx);

  function renderFilters() {
    const cats = [...new Set(projects.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'ko'));
    const years = [...new Set(projects.map((p) => p.year))].sort().reverse();
    const keep = (sel, opts, first) => {
      const v = sel.value;
      sel.innerHTML = `<option value="">${first}</option>` + opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('');
    };
    keep($('#p-cat'), cats, '모든 분류');
    keep($('#p-year'), years, '모든 연도');
    $('#cat-list').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
  }
  function renderProjects() {
    const q = $('#p-search').value.replace(/\s+/g, '');
    const cat = $('#p-cat').value;
    const year = $('#p-year').value;
    const rows = order().filter(({ p }) => (!cat || p.category === cat) && (!year || p.year === year)
      && (!q || (p.name + p.zone + p.work + p.category).replace(/\s+/g, '').includes(q)));
    const sum = (arr) => arr.reduce((s, x) => s + (Number(x.count) || 1), 0);
    $('#p-count').textContent = `${rows.length}개 항목 (${sum(rows.map((r) => r.p))}건) / 전체 ${projects.length}개 항목 (${sum(projects)}건)`;
    $('#p-rows').innerHTML = rows.length ? rows.map(({ p, idx }) => `<tr data-idx="${idx}" tabindex="0">
      <td class="c-year">${esc(p.year)}</td>
      <td class="cat">${esc(p.category)}</td>
      <td>${esc(p.name)}${Number(p.count) > 1 ? ` <span class="badge">${Number(p.count)}건</span>` : ''}</td>
      <td class="meta">${esc([p.capacity, p.scale, p.zone].filter(Boolean).join(' · ')) || '—'}</td>
      <td class="c-act"><button type="button" class="btn btn-quiet btn-sm">수정</button></td>
    </tr>`).join('') : '<tr class="empty-row"><td colspan="5">조건에 맞는 실적이 없습니다</td></tr>';
  }
  ['#p-search', '#p-cat', '#p-year'].forEach((s) => $(s).addEventListener('input', renderProjects));
  $('#p-rows').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-idx]');
    if (tr) openProject(Number(tr.dataset.idx));
  });
  $('#p-rows').addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-idx]');
    if (tr && e.key === 'Enter') openProject(Number(tr.dataset.idx));
  });

  // 실적 편집 창
  const dlg = $('#p-dialog');
  const form = $('#p-form');
  let editing = -1; // -1 = 새 실적
  let confirmDelete = false;
  function openProject(idx) {
    editing = idx;
    const p = idx >= 0 ? projects[idx] : { year: String(new Date().getFullYear()), category: '', name: '', count: 1, scale: '', capacity: '', zone: '', work: '측량설계' };
    $('#p-dialog-title').textContent = idx >= 0 ? '실적 수정' : '실적 추가';
    ['year', 'category', 'name', 'scale', 'capacity', 'zone', 'work'].forEach((k) => { form.elements[k].value = p[k] || ''; });
    form.elements.count.value = Number(p.count) || 1;
    $('#p-delete').hidden = idx < 0;
    resetDelete();
    $('#p-error').hidden = true;
    dlg.showModal();
    form.elements[idx >= 0 ? 'name' : 'category'].focus();
  }
  function resetDelete() { confirmDelete = false; $('#p-delete').textContent = '삭제'; }
  $('#add-project').addEventListener('click', () => openProject(-1));
  $('#p-cancel').addEventListener('click', () => dlg.close());
  $('#p-delete').addEventListener('click', () => {
    if (!confirmDelete) { confirmDelete = true; $('#p-delete').textContent = '한 번 더 누르면 삭제'; return; }
    const name = projects[editing].name;
    projects.splice(editing, 1);
    dlg.close();
    renderFilters(); renderProjects(); markDirty();
    toast(`"${name}" 삭제함 · 저장을 눌러야 사이트에 반영됩니다`);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = Object.fromEntries(['year', 'category', 'name', 'scale', 'capacity', 'zone', 'work'].map((k) => [k, fixUnits(form.elements[k].value.trim())]));
    v.count = Number(form.elements.count.value);
    const err = !/^\d{4}$/.test(v.year) ? '연도는 숫자 4자리로 적어 주세요 (예: 2026)'
      : !v.category ? '분류를 적어 주세요' : !v.name ? '사업명을 적어 주세요'
      : !(Number.isInteger(v.count) && v.count >= 1 && v.count <= 999) ? '건수는 1~999 사이 숫자로 적어 주세요' : '';
    if (err) { $('#p-error').textContent = err; $('#p-error').hidden = false; return; }
    if (editing >= 0) Object.assign(projects[editing], v);
    else projects.push({ id: 0, ...v });
    dlg.close();
    renderFilters(); renderProjects(); markDirty();
  });
  dlg.addEventListener('close', resetDelete);

  // ── 불러오기·저장 ─────────────────────────
  function renderAll(data) {
    site = data.site;
    projects = data.projects;
    savedSnapshot = snapshot();
    fillBound(); renderLists(); renderFilters(); renderProjects(); markDirty();
    if (data.backups) {
      $('#backup-info').textContent = data.backups.length
        ? `저장할 때마다 이전 내용이 data/backup 폴더에 남습니다 (최근: ${data.backups[0].replace(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2}).*/, '$1-$2-$3 $4:$5')})`
        : '저장할 때마다 이전 내용이 data/backup 폴더에 남습니다';
    }
  }
  async function load() {
    try {
      const r = await fetch('/api/content', { cache: 'no-store' });
      if (!r.ok) throw new Error((await r.json()).error || r.statusText);
      renderAll(await r.json());
    } catch (e) {
      $('#load-error').textContent = '내용을 불러오지 못했습니다. 관리자_실행.bat(또는 python server.py)으로 연 주소인지 확인해 주세요. (' + e.message + ')';
      $('#load-error').hidden = false;
    }
  }
  async function save() {
    if ($('#save').disabled) return;
    $('#save').disabled = true;
    $('#status').textContent = '저장 중…';
    try {
      const r = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site, projects }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.statusText);
      const tab = $('.tabs [aria-selected="true"]').dataset.tab;
      renderAll(data);
      showTab(tab);
      toast('저장했습니다 · 사이트에 반영됨');
    } catch (e) {
      markDirty();
      toast('저장하지 못했습니다: ' + e.message, true);
    }
  }
  $('#save').addEventListener('click', save);

  // 엑셀 내려받기: 저장된 내용 기준이라, 저장 안 한 변경이 있으면 먼저 알려 줌
  $('#export-xlsx').addEventListener('click', () => {
    if (!$('#save').disabled) return toast('저장하지 않은 변경이 있습니다. 먼저 저장한 뒤 내려받으세요', true);
    window.location.href = '/api/export.xlsx';
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });

  let first = 'projects';
  try { first = localStorage.getItem('admin-tab') || first; } catch (e) { /* 무시 */ }
  showTab($(`.tabs [data-tab="${first}"]`) ? first : 'projects');
  load();
})();
