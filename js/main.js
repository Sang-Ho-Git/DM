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

  // 실적 요약 숫자: "외 22건"처럼 여러 건을 묶은 항목은 건수(count)만큼 셈
  const cnt = (p) => Number(p.count) || 1;
  const sumCount = (arr) => arr.reduce((s, p) => s + cnt(p), 0);
  const count = (key) => data.reduce((m, p) => (m[p[key]] = (m[p[key]] || 0) + cnt(p), m), {});
  const cats = count('category');
  const years = Object.keys(count('year')).sort();
  const total = sumCount(data);
  $('#hero-stats').innerHTML = [
    [total + '건', '주요 인허가 실적'],
    [Object.keys(cats).length + '개', '시설 분야'],
    [(cats['태양광발전시설'] || 0) + '건', '태양광발전시설'],
    [years[0] + '~' + years[years.length - 1], '실적 연도'],
  ].map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join('');
  $('#projects-lead').textContent = `${years[0]}~${years[years.length - 1]}년에 진행한 주요 실적을 분류와 연도로 골라 볼 수 있습니다`;

  // 필터
  const state = { cat: '전체', year: '전체', q: '' };
  const catOrder = ['전체', ...Object.keys(cats).sort((a, b) => cats[b] - cats[a])];
  const chip = (group, value, n) =>
    `<button type="button" class="chip" data-group="${group}" data-value="${esc(value)}" aria-pressed="${state[group] === value}">${esc(value)}${n != null ? `<span class="n">${n}</span>` : ''}</button>`;
  function renderChips() {
    $('#cat-chips').innerHTML = catOrder.map((c) => chip('cat', c, c === '전체' ? total : cats[c])).join('');
    $('#year-chips').innerHTML = ['전체', ...years.slice().reverse()].map((y) => chip('year', y, null)).join('');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    state[b.dataset.group] = b.dataset.value;
    renderChips();
    renderList();
  });
  $('#search').addEventListener('input', (e) => { state.q = e.target.value.trim(); renderList(); });


  function card(p) {
    // 카드 높이를 모두 같게: 제목 2줄, 규모·용도지역 1줄, 업무 1줄 (넘치면 … 처리, 전체 내용은 title로)
    const meta = [cnt(p) > 1 ? `총 ${cnt(p)}건` : '', p.capacity, p.scale, p.zone].filter(Boolean).join(' · ');
    const works = p.work.split(',').map((w) => w.trim()).filter(Boolean).join(' · ');
    return `<article class="project">
      <div class="project-top"><span class="tag">${esc(p.category)}</span><span class="year">${esc(p.year)}년</span></div>
      <h3 title="${esc(p.name)}">${esc(p.name)}</h3>
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
    const q = state.q.replace(/\s+/g, '');
    return data
      .filter((p) => state.cat === '전체' || p.category === state.cat)
      .filter((p) => state.year === '전체' || p.year === state.year)
      .filter((p) => !q || (p.name + p.zone + p.work + p.category).replace(/\s+/g, '').includes(q))
      // 연도 최신순, 같은 연도 안에서는 데이터 파일 뒤쪽(더 최근에 진행한 것)이 먼저
      .sort((a, b) => b.year.localeCompare(a.year) || data.indexOf(b) - data.indexOf(a));
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
    probe.innerHTML = data.slice(0, size).map(card).join('');
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
    const from = list.length ? current * size + 1 : 0;
    const to = Math.min(list.length, (current + 1) * size);
    // 묶음 항목이 있으면 "134건 (77개 항목) 중 1–9", 없으면 "12건 중 1–9"
    const sum = sumCount(list);
    const head = sum === list.length ? `${sum}건` : `${sum}건 (${list.length}개 항목)`;
    $('#result-count').textContent = list.length ? `${head} 중 ${from}–${to}` : '0건';
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
