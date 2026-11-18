"""
사이트 + 관리자 페이지 로컬 서버

실행:  python server.py         (또는 관리자_실행.bat 더블클릭)
사이트:      http://127.0.0.1:8080/
관리자:      http://127.0.0.1:8080/admin/

- 이 컴퓨터(127.0.0.1)에서만 접속할 수 있습니다.
- 저장하면 data/*.json 을 고치고, 이전 내용은 data/backup/ 에 남긴 뒤 build.py로 index.html을 다시 만듭니다.
"""
import json
import shutil
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import build

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
BACKUP = DATA / 'backup'
HOST, PORT = '127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8080
MAX_BODY = 2 * 1024 * 1024
KEEP_BACKUPS = 30


def text(v, limit=500):
    if v is None:
        return ''
    if not isinstance(v, (str, int, float)):
        raise ValueError('글자가 아닌 값이 있습니다')
    s = str(v).strip()
    if len(s) > limit:
        raise ValueError(f'글자 수가 너무 많습니다 ({limit}자까지)')
    return s


def clean_site(s):
    c = s['company']
    site = {
        'company': {k: text(c.get(k), 120) for k in
                    ('name', 'nameEn', 'ceo', 'zip', 'address', 'addressDetail', 'tel', 'mobile', 'fax', 'email')},
        'seo': {'title': text(s['seo'].get('title'), 120), 'description': text(s['seo'].get('description'), 300)},
        'hero': {'eyebrow': text(s['hero'].get('eyebrow'), 80), 'title': text(s['hero'].get('title'), 120),
                 'lead': text(s['hero'].get('lead'), 400)},
        'services': {
            'lead': text(s['services'].get('lead'), 200),
            'items': [{'icon': text(i.get('icon'), 20), 'title': text(i.get('title'), 60), 'text': text(i.get('text'), 300)}
                      for i in s['services']['items'][:12]],
            'more': text(s['services'].get('more'), 300),
        },
        'process': {'steps': [{'title': text(i.get('title'), 60), 'text': text(i.get('text'), 300)}
                              for i in s['process']['steps'][:9]]},
        'contact': {'tipsTitle': text(s['contact'].get('tipsTitle'), 80),
                    'tips': [text(t, 200) for t in s['contact']['tips'][:8] if text(t, 200)]},
    }
    if not site['company']['name']:
        raise ValueError('사무소 이름은 비울 수 없습니다')
    if not site['company']['tel']:
        raise ValueError('전화번호는 비울 수 없습니다')
    return site


def clean_projects(rows):
    out = []
    for n, p in enumerate(rows, 1):
        name, year, cat = text(p.get('name'), 200), text(p.get('year'), 4), text(p.get('category'), 40)
        if not name:
            raise ValueError(f'{n}번째 실적의 사업명이 비어 있습니다')
        if not (year.isdigit() and len(year) == 4):
            raise ValueError(f'"{name}"의 연도는 숫자 4자리여야 합니다')
        if not cat:
            raise ValueError(f'"{name}"의 분류가 비어 있습니다')
        out.append({'id': n, 'year': year, 'category': cat, 'name': name,
                    'scale': text(p.get('scale'), 100), 'capacity': text(p.get('capacity'), 40),
                    'zone': text(p.get('zone'), 100), 'work': text(p.get('work'), 200)})
    return out


def backup():
    stamp = time.strftime('%Y%m%d-%H%M%S')
    dest = BACKUP / stamp
    dest.mkdir(parents=True, exist_ok=True)
    for f in ('site.json', 'projects.json'):
        shutil.copy2(DATA / f, dest / f)
    olds = sorted(p for p in BACKUP.iterdir() if p.is_dir())
    for p in olds[:-KEEP_BACKUPS]:
        shutil.rmtree(p, ignore_errors=True)
    return stamp


def write_json(path, obj):
    tmp = path.with_suffix('.tmp')
    with tmp.open('w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write('\n')
    tmp.replace(path)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    # 데이터 원본·백업·서버 코드는 바깥으로 내보내지 않음 (관리자 API로만 읽음)
    BLOCK = ('/data/', '/templates/', '/server.py', '/build.py', '/.claude/')

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _local_only(self):
        if self.client_address[0] not in ('127.0.0.1', '::1'):
            self._json(403, {'error': '이 컴퓨터에서만 사용할 수 있습니다'})
            return False
        return True

    def end_headers(self):
        if self.path.startswith('/admin'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if any(path.startswith(b) for b in self.BLOCK):
            return self._json(404, {'error': '없음'})
        if path == '/api/content':
            if not self._local_only():
                return
            site = json.loads((DATA / 'site.json').read_text(encoding='utf-8'))
            projects = json.loads((DATA / 'projects.json').read_text(encoding='utf-8'))
            backups = sorted((p.name for p in BACKUP.iterdir() if p.is_dir()), reverse=True) if BACKUP.exists() else []
            return self._json(200, {'site': site, 'projects': projects, 'backups': backups[:10]})
        return super().do_GET()

    def do_POST(self):
        if self.path.split('?', 1)[0] != '/api/content':
            return self._json(404, {'error': '없음'})
        if not self._local_only():
            return
        origin = self.headers.get('Origin', '')
        if origin and origin not in (f'http://{HOST}:{PORT}', f'http://localhost:{PORT}'):
            return self._json(403, {'error': '다른 사이트에서 보낸 요청은 받지 않습니다'})
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {'error': '보낸 내용이 너무 큽니다'})
        try:
            body = json.loads(self.rfile.read(length).decode('utf-8'))
            site = clean_site(body['site'])
            projects = clean_projects(body['projects'])
        except (KeyError, TypeError, AttributeError):
            return self._json(400, {'error': '내용 형식이 올바르지 않습니다'})
        except ValueError as e:
            return self._json(400, {'error': str(e)})
        stamp = backup()
        write_json(DATA / 'site.json', site)
        write_json(DATA / 'projects.json', projects)
        try:
            result = build.build()
        except Exception as e:  # 빌드 실패 시 원래대로 되돌림
            for f in ('site.json', 'projects.json'):
                shutil.copy2(BACKUP / stamp / f, DATA / f)
            build.build()
            return self._json(500, {'error': f'페이지를 만들다 실패해서 되돌렸습니다: {e}'})
        backups = sorted((p.name for p in BACKUP.iterdir() if p.is_dir()), reverse=True)
        return self._json(200, {'ok': True, 'backup': stamp, 'backups': backups[:10], 'site': site,
                                'projects': projects, 'projectCount': result['projectCount']})

    def log_message(self, fmt, *args):
        sys.stderr.write('[%s] %s\n' % (time.strftime('%H:%M:%S'), fmt % args))


if __name__ == '__main__':
    build.build()
    print(f'사이트:   http://{HOST}:{PORT}/')
    print(f'관리자:   http://{HOST}:{PORT}/admin/')
    print('끄려면 이 창에서 Ctrl+C')
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
