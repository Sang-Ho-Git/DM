"""
data/site.json, data/projects.json + templates/index.template.html
→ index.html, js/projects.js 를 만듭니다.

직접 실행:  python build.py
관리자 페이지에서 저장하면 server.py가 자동으로 실행합니다.
"""
import html
import json
import re
import time
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
ICONS = {'ruler', 'file', 'sprout', 'factory', 'sun', 'route', 'phone', 'point'}


def esc(v):
    return html.escape(str(v or ''), quote=True)


def get(d, path):
    for k in path.split('.'):
        d = d.get(k, '') if isinstance(d, dict) else ''
    return d


def tel_href(num):
    """전화 링크는 숫자만 (예: tel:0413560117) — 휴대폰마다 하이픈·공백 처리가 달라서"""
    digits = re.sub(r'[^\d+]', '', str(num or ''))
    return 'tel:' + digits


def blocks(site):
    c = site['company']
    point = '<svg class="ic" aria-hidden="true"><use href="#i-point"/></svg>'
    services = '\n'.join(
        f'          <article class="service">\n'
        f'            <svg class="ic service-ic" aria-hidden="true"><use href="#i-{s.get("icon") if s.get("icon") in ICONS else "point"}"/></svg>\n'
        f'            <h3>{esc(s.get("title"))}</h3>\n'
        f'            <p>{esc(s.get("text"))}</p>\n'
        f'          </article>'
        for s in site['services']['items'])
    steps = '\n'.join(
        f'          <li><span class="step-no">{i}</span><h3>{esc(s.get("title"))}</h3><p>{esc(s.get("text"))}</p></li>'
        for i, s in enumerate(site['process']['steps'], 1))
    rows = [('대표', esc(c.get('ceo')))]
    addr = esc(c.get('address'))
    if c.get('zip'):
        addr = f'({esc(c["zip"])}) ' + addr
    if c.get('addressDetail'):
        addr += '<br>' + esc(c['addressDetail'])
    rows.append(('주소', addr))
    if c.get('tel'):
        rows.append(('전화', f'<a href="{esc(tel_href(c["tel"]))}">{esc(c["tel"])}</a>'))
    if c.get('mobile'):
        rows.append(('휴대폰', f'<a href="{esc(tel_href(c["mobile"]))}">{esc(c["mobile"])}</a>'))
    if c.get('fax'):
        rows.append(('팩스', esc(c['fax'])))
    if c.get('email'):
        rows.append(('이메일', f'<a href="mailto:{esc(c["email"])}">{esc(c["email"])}</a>'))
    contact_list = '\n'.join(f'            <div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in rows if v)
    tips = '\n'.join(f'            <li>{point}<span>{esc(t)}</span></li>' for t in site['contact']['tips'] if t)
    # 항목마다 <span class="nw">로 묶어 "F."와 번호 사이처럼 항목 중간에서 줄이 바뀌지 않게 함
    line1 = [f'<span class="footer-name nw">{esc(c.get("name"))}</span>']
    if c.get('ceo'):
        line1.append(f'<span class="nw">대표 {esc(c["ceo"])}</span>')
    full_addr = ' '.join(x for x in [f'({c["zip"]})' if c.get('zip') else '', c.get('address', ''), c.get('addressDetail', '')] if x)
    line1.append(esc(full_addr))
    line2 = [f'<span class="nw">{k}. {esc(c[f])}</span>' for k, f in [('T', 'tel'), ('M', 'mobile'), ('F', 'fax'), ('E', 'email')] if c.get(f)]
    footer = (f'<p>{" · ".join(line1)}</p>\n      <p>{" · ".join(line2)}</p>\n'
              f'      <p class="copy">© {esc(c.get("name"))}</p>')
    return {
        'heroTitle': '<br>'.join(esc(x) for x in str(site['hero'].get('title', '')).split('\n')),
        'services': services,
        'steps': steps,
        'contactList': contact_list,
        'tips': tips,
        'footer': footer,
        'telHref': esc(tel_href(c.get('tel'))),
        'mapUrl':esc('https://map.naver.com/p/search/' + quote(c.get('address', ''))),
        'version': str(int(time.time())),
    }


def build():
    site = json.loads((DATA / 'site.json').read_text(encoding='utf-8'))
    projects = json.loads((DATA / 'projects.json').read_text(encoding='utf-8'))
    tpl = (ROOT / 'templates' / 'index.template.html').read_text(encoding='utf-8')
    b = blocks(site)

    def fill(m):
        key = m.group(1)
        if key.startswith('@'):
            return b[key[1:]]
        return esc(get(site, key))

    out = re.sub(r'\{\{\s*([@\w.]+)\s*\}\}', fill, tpl)
    _write(ROOT / 'index.html', out)

    keep = ('year', 'category', 'name', 'scale', 'capacity', 'zone', 'work')
    rows = [{**{k: str(p.get(k, '') or '') for k in keep}, 'count': int(p.get('count') or 1)} for p in projects]
    js = ('// 이 파일은 build.py가 data/projects.json으로 자동 생성합니다. 직접 고치지 마세요.\n'
          'window.PROJECTS = ' + json.dumps(rows, ensure_ascii=False, indent=1) + ';\n')
    _write(ROOT / 'js' / 'projects.js', js)
    return {'projectCount': len(rows)}


def _write(path, text):
    tmp = path.with_suffix(path.suffix + '.tmp')
    with tmp.open('w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    tmp.replace(path)


if __name__ == '__main__':
    print('완료', build())
