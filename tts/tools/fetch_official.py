import concurrent.futures as cf
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import threading
import time
from urllib.parse import urlsplit
import urllib.request as u
import zipfile

ROOT = Path(__file__).resolve().parents[1]
APP = Path('app/GPT-SoVITS-20250606v2pro')
M = APP / 'GPT_SoVITS/pretrained_models'
FF = 'ffmpeg-9.0.2-essentials_build.zip'
HF = 'https://huggingface.co'
LOCK = threading.Lock()
LEDGER = ROOT / 'LEDGER.md'


def open_direct(url, method='GET', headers=None):
    if urlsplit(url).scheme != 'https':
        raise ValueError('HTTPS required')
    return u.build_opener(u.ProxyHandler({})).open(u.Request(url, headers=headers or {}, method=method), timeout=60)


def metadata(url):
    with open_direct(url) as r:
        return json.load(r)


def record(rel, url, size, digest):
    row = f'| `{rel.as_posix()}` | {url} | {size} | `{digest}` | {dt.date.today()} |'
    with LOCK:
        if LEDGER.exists() and row in LEDGER.read_text(encoding='utf-8'):
            return
        with LEDGER.open('a', encoding='utf-8') as ledger:
            if ledger.tell() == 0:
                ledger.write('# ConduitTTS download ledger\n\nComplete payloads only; package index lookups are not stored.\n\n| File | Source URL | Bytes | SHA-256 | Date |\n| --- | --- | ---: | --- | --- |\n')
            ledger.write(row + '\n')


def download(rel, url, expected=None, size=None):
    rel = Path(rel)
    target = ROOT / rel
    print(f'PLAN  {rel.as_posix()} {size or "unknown"} {url}', flush=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        with target.open('rb') as f:
            digest = hashlib.file_digest(f, 'sha256').hexdigest()
        count = target.stat().st_size
        if (expected and expected != digest) or (size and count != size):
            raise ValueError(f'existing file does not match source: {rel}')
        record(rel, url, count, digest)
        return target
    part = target.with_name(target.name + '.part')
    for attempt in range(3):
        try:
            offset = part.stat().st_size if part.exists() else 0
            with open_direct(url, headers={'Range': f'bytes={offset}-'} if offset else {}) as response:
                if response.status != 206:
                    offset = 0
                elif not response.headers.get('Content-Range', '').startswith(f'bytes {offset}-'):
                    raise ValueError('Unexpected content range')
                content_len = response.headers.get('Content-Length')
                transferred = 0
                with part.open('ab' if offset else 'wb') as f:
                    while chunk := response.read(1024 * 1024):
                        f.write(chunk)
                        transferred += len(chunk)
            count = part.stat().st_size
            if not count or (content_len and transferred != int(content_len)) or (size and count != size):
                raise OSError(f'incomplete payload of {count} bytes')
            with part.open('rb') as f:
                digest = hashlib.file_digest(f, 'sha256').hexdigest()
            if expected and digest != expected:
                raise ValueError(f'SHA-256 mismatch for {rel}: {digest}')
            os.replace(part, target)
            record(rel, url, count, digest)
            print(f'DONE  {rel.as_posix()} {count}', flush=True)
            return target
        except (OSError, u.URLError) as exc:
            print(f'RETRY {rel.name}: {exc}', flush=True)
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def _pytorch(package):
    index = f'https://download.pytorch.org/whl/cu124/{package}/'
    name = f'{package}-2.6.0+cu124-cp311-cp311-win_amd64.whl'
    encoded = name.replace('+', '%2B')
    with open_direct(index) as response:
        page = response.read().decode()
    match = re.search(r'href="(https://(?:download-r2|download)\.pytorch\.org/[^"#]*/?'+re.escape(encoded)+r')#sha256=([a-f0-9]{64})"', page, re.I)
    if not match:
        raise ValueError(f'{name}: SHA-256 not found in official index')
    fallback_host = f'https://download.pytorch.org/whl/cu124/{encoded}'
    with open_direct(fallback_host, 'HEAD') as response:
        size = int(response.headers['Content-Length'])
    return (Path('wheelhouse')/name, fallback_host, match[2], size)


def hf_files(repo, paths, kind='models'):
    info = metadata(f'{HF}/api/{kind}/{repo}?blobs=true')
    revision = info['sha']
    lookup = {item['rfilename']: item for item in info['siblings']}
    base = f'{HF}/{"datasets/" if kind == "datasets" else ""}{repo}/resolve/{revision}'
    for target, filename in paths:
        item = lookup[filename]
        yield (target, f'{base}/{filename}', item.get('lfs', {}).get('sha256'), item.get('size'))


def extract(archive, dest):
    target = (ROOT / dest).resolve()
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            if not (target / item.filename).resolve().is_relative_to(target):
                raise ValueError(f'unsafe zip member {item.filename}')
        z.extractall(target)


def main(kind):
    if kind == 'source':
        src = download(Path('downloads') / (APP.name + '.zip'), 'https://codeload.github.com/RVC-Boss/GPT-SoVITS/zip/refs/tags/20250606v2pro')
        if not (ROOT / APP).exists():
            extract(src, APP.parent)
        return
    if kind == 'torch':
        entries = [_pytorch(x) for x in ('torch','torchaudio')]
    elif kind == 'ffmpeg':
        archive = download(Path('downloads')/FF, 'https://www.gyan.dev/ffmpeg/builds/packages/'+FF, '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba', 114768076)
        if not (ROOT / 'tools' / FF[:-4]).exists():
            extract(archive, 'tools')
        return
    elif kind == 'models':
        names = ['s1v3.ckpt','v2Pro/s2Gv2Pro.pth','sv/pretrained_eres2netv2w24s4ep4.ckpt']
        names += ['chinese-roberta-wwm-ext-large/'+x for x in ('pytorch_model.bin','config.json','tokenizer.json')]
        names += ['chinese-hubert-base/'+x for x in ('pytorch_model.bin','config.json','preprocessor_config.json')]
        entries = list(hf_files('lj1995/GPT-SoVITS', [(M / x, x) for x in names]))
        entries += list(hf_files('XXXXRT/GPT-SoVITS-Pretrained', [(Path('downloads/G2PWModel.zip'),'G2PWModel.zip')]))
    elif kind == 'frontend':
        entries = [(M / 'fast_langdetect' / f'lid.176.{ext}', f'https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.{ext}', None, None) for ext in ('bin','ftz')]
        for cat, name in [('corpora','cmudict'),('taggers','averaged_perceptron_tagger'),('taggers','averaged_perceptron_tagger_eng')]:
            rel = f'{cat}/{name}.zip'
            entries.append((Path('nltk_data')/rel,'https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/'+rel,None,None))
    else:
        raise ValueError(kind)
    def get(entry):
        path = download(*entry)
        if kind == 'frontend' and path.suffix == '.zip':
            extract(path, path.parent.relative_to(ROOT))
        if path.name == 'G2PWModel.zip':
            target = APP / 'GPT_SoVITS/text'
            with zipfile.ZipFile(path) as z:
                paths = [n for n in z.namelist() if n.endswith('/g2pW.onnx') or n == 'g2pW.onnx']
            prefix = paths[0].split('/')[:-1]
            if prefix != ['G2PWModel']:
                raise ValueError(f'Unexpected G2PW ZIP layout: {paths}')
            extract(path, target)
    with cf.ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(get, entries))


if __name__ == '__main__':
    main(sys.argv[1])
