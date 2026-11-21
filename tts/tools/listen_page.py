"""Build samples/listen.html: a local audition page of representative clips (director, 2026-11-22).
Open the file directly in Chrome/Edge (file://). Clips play from ../audio/<voice>/."""
import html
import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from generate import ROOT, read_json  # noqa: E402

VOICE = 'taimecs'
voice_dir = ROOT / 'audio' / VOICE
items = read_json(voice_dir / 'manifest.json')['items']
rows = [json.loads(x) for x in open(ROOT / 'work/segments.jsonl', encoding='utf-8') if x.strip()]
have = [r for r in rows if r['key'] in items]
rnd = random.Random(7)
qa = {}
qa_path = ROOT / 'work/qa-full.jsonl'
if qa_path.exists():
    qa = {x['key']: x for x in (json.loads(l) for l in open(qa_path, encoding='utf-8'))}
zero = set((ROOT / 'work/zero-fix.keys').read_text(encoding='utf-8').split()) if (ROOT / 'work/zero-fix.keys').exists() else set()


def pick(pred, n):
    xs = [r for r in have if pred(r)]
    return rnd.sample(xs, min(n, len(xs)))


LATIN = re.compile(r'[A-Za-z]{3,}')
groups = [
    ('一般講課', '課文裡的長句，聽整體語氣、速度和停頓。',
     pick(lambda r: r['kind'] == 'sentence' and r.get('pathOrder', 99) <= 3 and len(r['speak']) > 40, 6)),
    ('數字與日期（已修正「〇」）', '這批之前會把「〇」吞掉，已改用「零」重新生成；聽數字是否完整。',
     pick(lambda r: r['key'] in zero and '〇' in r['speak'], 6)),
    ('英文術語混讀', 'SQL、Spark、Kafka 等英文詞夾在中文句子裡。',
     pick(lambda r: r['kind'] == 'sentence' and LATIN.search(r['speak']) and len(r['speak']) < 60, 5)),
    ('SQL 題目', '欄位名稱很多的題目，最難念；畫面上一定有文字可對照。',
     pick(lambda r: r['kind'] == 'sql-prompt', 4)),
    ('面試問題（較慢、正式）', '模擬面試時面試官的提問。',
     pick(lambda r: r.get('emotion') == 'ask', 5)),
    ('閃卡答案與選項', '短句，聽清晰度。',
     pick(lambda r: r['kind'] in ('answer', 'option'), 5)),
    ('語音辨識有疑問的句子', '自動檢查覺得可能念錯的句子（多半是辨識器聽錯同音字）。請聽聽看是否真的念錯。',
     [r for r in have if qa.get(r['key'], {}).get('flag') == 'garbled' and r['kind'] in ('heading', 'option', 'sentence')][:8]),
]
skipped = []
sk_path = voice_dir / 'skipped.jsonl'
if sk_path.exists():
    keys = {json.loads(l)['key'] for l in open(sk_path, encoding='utf-8') if l.strip()}
    skipped = [r['speak'] for r in rows if r['key'] in keys]

HAN = re.compile(r'[一-鿿]')


def keyset(name):
    path = ROOT / 'work' / name
    return set(path.read_text(encoding='utf-8').split()) if path.exists() else set()


def old_manifest(name):
    path = voice_dir / name
    return read_json(path)['items'] if path.exists() else {}


def ab_section(title, note, olds, n_top=4, n_rand=4):
    """olds: key -> (old ms, old file path relative to the voice folder, sort weight)."""
    rs = [r for r in have if r['key'] in olds and HAN.search(r['speak']) and (voice_dir / olds[r['key']][1]).exists()]
    rs.sort(key=lambda r: olds[r['key']][2])
    rs = rs[:n_top] + rnd.sample(rs[n_top:], min(n_rand, len(rs[n_top:])))
    if not rs:
        return ''
    cards = []
    for r in rs:
        old_ms, old_file, _ = olds[r['key']]
        new = items[r['key']]
        cards.append(f'''<li><div class="meta">{html.escape(r.get("lessonId", ""))} · {html.escape(r["kind"])} · 修正前 {old_ms / 1000:.1f} 秒 → 修正後 {new["ms"] / 1000:.1f} 秒</div>
<div class="text">{html.escape(r["speak"])}</div>
<div class="ab"><span>修正前</span><audio controls preload="none" src="../audio/{VOICE}/{old_file}"></audio>
<span>修正後</span><audio controls preload="none" src="../audio/{VOICE}/{new["file"]}"></audio></div></li>''')
    return f'<section><h2>{html.escape(title)}</h2><p class="note">{html.escape(note)}</p><ol>{"".join(cards)}</ol></section>'


