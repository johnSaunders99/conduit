"""Best-of-N retakes for clips the ASR screen flagged (director, 2026-11-22).

For each key: re-screen the current clip, synthesise --takes alternative takes with new seeds,
score every take with the same local ASR (Han-only CER plus a length-ratio penalty), and swap in
the best take only when it beats the current clip by --margin. Replaced files are kept in
audio/<voice>/_replaced_retake/; results go to work/retake.jsonl. Needs the local API running.
"""
import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import generate as g  # noqa: E402
from qa_full import han_only  # noqa: E402
from qa import edits, MODEL  # noqa: E402


def score(asr, ogg, truth):
    raw = g.run_media('ffmpeg', ['-v', 'error', '-nostdin', '-i', str(ogg),
                                 '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1']).stdout
    res, = asr(np.frombuffer(raw, dtype='<f4'))
    heard = res['preds'][0] if isinstance(res['preds'], (list, tuple)) else res['preds']
    got = han_only(heard)
    cer = edits(truth, got) / len(truth)
    ratio = len(got) / len(truth)
    return dict(cer=round(cer, 3), ratio=round(ratio, 2), heard=heard,
                score=round(cer + max(0.0, 0.8 - ratio) + max(0.0, ratio - 1.25), 3))


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--voice', default='taimecs')
    p.add_argument('--keys', required=True, help='file with one key per line')
    p.add_argument('--takes', type=int, default=3)
    p.add_argument('--margin', type=float, default=0.10)
    p.add_argument('--out', default=str(g.ROOT / 'work/retake.jsonl'))
    a = p.parse_args()
    folder = g.ROOT / 'audio' / a.voice
    label, clips = g.profile(a.voice)
    with g.OPENER.open(g.URL + '/conduit-health', timeout=5) as res:
        if json.load(res).get('engine') != g.ENGINE:
            raise SystemExit('unexpected service on 127.0.0.1:9880')
    want = [x.strip() for x in open(a.keys, encoding='utf-8') if x.strip()]
    rows = {json.loads(x)['key']: json.loads(x) for x in open(g.ROOT / 'work/segments.jsonl', encoding='utf-8') if x.strip()}
    from funasr_onnx import Paraformer
    asr = Paraformer(str(MODEL), batch_size=1, quantize=True, device_id='-1', intra_op_num_threads=4)
    keep = folder / '_replaced_retake'
    keep.mkdir(exist_ok=True)
    args = argparse.Namespace(timeout=180, low_memory=False)
    start, swapped = time.monotonic(), 0
    with g.voice_lock(folder), tempfile.TemporaryDirectory(dir=g.ROOT / 'work') as tmp, \
            open(a.out, 'a', encoding='utf-8') as log:
        path = folder / 'manifest.json'
        data = g.manifest(path, a.voice, label)
        items = data['items']
        for i, key in enumerate(want, 1):
            row, item = rows.get(key), items.get(key)
            truth = han_only(g.engine_text(row['speak'])) if row else ''
            if not row or not item or len(truth) < 6:
                continue
            cur = score(asr, folder / item['file'], truth)
            takes = []
            for n in range(1, a.takes + 1):
                ogg = Path(tmp) / f'{key}.{n}.ogg'
                try:
                    wav, _ = g.call_api(row, clips, args.timeout, args.low_memory, 1000 * (10 + n))
                    g.inspect_wav(wav, g.engine_text(row['speak']))
                    ms, lufs, tp = g.encode(wav, ogg)
                except (g.AudioQualityError, RuntimeError, OSError, ValueError) as exc:
                    takes.append(dict(take=n, error=str(exc)[:120]))
                    continue
                takes.append(dict(take=n, ms=ms, file=str(ogg), **score(asr, ogg, truth)))
            ok = [t for t in takes if 'score' in t]
            best = min(ok, key=lambda t: (t['score'], t['ms'])) if ok else None
            swap = bool(best and best['score'] <= cur['score'] - a.margin)
            if swap:
                dest = folder / item['file']
                shutil.copy2(dest, keep / dest.name)
                os.replace(best['file'], dest)
                items[key] = dict(file=item['file'], ms=best['ms'])
                g.atomic_json(path, data)
                swapped += 1
            log.write(json.dumps(dict(key=key, swapped=swap, before=dict(ms=item['ms'], **cur),
                                      takes=[{k: v for k, v in t.items() if k != 'file'} for t in takes]),
                                 ensure_ascii=False) + '\n')
            log.flush()
            for t in ok:
                Path(t['file']).unlink(missing_ok=True)
            print(f'{i}/{len(want)} {key} {cur["score"]:.2f} -> {best["score"] if best else "-"} '
                  f'{"SWAP" if swap else "keep"} ({time.monotonic() - start:.0f}s, swapped {swapped})', flush=True)
    print(f'done: {swapped} of {len(want)} clips replaced by a better take')


if __name__ == '__main__':
    main()
