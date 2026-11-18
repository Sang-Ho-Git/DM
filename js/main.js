(function () {
  const data = window.PROJECTS || [];
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 복사·오른쪽 클릭·이미지 끌기 막기 (연락처와 입력칸은 허용)
  const COPYABLE = 'input, textarea, .contact-list, .site-footer';
  const allowedAt = (node) => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest(COPYABLE));
  };
  const selectionAllowed = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return allowedAt(document.activeElement);
    return allowedAt(sel.anchorNode) && allowedAt(sel.focusNode);
  };
  ['copy', 'cut'].forEach((type) => document.addEventListener(type, (e) => { if (!selectionAllowed()) e.preventDefault(); }));
  ['contextmenu', 'dragstart', 'selectstart'].forEach((type) => document.addEventListener(type, (e) => { if (!allowedAt(e.target)) e.preventDefault(); }));

  // 모바일 메뉴
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  });
  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // 같은 연도·같은 분류의 실적은 하나로 묶어, 대표 실적 1개만 보여 주고 "외 다수"로 표시
  const cnt = (p) => Number(p.count) || 1;
  // "12,000㎡ 이하" → 12000, "2MW" → 2000 (kW 기준)
  const area = (s) => Number((String(s || '').match(/[\d,.]+/) || ['0'])[0].replace(/,/g, '')) || 0;
  const power = (s) => {
    const m = String(s || '').match(/([\d.]+)\s*(mw|kw)/i);
    return m ? Number(m[1]) * (m[2].toLowerCase() === 'mw' ? 1000 : 1) : 0;
  };
  const groups = [];
  const byKey = new Map();
  data.forEach((p, i) => {
    const key = p.year + '|' + p.category;
    if (!byKey.has(key)) { byKey.set(key, { year: p.year, category: p.category, items: [], last: i }); groups.push(byKey.get(key)); }
    const g = byKey.get(key);
    g.items.push(p);
    g.last = i;
  });
  groups.forEach((g) => {
    // 대표: 한 건짜리 중 나중에 추가한 것(정보가 더 자세함), 없으면 마지막 항목
    const singles = g.items.filter((p) => cnt(p) === 1);
    g.rep = (singles.length ? singles : g.items)[(singles.length ? singles : g.items).length - 1];
    g.more = g.items.reduce((s, p) => s + cnt(p), 0) > 1;
    // 면적·용도지역: 면적이 가장 큰 현장 것 / 용량: 가장 큰 값
    const withArea = g.items.filter((p) => area(p.scale) > 0);
    const big = withArea.length ? withArea.reduce((a, b) => (area(b.scale) > area(a.scale) ? b : a)) : g.rep;
    const caps = g.items.filter((p) => power(p.capacity) > 0);
    g.scale = big.scale || '';
    g.zone = big.zone || (g.items.find((p) => p.zone) || {}).zone || '';
    g.capacity = caps.length ? caps.reduce((a, b) => (power(b.capacity) > power(a.capacity) ? b : a)).capacity : (g.rep.capacity || '');
    // 허가 내용: 모든 현장 것을 합치고 중복은 한 번만
    g.works = [...new Set(g.items.flatMap((p) => String(p.work || '').split(',').map((w) => w.trim()).filter(Boolean)))];
  });

  const years = [...new Set(data.map((p) => p.year))].sort();
  if (years.length) $('#projects-lead').textContent = `${years[0]}~${years[years.length - 1]}년에 진행한 주요 실적을 연도별로 볼 수 있습니다`;

  // 필터: 연도만
  const state = { year: '전체' };
  const chip = (group, value) =>
    `<button type="button" class="chip" data-group="${group}" data-value="${esc(value)}" aria-pressed="${state[group] === value}">${esc(value)}</button>`;
  function renderChips() {
    $('#year-chips').innerHTML = ['전체', ...years.slice().reverse()].map((y) => chip('year', y)).join('');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state[b.dataset.group] = b.dataset.value;
    renderChips();
    renderList();
  });

  function card(g) {
    // 카드 높이를 모두 같게: 제목 2줄, 규모·용도지역 1줄, 업무 1줄 (넘치면 … 처리, 전체 내용은 title로)
    const p = g.rep;
    const base = p.name.replace(/\s*외\s*\d+\s*건\s*$/, '');
    const name = g.more ? `${base} 외 다수` : base;
    const meta = [g.capacity, g.scale, g.zone].filter(Boolean).join(' · ');
    const works = g.works.join(' · ');
    return `<article class="project">
      <div class="project-top"><span class="tag">${esc(g.category)}</span><span class="year">${esc(g.year)}년</span></div>
      <h3 title="${esc(name)}">${esc(name)}</h3>
      <p class="meta" title="${esc(meta)}">${esc(meta)}</p>
      <p class="works" title="${esc(works)}">${esc(works)}</p>
    </article>`;
  }
  // 실적 슬라이드: 화면 폭에 따라 한 페이지 개수를 정하고, 좌우로 넘김
  const track = $('#project-grid');
  const pager = $('#pager');
  const mqDesktop = window.matchMedia('(min-width: 961px)');
  const mqTablet = window.matchMedia('(min-width: 721px)');
  const perPage = () => (mqDesktop.matches ? 9 : mqTablet.matches ? 6 : 4);
  let list = [];
  let size = perPage();
  let pages = 1;
  let current = 0;

  function filtered() {
    return groups
      .filter((g) => state.year === '전체' || g.year === state.year)
      // 연도 최신순, 같은 연도 안에서는 나중에 추가한 실적이 있는 묶음이 먼저
      .sort((a, b) => b.year.localeCompare(a.year) || b.last - a.last);
  }

  function renderList(keepIndex) {
    list = filtered();
    size = perPage();
    pages = Math.max(1, Math.ceil(list.length / size));
    const html = [];
    for (let i = 0; i < pages; i++) {
      const items = list.slice(i * size, i * size + size);
      html.push(`<div class="project-page" role="group" aria-label="${i + 1} / ${pages} 페이지">${items.map(card).join('')}</div>`);
    }
    track.innerHTML = list.length ? html.join('') : '';
    $('#empty').hidden = list.length > 0;
    reserveHeight();
    goTo(Math.min(keepIndex || 0, pages - 1), false);
  }

  // 건수가 적어도 실적 영역이 줄어들지 않게, 꽉 찬 한 페이지 높이를 미리 재서 자리를 잡아 둠
  const wrap = $('#slider-wrap');
  let reserved = { size: 0, width: 0 };
  function reserveHeight() {
    if (reserved.size === size && reserved.width === wrap.clientWidth) return;
    const probe = document.createElement('div');
    probe.className = 'project-page';
    probe.style.cssText = 'position:absolute;left:0;top:0;width:100%;visibility:hidden;pointer-events:none';
    probe.innerHTML = groups.slice(0, size).map(card).join('');
    wrap.appendChild(probe);
    wrap.style.minHeight = Math.ceil(probe.getBoundingClientRect().height) + 'px';
    probe.remove();
    reserved = { size, width: wrap.clientWidth };
  }
  window.addEventListener('resize', () => { reserveHeight(); });
  if (document.fonts) document.fonts.ready.then(() => { reserved.width = 0; reserveHeight(); });

  function goTo(i, smooth = true) {
    current = Math.max(0, Math.min(i, pages - 1));
    const page = track.children[current];
    if (page) track.scrollTo({ left: page.offsetLeft - track.offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
    updatePager();
  }

  // 번호는 최대 5개만 보이고, 나머지는 … 로 줄임
  function pageNumbers() {
    if (pages <= 7) return [...Array(pages).keys()];
    const s = Math.max(1, Math.min(current - 1, pages - 4));
    const mid = [s, s + 1, s + 2];
    return [0, ...(s > 1 ? ['…'] : []), ...mid, ...(s + 2 < pages - 2 ? ['…'] : []), pages - 1];
  }

  function updatePager() {
    // 페이지가 하나뿐이어도 번호 줄 자리는 남겨 둠 (아래 내용이 올라오지 않게)
    pager.classList.toggle('is-idle', pages <= 1);
    pager.hidden = false;
    const arrow = (dir, label, disabled) =>
      `<button type="button" class="pg pg-arrow" data-go="${dir}" aria-label="${label}" ${disabled ? 'disabled' : ''}><svg class="ic" aria-hidden="true"><use href="#i-chevron-${dir}"/></svg></button>`;
    pager.innerHTML = arrow('prev', '이전 페이지', current === 0)
      + pageNumbers().map((n) => n === '…'
        ? '<span class="pg-gap">…</span>'
        : `<button type="button" class="pg" data-page="${n}" ${n === current ? 'aria-current="page"' : ''}>${n + 1}</button>`).join('')
      + arrow('next', '다음 페이지', current === pages - 1);
  }

  pager.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.go) goTo(current + (b.dataset.go === 'next' ? 1 : -1));
    else goTo(Number(b.dataset.page));
  });

  // 손가락으로 밀거나 가로 스크롤했을 때 현재 페이지 번호 맞추기
  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const w = track.children[1] ? track.children[1].offsetLeft - track.children[0].offsetLeft : track.clientWidth;
      const i = Math.round(track.scrollLeft / w);
      if (i !== current) { current = i; updatePager(); }
    });
  });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
  });

  // 화면 폭이 바뀌어 한 페이지 개수가 달라지면, 보던 첫 항목이 있는 페이지로
  const onResize = () => {
    if (perPage() === size) return goTo(current, false);
    const first = current * size;
    renderList(Math.floor(first / perPage()));
  };
  mqDesktop.addEventListener('change', onResize);
  mqTablet.addEventListener('change', onResize);

  renderChips();
  renderList();
})();
