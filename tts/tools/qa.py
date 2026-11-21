"""Offline CER on the recorded sample keys only; never uses a model identifier or cloud API."""
import argparse
from collections import defaultdict
import difflib
import json
import os
import re
import time
import unicodedata

import numpy as np
from opencc import OpenCC

from generate import ROOT, read_json, run_media
from samples import CATEGORY, CHECKS, SAMPLES, read_lines

MODEL = ROOT/'models/paraformer-zh'
VOICE = ROOT/'audio/taimecs'
HANS = OpenCC('t2s')


def normalise(text):
    x = unicodedata.normalize('NFKC', HANS.convert(text)).casefold()
    return ''.join(c for c in x if c.isalnum())


def edits(a,b):
    cost = list(range(len(b) + 1))
    for i,x in enumerate(a,1):
        nxt = [i]
        for j,y in enumerate(b,1):
            nxt.append(min(cost[j] + 1, nxt[-1] + 1, cost[j-1] + (x!=y)))
        cost = nxt
    return cost[-1]


def possible_causes(row, truth, got):
    changed = ''.join(truth[a:b]+got[c:d] for tag,a,b,c,d in
                      difflib.SequenceMatcher(None,truth,got,autojunk=False).get_opcodes() if tag!='equal')
    flags = []
    if re.search('[a-z]',changed):
        flags.append('英語術語／字母')
    if re.search(r'[0-9零一二两三四五六七八九十百千万亿]',changed):
        flags.append('數字或數字文字化')
    if any(p['text'] in row['speak'] and any(c in changed for c in normalise(p['text']))
           for p in row.get('polyphones', [])):
        flags.append('多音詞附近')
    if '路徑' in row['sampleNotes']:
        flags.append('路徑斷詞')
    return '、'.join(flags) if flags else 'ASR／合成差異，待聽辨'


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--follow",type=int,default=0,help="seconds to wait for the bounded sample manifest")
    args=parser.parse_args()
    for name in ('model_quant.onnx','config.yaml','am.mvn','tokens.json'):
        if not (MODEL/name).is_file():
            raise FileNotFoundError(f'Missing local model data: {MODEL/name}')
    from funasr_onnx import Paraformer
    engine = Paraformer(str(MODEL), batch_size=1, quantize=True, device_id='-1', intra_op_num_threads=2 if args.follow else 4)
    manifest_path=VOICE/'manifest.json'
    rows=read_lines(SAMPLES/'segments.jsonl')
    results=[]
    seen=set()
    deadline=time.monotonic()+args.follow
    while True:
        items=read_json(manifest_path)['items'] if manifest_path.exists() else {}
        for row in rows:
            if row['key'] in seen or not (item := items.get(row['key'])):
                continue
            raw = run_media('ffmpeg', ['-v','error','-nostdin','-i',str(VOICE/item['file']),
                                      '-f','f32le','-ac','1','-ar','16000','pipe:1']).stdout
            output, = engine(np.frombuffer(raw,dtype='<f4'))
            heard = output['preds']
            if isinstance(heard,(list,tuple)):
                heard = heard[0]
            if not isinstance(heard,str):
                raise TypeError(f'Unexpected local ASR output {type(heard)}')
            truth, got = normalise(row['speak']), normalise(heard)
            n_edits = edits(truth,got)
            result = dict(key=row['key'], category=row['sampleCategory'], reference=row['speak'],
                          hypothesis=heard, reference_chars=len(truth), edits=n_edits,
                          cer=n_edits/max(1,len(truth)), suspicion=possible_causes(row,truth,got) if n_edits else '')
            results.append(result)
            seen.add(row['key'])
            print(row['key'],f'{len(results)}/120',flush=True)
        if len(seen)==len(rows) or time.monotonic()>=deadline:
            break
        time.sleep(2)
    if not results:
        raise ValueError('No sample audio to score')
    (SAMPLES/'asr-results.jsonl').write_text(''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in results),
                                             encoding='utf-8')
    totals = defaultdict(lambda: [0,0,0])
    for row in results:
        bucket=totals[row['category']]
        bucket[0] += 1
        bucket[1] += row['edits']
        bucket[2] += row['reference_chars']
    lines=['# 120 句｜本機 ASR 交叉檢查','',
           '官方 Paraformer-zh INT8、CPU ONNX。比對前統一繁簡／英文字母大小寫，忽略空格及標點，保留數字及字母；「2026」和「二千零二十六」不視為等價。CER 為加總編輯距離除以參考字元數。',
           '這是 ASR 與台詞的差異，不是已證實的誤讀。ASR 對專名、臺灣口音和英中切換也可能誤辨；相同漢字的多音讀法無法靠 CER 判定。','',
           '| 類別 | 測得句數 | 編輯數／字元數 | CER |','| --- | ---: | ---: | ---: |']
    for cat,label in CATEGORY.items():
        n,e,r=totals[cat]
        lines.append(f'| {label} | {n}/30 | {e}/{r} | {e/r:.1%} |' if r else f'| {label} | 0/30 | — | — |')
    n=sum(x[0] for x in totals.values()); err=sum(x[1] for x in totals.values()); chars=sum(x[2] for x in totals.values())
    lines.append(f'| 全部 | {n}/120 | {err}/{chars} | {err/chars:.1%} |')
    lines.extend(['','## 差異最大的十句（待聽辨）',''])
    for row in sorted(results,key=lambda x:(x['cer'],x['edits']),reverse=True)[:10]:
        lines.append(f"- `{row['key']}`・{CATEGORY[row['category']]}・{row['cer']:.1%}・{row['suspicion']}："
                     f"「{row['reference']}」→「{row['hypothesis']}」")
    (SAMPLES/'asr-qa.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')


if __name__ == '__main__':
    os.environ['HF_HUB_OFFLINE']='1'
    os.environ['TRANSFORMERS_OFFLINE']='1'
    main()
