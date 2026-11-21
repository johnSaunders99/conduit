import argparse
import array
from contextlib import contextmanager
import datetime as dt
import io
import json
import logging
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import wave

ROOT = Path(__file__).resolve().parents[1]
BIN = ROOT / 'tools/ffmpeg-9.0.2-essentials_build/bin'
URL = 'http://127.0.0.1:9880'
KEY = re.compile(r'[0-9a-f]{20}')
VOICE = re.compile(r'[a-z0-9][a-z0-9_-]{0,39}')
HAN = re.compile(r'[\u3400-\u9fff]')
EN = re.compile(r'[A-Za-z]+')
LOG = logging.getLogger('generate')
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
ENGINE = 'GPT-SoVITS'
VERSION = '20250606v2pro'


class AudioQualityError(Exception):
    pass


class EngineUnavailable(Exception):
    pass


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def load_rows(path, modules):
    order_map = {}
    if modules and any(not x.isdecimal() for x in modules):
        order_path = ROOT / 'work/module-order.json'
        order_map = read_json(order_path) if order_path.exists() else {}
    wanted = set()
    for mod in modules:
        if mod.isdecimal():
            if int(mod) < 1:
                raise ValueError('module pathOrder must be positive')
            wanted.add(int(mod))
        elif mod in order_map:
            wanted.add(order_map[mod])
        else:
            raise ValueError(f'unknown module {mod!r}; use pathOrder or an ID from work/module-order.json')
    seen = set()
    rows = []
    with path.open(encoding='utf-8-sig') as f:
        for line_no, line in enumerate(f, 1):
            if not line.strip():
                continue
            row = json.loads(line)
            key, speak, order = (row.get(k) for k in ('key', 'speak', 'pathOrder'))
            if (not isinstance(key, str) or not KEY.fullmatch(key) or key in seen
                    or not isinstance(speak, str) or not speak.strip()
                    or type(order) is not int or order < 1
                    or row.get('emotion') not in {'narrate', 'explain', 'encourage', 'ask'}):
                raise ValueError(f'{path}:{line_no}: invalid row or duplicate key')
            seen.add(key)
            if not wanted or order in wanted:
                rows.append(row)
    return sorted(rows, key=lambda row: row['pathOrder'])


def profile(voice):
    folder = ROOT / 'ref' / voice
    path = folder / 'voice.json'
    data = read_json(path)
    clips = {}
    for name in ('calm', 'warm'):
        fields = data.get(name)
        if fields is None and name == 'warm':
            continue
        audio = (folder / fields['audio']).resolve()
        text_path = (folder / fields['transcript']).resolve()
        if not all(p.is_relative_to(folder.resolve()) for p in (audio, text_path)):
            raise ValueError('reference paths must stay in the voice folder')
        prompt = text_path.read_text(encoding='utf-8-sig').strip()
        if not prompt:
            raise ValueError(f'missing reference transcript: {text_path}')
        with wave.open(str(audio), 'rb') as f:
            if (f.getnchannels(), f.getsampwidth(), f.getframerate()) != (1, 2, 32000):
                raise ValueError(f'{audio}: need mono PCM16 32 kHz')
            if not 3 <= f.getnframes() / f.getframerate() <= 10:
                raise ValueError(f'{audio}: need 3–10 seconds; preferably 5–8')
        clips[name] = (str(audio), prompt)
    return data['label'], clips


def manifest(path, voice, label):
    if not path.exists():
        return dict(voiceId=voice, voiceLabel=label, engine=ENGINE, version=VERSION, items={})
    data = read_json(path)
    if any(data.get(k) != v for k, v in (('voiceId', voice), ('engine', ENGINE), ('version', VERSION))):
        raise ValueError(f'{path}: existing manifest belongs to a different voice or engine build')
    if not isinstance(data.get('items'), dict):
        raise ValueError(f'{path}: invalid items')
    return data


def audio_rel(key):
    return f'{key[:2]}/{key}.ogg'


def is_done(folder, items, key):
    item = items.get(key)
    return (isinstance(item, dict) and item.get('file') == audio_rel(key)
            and type(item.get('ms')) is int and item['ms'] > 0
            and (folder / item['file']).is_file() and (folder / item['file']).stat().st_size > 0)