parts = []
caps, old_caps = keyset('caps-fix.keys'), old_manifest('manifest.before-caps-fix.json')
parts.append(ab_section(
    '英文詞修正前後對照',
    '之前生成模型的英文前端會把全大寫的字（ORDER BY、COALESCE、ROWS BETWEEN…）一個字母一個字母拼出來，所以很長很慢。'
    '「SQL」本身沒有拖長（「我們用 SQL 查詢」2.2 秒，「我們用資料庫查詢」2.1 秒）。'
    f'現在 SQL 關鍵字改用一般單字念法，縮寫（SQL、CTE、API…）仍逐字母念；共重新生成 {len(caps):,} 句。',
    {k: (old_caps[k]['ms'], '_replaced_caps/' + Path(old_caps[k]['file']).name, items[k]['ms'] - old_caps[k]['ms'])
     for k in caps if k in old_caps and k in items}))
symbols, old_sym = keyset('symbol-fix.keys'), old_manifest('manifest.before-symbol-fix.json')
parts.append(ab_section(
    '運算符號修正前後對照',
    '中文句子裡單獨出現的符號，生成模型會直接略過：「price > 四十五 and price < 六十」被念成「price 四十五 and price 六十」，'
    f'「select * from」的星號也不見了。現在念成「大於」「小於」「星號」「斜線」等；共重新生成 {len(symbols):,} 句。',
    {k: (old_sym[k]['ms'], f'_replaced_symbols/{k}.ogg', rnd.random()) for k in symbols if k in old_sym and k in items},
    n_top=0, n_rand=8))
retake_path = ROOT / 'work/retake.jsonl'
swapped = [json.loads(l) for l in open(retake_path, encoding='utf-8') if l.strip()] if retake_path.exists() else []
swapped = {x['key']: x for x in swapped if x['swapped']}
parts.append(ab_section(
    '重錄較清楚的版本',
    f'自動檢查覺得可能念錯的句子，各多錄三個版本，由語音辨識挑最清楚的；{len(swapped)} 句換成了新版本。',
    {k: (x['before']['ms'], f'_replaced_retake/{k}.ogg',
         min((t['score'] for t in x['takes'] if 'score' in t), default=0) - x['before']['score'])
     for k, x in swapped.items() if k in items}))
for title, note, rs in groups:
    if not rs:
        continue
    cards = []
    for r in rs:
        if title.startswith('語音辨識') and r['key'] in swapped:
            continue  # already replaced by a clearer take; its old ASR transcript no longer applies
        it = items[r['key']]
        heard = qa.get(r['key'], {}).get('heard')
        extra = f'<div class="heard">辨識器聽到：{html.escape(heard)}</div>' if heard and title.startswith('語音辨識') else ''
        cards.append(f'''<li><div class="meta">{html.escape(r.get("lessonId", ""))} · {html.escape(r["kind"])} · {it["ms"] / 1000:.1f} 秒</div>
<div class="text">{html.escape(r["speak"])}</div>{extra}
<audio controls preload="none" src="../audio/{VOICE}/{it["file"]}"></audio></li>''')
    parts.append(f'<section><h2>{html.escape(title)}</h2><p class="note">{html.escape(note)}</p><ol>{"".join(cards)}</ol></section>')

total = sum(1 for r in rows if r['key'] in items)
page = f'''<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>渠成朗讀試聽</title><style>
:root{{--bg:#F3F5F7;--surface:#fff;--text:#16202A;--text2:#4F5B67;--brand:#1D5C8F;--border:#DFE4E9}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0F1419;--surface:#161C23;--text:#E4E8EC;--text2:#A2ACB6;--brand:#5BA8E0;--border:#28313B}}}}
body{{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 "Segoe UI","Microsoft JhengHei",sans-serif}}
main{{max-width:820px;margin:0 auto;padding:32px 16px 64px}} h1{{margin:0 0 4px}} h2{{margin:32px 0 4px;color:var(--brand)}}
.lead,.note{{color:var(--text2)}} ol{{padding:0;list-style:none}} li{{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin:10px 0}}
.ab{{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center}} .ab span{{font-size:13px;color:var(--text2)}}
.meta{{font-size:12px;color:var(--text2)}} .text{{margin:4px 0 8px}} .heard{{font-size:13px;color:var(--text2);margin:-4px 0 8px}} audio{{width:100%}}
</style></head><body><main>
<h1>渠成朗讀試聽</h1>
<p class="lead">聲線：臺灣華語男聲（TaiMECS 暫用參考錄音 + GPT-SoVITS v2Pro）。已生成 {total:,} 句。
聽的時候留意：聲音好不好聽、速度、停頓、多音字（行、重、長、調）、數字、英文術語。覺得哪裡不好，直接告訴 Claude（例如「再快一點」「SQL 題不要念欄位名」）。</p>
{"".join(parts)}
<section><h2>改用系統聲線的短句</h2><p class="note">下列太短，生成模型念不出來，App 會改用 Windows 男聲 Zhiwei：{html.escape("、".join(skipped))}</p></section>
</main></body></html>'''
out = ROOT / 'samples/listen.html'
out.write_text(page, encoding='utf-8')
print(out, sum(len(g[2]) for g in groups), 'clips')
