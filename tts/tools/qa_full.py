"""Offline ASR screen of generated clips (director, 2026-11-22).

Samples clips from a voice manifest, transcribes them locally with Paraformer-zh (CPU),
and flags likely synthesis faults: dropped words (recognised Han text much shorter than the
script), repeats (much longer), or garbling (high Han-only CER). English terms are excluded
from the score because the Mainland ASR mishears them regardless of synthesis quality.
Writes work/qa-full.jsonl (one row per clip) and prints a summary.
"""
import argparse
import json
import random
import re
import sys
import time

import numpy as np

sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from generate import ROOT, read_json, run_media, engine_text  # noqa: E402
from qa import normalise, edits, MODEL  # noqa: E402

HAN = re.compile(r'[㐀-鿿]')


def han_only(text):
    return ''.join(HAN.findall(normalise(text)))


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--voice', default='taimecs')
    p.add_argument('--input', default=str(ROOT / 'work/segments.jsonl'))
    p.add_argument('--sample', type=int, default=1500)
    p.add_argument('--keys', help='file with keys to check instead of a random sample')
    p.add_argument('--seed', type=int, default=20261122)
    p.add_argument('--out', default=str(ROOT / 'work/qa-full.jsonl'))
    a = p.parse_args()
    voice = ROOT / 'audio' / a.voice
    items = read_json(voice / 'manifest.json')['items']
    rows = [json.loads(x) for x in open(a.input, encoding='utf-8') if x.strip()]
    rows = [r for r in rows if r['key'] in items and len(han_only(engine_text(r['speak']))) >= 6]
    if a.keys:
        want = {x.strip() for x in open(a.keys, encoding='utf-8') if x.strip()}
        rows = [r for r in rows if r['key'] in want]
    else:
        by_kind = {}
        for r in rows:
            by_kind.setdefault(r.get('kind', '?'), []).append(r)
        rnd = random.Random(a.seed)
        picked = []
        for kind, xs in sorted(by_kind.items()):
            n = max(20, round(a.sample * len(xs) / len(rows)))
            picked += rnd.sample(xs, min(n, len(xs)))
        rows = picked
    from funasr_onnx import Paraformer
    engine = Paraformer(str(MODEL), batch_size=1, quantize=True, device_id='-1', intra_op_num_threads=4)
    start = time.monotonic()
    with open(a.out, 'w', encoding='utf-8') as out:
        for i, r in enumerate(rows, 1):
            item = items[r['key']]
            raw = run_media('ffmpeg', ['-v', 'error', '-nostdin', '-i', str(voice / item['file']),
                                       '-f', 'f32le', '-ac', '1', '-ar', '16000', 'pipe:1']).stdout
            res, = engine(np.frombuffer(raw, dtype='<f4'))
            heard = res['preds'][0] if isinstance(res['preds'], (list, tuple)) else res['preds']
            truth, got = han_only(engine_text(r['speak'])), han_only(heard)
            cer = edits(truth, got) / len(truth)
            ratio = len(got) / len(truth)
            flag = ('dropped' if ratio < 0.7 else 'repeated' if ratio > 1.4 else
                    'garbled' if cer > 0.35 else '')
            out.write(json.dumps(dict(key=r['key'], kind=r.get('kind'), lessonId=r.get('lessonId'),
                                      ms=item['ms'], cer=round(cer, 3), ratio=round(ratio, 2), flag=flag,
                                      speak=r['speak'], heard=heard), ensure_ascii=False) + '\n')
            if i % 100 == 0:
                print(f'{i}/{len(rows)} checked, {time.monotonic() - start:.0f}s', flush=True)
    res = [json.loads(x) for x in open(a.out, encoding='utf-8')]
    flagged = [x for x in res if x['flag']]
    total_edits = sum(x['cer'] * len(han_only(engine_text(x['speak']))) for x in res)
    total_chars = sum(len(han_only(engine_text(x['speak']))) for x in res)
    counts = ', '.join('%s %d' % (k, sum(1 for x in flagged if x['flag'] == k))
                       for k in ('dropped', 'repeated', 'garbled'))
    print(f'checked {len(res)} clips; Han-only CER {total_edits / total_chars:.3f}; '
          f'flagged {len(flagged)} ({counts})')


if __name__ == '__main__':
    main()