def atomic_json(path, value):
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', newline='\n',
                                     dir=path.parent, prefix='.' + path.name, suffix='.tmp',
                                     delete=False) as f:
        temp = Path(f.name)
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    try:
        for retry in range(5):
            try:
                os.replace(temp, path)
                break
            except PermissionError:
                if retry == 4:
                    raise
                time.sleep(0.05 * (retry + 1))
    finally:
        temp.unlink(missing_ok=True)


@contextmanager
def voice_lock(folder):
    import msvcrt
    with (folder / '.generate.lock').open('a+b') as f:
        try:
            f.seek(0)
            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise ValueError(f'another generator is writing {folder}') from exc
        try:
            yield
        finally:
            f.seek(0)
            msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)


def call_api(row, clips, timeout, low_memory, new_seed):
    text = engine_text(row['speak'])
    wav, prompt = clips.get('warm', clips['calm']) if row['emotion'] == 'encourage' else clips['calm']
    body = dict(
        text=text, text_lang='zh' if HAN.search(text) else 'en',
        ref_audio_path=wav, prompt_text=prompt, prompt_lang='zh' if HAN.search(prompt) else 'en',
        # Upstream 20250606v2pro accepts no per-request pinyin. Never inject hints into text.
        speed_factor=0.92 if row['emotion'] == 'ask' else 1.0,
        text_split_method='cut5', batch_size=1, split_bucket=False,
        parallel_infer=not low_memory, super_sampling=False, streaming_mode=False,
        media_type='wav', seed=(int(row['key'][:8], 16) + new_seed) % (2**31),
    )
    req = urllib.request.Request(URL + '/tts', json.dumps(body, ensure_ascii=False).encode('utf-8'),
                                 headers={'Content-Type': 'application/json'}, method='POST')
    start = time.perf_counter()
    try:
        with OPENER.open(req, timeout=timeout) as res:
            if res.geturl() != URL + '/tts':
                raise EngineUnavailable('unexpected API redirect')
            wav_data = res.read(32 * 1024 * 1024 + 1)
    except urllib.error.HTTPError as exc:
        # Don't log HTTP payloads: the server might echo lesson text.
        raise RuntimeError(f'TTS HTTP {exc.code}') from exc
    except urllib.error.URLError as exc:
        if isinstance(exc.reason, ConnectionRefusedError):
            raise EngineUnavailable('local API is not listening on 127.0.0.1:9880') from exc
        raise
    if len(wav_data) > 32 * 1024 * 1024:
        raise AudioQualityError('WAV exceeds size limit')
    return wav_data, time.perf_counter() - start


def phrase_units(text):
    # English vocabulary takes more time than a single Han syllable; digits are spoken too.
    return len(HAN.findall(text)) + len(re.findall(r'[0-9]', text)) + sum(
        max(1, len(word) / 3) for word in EN.findall(text))


# --- Text sent to the engine (2026-11-21, director) ---------------------------------------
# GPT-SoVITS v2Pro's cut5 splitter can drop 〇 or ／ in some contexts and then crash with
# "torch.cat(): expected a non-empty list of Tensors" (HTTP 400). 零 sounds the same as 〇.
# Symbol-only segments (MCQ options like `$?`, `{}`) are spelled out so the model has words.
# Only the engine text changes: the segment key, manifest and on-screen text stay as exported.
SYMBOL_WORDS = {'$': '錢字號', '?': '問號', '!': '驚嘆號', '#': '井字號', '~': '波浪號', '_': '底線',
                '%': '百分號', "'": '單引號', '"': '雙引號', ';': '分號', ':': '冒號', '*': '星號',
                '&': 'and 符號', '|': '直線', '@': '小老鼠', '^': '插入號', '\\': '反斜線', '/': '斜線',
                '=': '等號', '<': '小於', '>': '大於', '+': '加號', '-': '減號', ',': '逗號', '.': '點'}
SYMBOL_PAIRS = [('...', '省略號'), ('…', '省略號'), ('{}', '一對大括號'), ('[]', '一對中括號'),
                ('()', '一對小括號'), ('->', '到'), ('=>', '到')]
