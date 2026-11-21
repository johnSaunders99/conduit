"""Fetch metadata-selected filenames in parallel; verify package hashes via PyPI."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import sys
import time

from fetch_official import ROOT, download, metadata

log = (ROOT/'logs/resolve-modern.log').read_bytes()
if log[:2] == b'\xff\xfe':
    log = log.decode('utf-16')
else:
    log = log.decode('utf-8-sig', errors='replace')
files = sorted(set(re.findall(r'Downloading ([A-Za-z0-9._+-]+\.whl)(?:\.metadata)? \(', log)))
assert len(files)>50, len(files)
print('Planning',len(files),'resolver-selected wheels',flush=True)

def get(filename):
    name, version, *_ = filename.split('-')
    for attempt in range(3):
        try:
            d = metadata(f'https://pypi.org/pypi/{name}/{version}/json')
            entry, = [r for r in d['urls'] if r['filename']==filename]
            return download(Path('wheelhouse')/filename,entry['url'],entry['digests']['sha256'],entry['size'])
        except OSError as exc:
            if attempt==2:
                raise
            print('retry metadata',filename,str(exc),flush=True)
            time.sleep(1)

with ThreadPoolExecutor(18) as pool:
    list(pool.map(get,files))
