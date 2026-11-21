"""Run only the smoke set and, optionally, the approved 120-item sample."""
import csv
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
from types import SimpleNamespace

import generate
from generate import ROOT, URL, OPENER, make_one, profile, load_rows, atomic_json

APP = ROOT/'app/GPT-SoVITS-20250606v2pro'
LOGS = ROOT/'logs'
PY = ROOT/'.venv/Scripts/python.exe'


def server_env():
    env = os.environ.copy()
    for name, folder in {'TEMP':'tmp','TMP':'tmp','PIP_CACHE_DIR':'pip-cache','HF_HOME':'hf-cache',
                         'NLTK_DATA':'nltk_data','TORCH_HOME':'torch-cache'}.items():
        env[name] = str(ROOT/folder)
    env.update(PYTHONUTF8='1', PYTHONUNBUFFERED='1', PYTHONDONTWRITEBYTECODE='1',
               HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
    env['PATH'] = str(generate.BIN) + os.pathsep + env['PATH']
    return env


def stats():
    command = ['nvidia-smi', '--query-gpu=name,driver_version,memory.total,memory.used',
               '--format=csv,noheader,nounits']
    output = subprocess.run(command, capture_output=True, text=True, timeout=5, check=True).stdout
    rows = list(csv.reader(output.splitlines()))
    row = rows[0]
    return dict(gpu=row[0].strip(), driver=row[1].strip(), total_mib=int(row[2]), used_mib=int(row[3]))


def endpoint(proc):
    expires = time.monotonic() + 300
    while time.monotonic() < expires:
        if proc.poll() is not None:
            raise RuntimeError(f'API exited {proc.returncode}; see API log')
        try:
            with OPENER.open(URL+'/conduit-health', timeout=2) as response:
                return json.load(response)
        except (OSError, ValueError):
            time.sleep(1)
    raise TimeoutError('Local server did not reach /conduit-health in 300s')


def try_server(mode, sample, attempts):
    cpu = mode == 'cpu'
    low = mode == 'low-memory'
    args = SimpleNamespace(timeout=180, low_memory=low or cpu)
    baseline = stats()
    readings = []
    phase = ['startup']
    stop = threading.Event()
    def poll():
        while not stop.is_set():
            try:
                readings.append((phase[0], stats()['used_mib']))
            except (OSError, subprocess.SubprocessError, ValueError) as exc:
                logging.warning('nvidia-smi poll failed: %s', exc)
            stop.wait(0.35)
    watcher = threading.Thread(target=poll)
    with (LOGS/f'api-{mode}.log').open('w', encoding='utf-8') as log, tempfile.TemporaryDirectory(
            prefix='conduit-smoke-', dir=ROOT/'tmp') as folder:
        config = ROOT / ('tts-v2pro-cpu.yaml' if cpu else 'tts-v2pro.yaml')
        proc = subprocess.Popen([str(PY), '-B', 'api_v2.py', '-a', '127.0.0.1', '-p', '9880', '-c', str(config)],
                                env=server_env(), cwd=APP, stdout=log, stderr=subprocess.STDOUT,
                                creationflags=subprocess.CREATE_NO_WINDOW)
        watcher.start()
        info = dict(mode=mode, baseline=baseline, rows=[])
        attempts.append(info)
        try:
            info['health'] = health = endpoint(proc)
            if (health.get('model'), health.get('device'), health.get('fp16')) != (
                    'v2Pro','cpu' if cpu else 'cuda', not cpu):
                raise RuntimeError(f'Wrong model or precision: {health}')
            _, clips = profile('taimecs')
            smoke = load_rows(ROOT/'samples/smoke.jsonl', [])
            if len(smoke) != 3:
                raise ValueError('smoke list must contain exactly 3 rows')
            phase[0] = 'smoke'
            for row in smoke:
                start = time.perf_counter()
                result = make_one(row, clips, Path(folder), args)
                info['rows'].append(dict(key=row['key'], end_to_end_s=time.perf_counter()-start, ms=result['ms']))
            phase[0] = 'idle'
            info['end_to_end_rtf'] = sum(x['end_to_end_s'] for x in info['rows'])/(sum(x['ms'] for x in info['rows'])/1000)
            info['succeeded'] = True
            atomic_json(LOGS/'smoke-metrics.json', attempts)
            if sample:
                phase[0] = 'sample'
                command = [str(PY), '-B', str(ROOT/'tools/generate.py'),
                           '--voice','taimecs','--input',str(ROOT/'samples/segments.jsonl'), '--limit','120']
                if low or cpu:
                    command.append('--low-memory')
                with (LOGS/'sample-generation.log').open('w', encoding='utf-8') as out:
                    info['sample_exit'] = subprocess.run(command, env=server_env(), cwd=ROOT,
                                                          stdout=out, stderr=subprocess.STDOUT).returncode
        except (OSError, RuntimeError, ValueError, generate.AudioQualityError, generate.EngineUnavailable) as exc:
            info['error'] = str(exc)
        finally:
            stop.set()
            watcher.join()
            if proc.poll() is None:
                proc.terminate()
                proc.wait(timeout=15)
            info['device_peak_mib'] = {p: max(v for q,v in readings if q==p) for p in set(q for q,v in readings)}
            info['sampled_points'] = len(readings)
            atomic_json(LOGS/'smoke-metrics.json', attempts)
        return bool(info.get('succeeded'))


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    attempts = []
    for mode in ['cuda','low-memory','cpu']:
        if try_server(mode, '--sample' in sys.argv, attempts):
            break
        failure = attempts[-1]
        api_log = (LOGS/f'api-{mode}.log').read_text(encoding='utf-8',errors='replace').lower()
        if not any(s in api_log for s in ('out of memory','cuda error','cublas_status_alloc_failed')):
            print(failure.get('error','inference failed'), file=sys.stderr)
            sys.exit(1)
    else:
        sys.exit(1)
    sys.exit(attempts[-1].get('sample_exit',0))