PER_UNIT = re.compile(r'\s*[／/]\s*(?=(?:秒|分鐘|分|小時|天|日|週|月|年|次|人|筆|個))')
CJK_PUNCT = '。，、；：？！「」『』（）《》—…・'
# GPT-SoVITS's English front end spells every ALL-CAPS token letter by letter (ORDER BY -> O R D E R B Y).
# Keep real abbreviations as letters; lowercase SQL keywords and other words so they are read as words.
ACRONYMS = set('''SQL CTE WSL UTF UI GC UDF UDAF UDTF AQE ISR TCP UDP TLS SSL PID UID DB IP DNS OOM AI ML LLM RAG PS ORC
LTS DIM IO PC MOR COW SLO SLA DFS POM PDF TWD GB MB KB TB PB MS NS ODS DWD DWS ADS ETL ELT CDC DAG OLTP SCD HDFS
JVM JDK JRE CSV API CPU GPU RAM SSD HDD URL URI UTC AWS EMR IAM VPC BI KPI GMV DAU MAU UV PV TPS QPS RPO RTO
PR CI CD VM OS ID IDE CLI SDK HTTP HTTPS SSH FTP VS RF DDL DML DQL DCL TTL ACL RBAC OSS OBS CDN SQS SNS ECS EKS
GCS GCP BOM BFS DFS FIFO LIFO LRU CTAS MCQ XML YAML HTML CSS JS TS NPM PIP OK PK FK UK QA UX CEO HR KV TCP IDC
ERP CRM CDP DMP SKU SPU GPS SMS PNG JPG SVG MP3 USB NFS SAN RAID MVP MVCC WAL LSM SST AOF RDB AOP IOC DTO DAO
ORM JDBC ODBC CRUD ACK NACK EOS IDL RPC REST GRPC'''.split()) - {'REST'}
CAPS_SPLIT = {'DATEDIFF': 'date diff', 'TIMESTAMPDIFF': 'timestamp diff', 'DATEADD': 'date add',
              'DATE_DIFF': 'date diff', 'NULLIF': 'null if', 'IFNULL': 'if null', 'ISNULL': 'is null',
              'README': 'read me', 'LASTEXITCODE': 'last exit code', 'SUBSTRING': 'sub string',
              'VARCHAR': 'var char', 'CONCAT': 'con cat', 'ASOF': 'as of', 'GROUPBY': 'group by',
              'ORDERBY': 'order by', 'SUBSTR': 'sub str', 'STRFTIME': 'str f time', 'TOPN': 'top N'}
CAPS = re.compile(r'(?<![A-Za-z0-9])[A-Z][A-Z0-9_]*[A-Z0-9](?![a-z])')


def speakable_caps(text):
    def fix(m):
        tok = m.group()
        if tok in CAPS_SPLIT:
            return CAPS_SPLIT[tok]
        if tok in ACRONYMS or not re.search(r'[AEIOUY]', tok) or re.search(r'\d', tok):
            return tok
        return tok.lower()
    return CAPS.sub(fix, text)
TOO_SHORT_UNITS = 5  # below this, GPT-SoVITS often returns silence; the app's system voice reads it
# Inside Chinese sentences the front end silently drops stand-alone operators: "price > 四十五 and price < 六十"
# was read as "price 四十五 and price 六十", "select * from" lost its star. Name them (2026-11-22).
INLINE_SYMBOLS = {'>': '大於', '<': '小於', '>=': '大於等於', '<=': '小於等於', '=': '等於', '==': '兩個等號',
                  '!=': '不等於', '<>': '不等於', '*': '星號', '/': '斜線', '//': '兩個斜線', '-': '減號',
                  '--': '兩個減號', '+': '加號', '%': '百分號', '|': '直線', '||': '兩條直線', '&': 'and 符號',
                  '&&': '兩個 and 符號', '^': '插入號', '>>': '兩個大於', '{}': '一對大括號', '[]': '一對中括號',
                  '()': '一對小括號', '{{': '兩個左大括號', '}}': '兩個右大括號', '.': '點'}
INLINE = re.compile(r'\s*(?<!\S)(' + '|'.join(sorted(map(re.escape, INLINE_SYMBOLS), key=len, reverse=True))
                    + r')(?=\s|$|[。，、；：？！」』）])\s*')


