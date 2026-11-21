import concurrent.futures as cf
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit

from fetch_official import ROOT, download

plan = Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'work/pip-plan-modern.json'
rows = json.loads(plan.read_text(encoding='utf-8'))['install']
pins = []
files = []
for row in rows:
    info = row['download_info']
    name, version = (row['metadata'][key] for key in ('name','version'))
    pins.append(f'{name}=={version}')
    url = info['url']
    if url.startswith('file:'):
        local = Path(unquote(urlsplit(url).path.lstrip('/')))
        if not local.resolve().is_relative_to(ROOT/'wheelhouse') or not local.is_file():
            raise ValueError(f'Unexpected offline wheel: {url}')
        continue
    if urlsplit(url).hostname != 'files.pythonhosted.org':
        raise ValueError(f'Artifact outside PyPI: {url}')
    filename = unquote(urlsplit(url).path.rsplit('/',1)[-1])
    sha = info['archive_info']['hashes']['sha256']
    if len(sha)!=64 or not filename.endswith('.whl'):
        raise ValueError(f'Unverified non-wheel: {filename}')
    files.append((Path('wheelhouse') / filename, url, sha))
(ROOT/'work/resolved-win311.txt').write_text('\n'.join(sorted(pins,key=str.lower))+'\n', encoding='utf-8')
with cf.ThreadPoolExecutor(12) as e:
    list(e.map(lambda item: download(*item), files))
