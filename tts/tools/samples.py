"""Choose app-keyed QA rows and regenerate the sample index from the real manifest."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CONTENT = Path(r'E:\ClaudeProjects\conduit\public\content')
SAMPLES = ROOT / 'samples'
CATEGORY = {'lesson': '課程', 'flashcard': '閃卡', 'interview': '面試', 'sql': 'SQL 手寫'}
CHECKS = {
    '行': re.compile(r'一行|每行|每一行|幾行|行列|排序行|銀行|執行|同行'),
    '列': re.compile(r'列'),
    '重送': re.compile(r'重送'),
    '調度': re.compile(r'調度'),
    '長': re.compile(r'長'),
    'SQL': re.compile(r'\bS\s*Q\s*L\b', re.I),
    'ORDER BY': re.compile(r'\border\s+by\b', re.I),
    'DuckDB': re.compile(r'\bDuck\s*D\s*B\b', re.I),
    'Spark': re.compile(r'\bSpark\b', re.I),
    'Kafka': re.compile(r'\bKafka\b', re.I),
    '數字': re.compile(r'[0-9]|[零一二兩三四五六七八九十百千萬億][年月天分秒筆欄行列次條個十百千萬億]|百分之'),
    '路徑': re.compile(r'[a-z]:[\\/]|(?:[a-zA-Z0-9_.-]+[\\/]){1,}[a-zA-Z0-9_.-]+|路徑'),
}


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def read_lines(path):
    return [json.loads(x) for x in path.read_text(encoding='utf-8-sig').splitlines() if x]


def leaves(item):
    if isinstance(item, dict):
        if 'key' in item and 'speak' in item:
            yield item
        else:
            for child in item.values():
                yield from leaves(child)
    elif isinstance(item, list):
        for child in item:
            yield from leaves(child)


def notes(row):
    return [feature for feature, expr in CHECKS.items() if expr.search(row['speak'])]


def prepare():
    rows = read_lines(ROOT / 'work/segments.jsonl')
    keys = {row['key']: row for row in rows}
    app = load(CONTENT/'index.json')
    order = app['path']['recommended']
    modules = sorted(app['modules'], key=lambda m: (order.index(m['id']) if m['id'] in order else float('inf'),
                                                    m['order'], m['id']))
    order_map = {m['id']: i for i, m in enumerate(modules,1)}
    order_map['shared'] = len(modules)+1
    lesson_to_module = {l['id']: l['module'] for l in app['lessons']}
    assert all(row['pathOrder'] == order_map[lesson_to_module[row['lessonId']] if row['lessonId'] else 'shared']
               for row in rows)
    (ROOT/'work/module-order.json').write_text(json.dumps(order_map, indent=2)+'\n', encoding='utf-8')
    cards = load(CONTENT/'speech/cards.json')
    slots = []
    def add(label, quota, candidates):
        slots.append([label, quota, candidates])
    def item(clip, origin):
        r = keys.get(clip['key'])
        if r is None or r['speak'] != clip['speak']:
            raise ValueError(f'Export does not match app segment {clip["key"]}: {origin}')
        return {**r, 'sampleOrigin': origin}
    lessons = sorted((l for l in app['lessons'] if l['module']=='sq-read' and l['status']=='ready'),
                     key=lambda l: l['order'])[:2]
    for l in lessons + [next(l for l in app['lessons'] if l['module']=='bd-spark' and l['order']==1)]:
        ident = l['id']
        speeches = leaves(load(CONTENT/'speech'/f'{ident}.json'))
        add('lesson', 10, [item(x,ident) for x in speeches if x['kind']=='sentence'])
    for name in ('prompt','answer'):
        add('flashcard', 15, [
            item(clip, ident) for ident, card in cards['concepts'].items() for clip in card.get(name, [])
        ])
    interview = load(CONTENT/'concepts.json')['interviews']
    qids = [q['id'] for group in interview for q in group['questions']]
    add('interview', 30, [item(cards['interviews'][ident]['question'][0], ident) for ident in qids
                          if cards['interviews'].get(ident,{}).get('question')])
    add('sql', 30, [item(clip, ident) for ident, value in cards['sql'].items() for clip in value['prompt']])
    chosen = []
    covered = Counter()
    used = set()
    use_by_category = Counter()
    for _ in range(sum(slot[1] for slot in slots)):
        def rank(r, category):
            features = notes(r)
            quotas = sum(13 / (1 + covered[k]*2) for k in features)
            hints = 1.8 * bool(r.get('polyphones'))
            raw_path = 6 * bool(re.search(r'[a-z]:[\\/]|(?:[a-zA-Z0-9_.-]+[\\/]){2,}[a-zA-Z0-9_.-]+', r['speak']))
            return quotas + hints + raw_path - 2*use_by_category[(category,r['sampleOrigin'])] - abs(len(r['speak'])-36)/24
        best = max(( (rank(r, category), -i, r['key'], r)
                     for i, (category, left, candidates) in enumerate(slots) if left
                     for r in candidates if r['key'] not in used and 7 <= len(r['speak']) <= 105),
                   key=lambda candidate: candidate[:3], default=None)
        if best is None:
            raise ValueError('Not enough unique suitable segments to satisfy quotas')
        _, negindex, key, r = best
        slot = slots[-negindex]
        slot[1] -= 1
        category = slot[0]
        features = notes(r)
        r = {**r, 'sampleCategory': category, 'sampleNotes': features}
        covered.update(features)
        used.add(key)
        use_by_category[(category,r['sampleOrigin'])] += 1
        chosen.append(r)
    assert covered.keys() >= CHECKS.keys(), covered
    chosen.sort(key=lambda row: (list(CATEGORY).index(row['sampleCategory']), row['pathOrder'],
                                 row['sampleOrigin'], row['key']))
    SAMPLES.mkdir(exist_ok=True)
    def write(name, entries):
        (SAMPLES/name).write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in entries), encoding='utf-8')
    write('segments.jsonl', chosen)
    smoke = [
        next(r for r in chosen if r['sampleCategory'] in ('lesson','sql','flashcard') and 'DuckDB' in r['sampleNotes'] and len(r['speak'])<=55),
        next(r for r in chosen if r['sampleCategory']=='flashcard' and '重送' in r['sampleNotes'] and len(r['speak'])<=55),
        min((r for r in chosen if r['sampleCategory']=='sql'), key=lambda r: ('ORDER BY' not in r['sampleNotes'], len(r['speak']))),
    ]
    write('smoke.jsonl', smoke)
    print(dict(covered), Counter(r['sampleCategory'] for r in chosen))


def markdown(voice):
    rows = read_lines(SAMPLES/'segments.jsonl')
    manifest = ROOT/'audio'/voice/'manifest.json'
    items = load(manifest)['items'] if manifest.exists() else {}
    available = sum(r['key'] in items for r in rows)
    lines = ['# 渠成朗讀｜120 句試聽索引','',f'聲線：`{voice}`。已寫入音檔清單：**{available}/120**。',
             '文字取自正式匯出的 `speak`，使用原有 App 鍵。標記是試聽重點，不代表已聽審。',
             '— 表示尚無可播放成品。','']
    for cat, label in CATEGORY.items():
        lines.extend([f'## {label}','', '| Key | 朗讀文字 | 檔案 | 毫秒 | 試聽重點／來源 |',
                      '| --- | --- | --- | ---: | --- |'])
        for r in (r for r in rows if r['sampleCategory']==cat):
            item = items.get(r['key'])
            text = r['speak'].replace('|','\\|').replace('\n',' ')
            marked = '、'.join(r['sampleNotes'])
            hint = '；'.join(p['text']+' '+p['pinyin'] for p in r.get('polyphones', []))
            details = '；'.join(x for x in (marked, hint, r['sampleOrigin']) if x)
            file = f"[Ogg](../audio/{voice}/{item['file']})" if item else '—'
            ms = item['ms'] if item else '—'
            lines.append(f"| `{r['key']}` | {text} | {file} | {ms} | {details} |")
        lines.append('')
    (SAMPLES/'samples.md').write_text('\n'.join(lines)+'\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action',choices=('prepare','index'))
    parser.add_argument('--voice',default='taimecs')
    args = parser.parse_args()
    if args.action=='prepare':
        prepare()
    markdown(args.voice)