def engine_text(text):
    t = text.strip().replace('〇', '零')
    t = PER_UNIT.sub('每', t)
    t = t.replace('／', '、')
    t = re.sub(r'\s*(?:->|=>)\s*', '到', t)
    t = re.sub(r'(?<=[A-Za-z0-9])[-_](?=[A-Za-z0-9])', ' ', t)  # UTF-8, key-value, read-only
    t = speakable_caps(t)
    core = t.strip(CJK_PUNCT + ' ')
    if HAN.search(core):
        return INLINE.sub(lambda m: f' {INLINE_SYMBOLS[m.group(1)]} ', t)
    if not core:
        return ''
    if not re.search(r'[^A-Za-z0-9\s]', core):
        return t  # plain English word(s): leave to the engine
    words = []
    rest = core
    while rest:
        for pair, word in SYMBOL_PAIRS:
            if rest.startswith(pair):
                words.append(word)
                rest = rest[len(pair):]
                break
        else:
            m = re.match(r'[A-Za-z0-9]+', rest)
            if m:
                words.append(m.group())
                rest = rest[m.end():]
            elif rest[0].isspace():
                rest = rest[1:]
            else:
                words.append(SYMBOL_WORDS.get(rest[0], ''))
                rest = rest[1:]
    spoken = '、'.join(w for w in words if w)
    return spoken + '。' if spoken else ''


def inspect_wav(wav_data, text):
    try:
        with wave.open(io.BytesIO(wav_data), 'rb') as f:
            frames, rate = f.getnframes(), f.getframerate()
            if f.getsampwidth() != 2 or f.getnchannels() != 1 or not rate:
                raise AudioQualityError('API response is not PCM16 mono')
            pcm = array.array('h')
            pcm.frombytes(f.readframes(frames))
    except (EOFError, wave.Error, ValueError) as exc:
        raise AudioQualityError('invalid WAV response') from exc
    if sys.byteorder != 'little':
        pcm.byteswap()
    seconds = frames / rate
    units = phrase_units(text)
    if not max(0.23, 0.075 * units) <= seconds <= max(3.0, 0.85 * units + 1.2):
        raise AudioQualityError(f'duration outlier: {seconds:.2f}s for {units:.1f} spoken units')
    if len(pcm) != frames or not pcm:
        raise AudioQualityError('incomplete or empty PCM')
    if max(map(abs, pcm)) < 160 or sum(abs(s) > 160 for s in pcm) < rate * 0.045:
        raise AudioQualityError('silence-only or insufficient voiced signal')
    # One full-scale sample can be a peak; a run of rail samples indicates clipping.
    run = 0
    for s in pcm:
        run = run + 1 if abs(s) >= 32766 else 0
        if run >= 4:
            raise AudioQualityError('clipping in source PCM')
    return seconds


def run_media(binary, args, *, data=None):
    result = subprocess.run([str(BIN / (binary + '.exe')), *args], input=data,
                            capture_output=True, timeout=120)
    if result.returncode:
        raise RuntimeError(f'{binary} exit {result.returncode}: '
                           + result.stderr.decode('utf-8', 'replace')[-350:].strip())
    return result


def loudness(log):
    fields = re.findall(rb'\{\s*"input_i".*?\}', log, re.S)
    if not fields:
        raise AudioQualityError('ffmpeg gave no loudness result')
    return json.loads(fields[-1])


def encode(wav_data, out):
    common = ['-nostdin', '-hide_banner', '-i', 'pipe:0', '-vn']
    standard = 'loudnorm=I=-18:TP=-2:LRA=7'
    measure = run_media('ffmpeg', [*common, '-af', standard + ':print_format=json', '-f', 'null', '-'],
                        data=wav_data)
    values = loudness(measure.stderr)
    measured = [('I', 'input_i'), ('TP', 'input_tp'), ('LRA', 'input_lra'), ('thresh', 'input_thresh'),
                ('offset', 'target_offset')]
    if not all(math.isfinite(float(values[key])) for _, key in measured):
        raise AudioQualityError('no measurable loudness')
    filt = standard + ':linear=true:' + ':'.join(
        f'{name if name == "offset" else "measured_" + name}={float(values[key])}' for name, key in measured)
    run_media('ffmpeg', ['-v', 'error', '-y', *common, '-af', filt,
                         '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '40k',
                         '-application', 'voip', '-f', 'ogg', str(out)], data=wav_data)
    probe = json.loads(run_media('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
                                           '-show_entries', 'stream=codec_name,channels:format=duration',
                                           '-of', 'json', str(out)]).stdout)
    stream, = probe['streams']
    if (stream['codec_name'], stream['channels']) != ('opus', 1):
        raise AudioQualityError('encoded audio must be mono Opus')
    ms = round(float(probe['format']['duration']) * 1000)
    check = run_media('ffmpeg', ['-nostdin', '-hide_banner', '-i', str(out),
                                 '-af', standard + ':print_format=json', '-f', 'null', '-'])
    levels = loudness(check.stderr)
    if ms < 1 or not math.isfinite(float(levels['input_i'])) or float(levels['input_tp']) >= 0:
        raise AudioQualityError('encoded output has no measurable audio or clips after decoding')
    return ms, float(levels['input_i']), float(levels['input_tp'])


def make_one(row, clips, folder, args):
    key = row['key']
    dest = folder / audio_rel(key)
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp = dest.with_suffix('.ogg.part')
    faults = outliers = 0
    times = []
    try:
        while True:
            try:
                wav_data, seconds = call_api(row, clips, args.timeout, args.low_memory,
                                             faults + outliers + 1000 * args.seed_offset)
                times.append(seconds)
                raw_duration = inspect_wav(wav_data, engine_text(row['speak']))
                ms, lufs, dbtp = encode(wav_data, temp)
                os.replace(temp, dest)
                LOG.info('key=%s api=%.3fs total-api=%.3fs audio=%dms api-RTF=%.3f LUFS=%.2f dBTP=%.2f',
                         key, seconds, sum(times), ms, seconds / raw_duration, lufs, dbtp)
                if abs(lufs + 18) > 3:
                    LOG.warning('key=%s post-encode loudness %.2f LUFS is outside -18 +/-3', key, lufs)
                return dict(file=audio_rel(key), ms=ms)
            except AudioQualityError as exc:
                if outliers:
                    raise
                outliers += 1
                LOG.warning('%s audio outlier: %s; resynthesising once', key, exc)
            except EngineUnavailable:
                raise
            except (RuntimeError, OSError, subprocess.SubprocessError, ValueError) as exc:
                if faults == 2:
                    raise
                faults += 1
                LOG.warning('%s operation failed: %s; retry %d/2', key, exc, faults)
                time.sleep(faults)
    finally:
        temp.unlink(missing_ok=True)


def generate(args, rows, folder):
    label, clips = profile(args.voice)
    for exe in ('ffmpeg.exe', 'ffprobe.exe'):
        if not (BIN / exe).is_file():
            raise ValueError(f'FFmpeg tool missing: {BIN / exe}')
    require = URL + '/conduit-health'
    try:
        with OPENER.open(require, timeout=5) as res:
            health = json.load(res)
            if (res.geturl() != require or health.get('engine') != ENGINE
                    or health.get('release') != VERSION or health.get('model') != 'v2Pro'):
                raise EngineUnavailable('unexpected service on 127.0.0.1:9880')
    except OSError as exc:
        raise EngineUnavailable('start the local GPT-SoVITS API with tools/start-api.cmd first') from exc
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / 'manifest.json'
    with voice_lock(folder):
        data = manifest(path, args.voice, label)
        items = data['items']
        skipped_path = folder / 'skipped.jsonl'
        skipped_keys = set()
        if skipped_path.exists() and not args.retry_skipped:
            skipped_keys = {json.loads(x)['key'] for x in skipped_path.read_text(encoding='utf-8').splitlines() if x.strip()}
        rows = [r for r in rows if not is_done(folder, items, r['key']) and r['key'] not in skipped_keys][:args.limit]
        start = time.monotonic()
        dirty = failed = good = done = skipped = 0

        def skip(key, reason):
            with skipped_path.open('a', encoding='utf-8') as file:
                file.write(json.dumps(dict(key=key, reason=reason,
                                          time=dt.datetime.now().isoformat(timespec='seconds')),
                                      ensure_ascii=False) + '\n')
        LOG.info('voice=%s queued=%d source=%s low_memory=%s', args.voice, len(rows), args.input, args.low_memory)
        try:
            for row in rows:
                key = row['key']
                spoken = engine_text(row['speak'])
                try:
                    if not spoken:
                        raise AudioQualityError('no speakable text')
                    items[key] = make_one(row, clips, folder, args)
                    good += 1
                    dirty += 1
                except EngineUnavailable:
                    raise
                except AudioQualityError as exc:
                    if spoken and phrase_units(spoken) >= TOO_SHORT_UNITS:
                        failed += 1
                        LOG.error('key=%s failed: %s', key, exc)
                        with (folder / 'failures.jsonl').open('a', encoding='utf-8') as file:
                            file.write(json.dumps(dict(key=key, error=str(exc),
                                                      time=dt.datetime.now().isoformat(timespec='seconds')),
                                                  ensure_ascii=False) + '\n')
                    else:
                        skipped += 1
                        reason = f'too short for the engine ({exc}); the app reads it with the system voice'
                        LOG.info('key=%s skipped: %s', key, reason)
                        skip(key, reason)
                except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as exc:
                    failed += 1
                    LOG.error('key=%s failed: %s', key, exc)
                    with (folder / 'failures.jsonl').open('a', encoding='utf-8') as file:
                        file.write(json.dumps(dict(key=key, error=str(exc),
                                                  time=dt.datetime.now().isoformat(timespec='seconds')),
                                              ensure_ascii=False) + '\n')
                done += 1
                if dirty >= args.flush_every:
                    atomic_json(path, data)
                    dirty = 0
                eta = (time.monotonic() - start) * (len(rows) - done) / done
                LOG.info('%d/%d done, ETA %s (ok=%d failed=%d skipped=%d)', done, len(rows),
                         dt.timedelta(seconds=round(eta)), good, failed, skipped)
        finally:
            if dirty:
                atomic_json(path, data)
        return 2 if failed else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description='Generate offline Conduit read-aloud clips')
    parser.add_argument('--input', type=Path, default=ROOT / 'work/segments.jsonl')
    parser.add_argument('--voice', default='taimecs')
    parser.add_argument('--limit', type=int, help='limit new or missing keys after skipping completed items')
    parser.add_argument('--modules', nargs='+', default=[], help='module IDs or pathOrders (comma or space separated)')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--retry-skipped', action='store_true', help='also retry keys listed in skipped.jsonl')
    parser.add_argument('--seed-offset', type=int, default=0, help='use a different take (for re-synthesising flagged clips)')
    parser.add_argument('--flush-every', type=int, default=10)
    parser.add_argument('--timeout', type=float, default=180)
    parser.add_argument('--low-memory', action='store_true', help='use upstream non-parallel semantic inference')
    args = parser.parse_args(argv)
    if (not VOICE.fullmatch(args.voice) or args.flush_every < 1 or args.timeout < 1
            or (args.limit is not None and args.limit < 1)):
        parser.error('invalid voice, limit, flush interval or timeout')
    try:
        rows = load_rows(args.input, [v for group in args.modules for v in group.split(',') if v])
        folder = ROOT / 'audio' / args.voice
        if args.dry_run:
            data = manifest(folder / 'manifest.json', args.voice, args.voice)
            queued = [r for r in rows if not is_done(folder, data['items'], r['key'])]
            chosen = queued[:args.limit]
            print(f'{len(rows)} selected, {len(rows)-len(queued)} complete, {len(chosen)} queued; '
                  f'{sum(bool(r.get("polyphones")) for r in chosen)} with advisory pinyin hints')
            return 0
        logs = ROOT / 'logs'
        logs.mkdir(exist_ok=True)
        logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
                            handlers=[logging.StreamHandler(), logging.FileHandler(logs / 'generate.log', encoding='utf-8')])
        return generate(args, rows, folder)
    except (OSError, EngineUnavailable, ValueError, KeyError, TypeError) as exc:
        print(f'Generation stopped: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
