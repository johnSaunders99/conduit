import {restoredFocus} from '../lib/model';
import type { Snapshot } from './index';
const fail = (): never => {
  throw Error('備份格式不符，原有數據未更動。');
};
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown): x is string => typeof x === 'string';
const strings = (x: unknown) => Array.isArray(x) && x.every(str);
const num = (x: unknown, lo = 0, hi = Infinity) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const int = (x: unknown, lo: number, hi = Infinity) => num(x, lo, hi) && Number.isInteger(x);
const one = (x: unknown, choices: string) => str(x) && choices.split('|').includes(x);
const date = (x: unknown) => str(x) && Number.isFinite(Date.parse(x));
const day = (x: unknown) => str(x) && /^\d{4}-\d{2}-\d{2}$/.test(x) && date(x);
const budget = (x: unknown) => obj(x) && one(x.mode, 'time|count') && int(x.value, 1);
const fmt='flashcard|quiz|interview|hands-on|sql|mixed';
const slug=(s:unknown)=>str(s)&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const choice=(x:Record<string,unknown>)=>one(x.format,fmt)&&one(x.scope,'due|yesterday|tracks|weak')&&Array.isArray(x.tracks)&&x.tracks.every(slug);
const tomorrow = (x: unknown) => x === undefined || obj(x) && choice(x) && day(x.day) && (x.budget === undefined || budget(x.budget));
const bool = (x: unknown) => typeof x === 'boolean';
const voice = (x:unknown) => x===undefined || obj(x)&&one(x.engine,'pack|system|off')&&str(x.systemVoice)&&num(x.speed,.8,1.6)&&int(x.dim,0,100)&&[60,90,120].some(n=>n===x.interviewSeconds)&&['autoReview','highlight','english','pauseCode','sectioned','sounds','focusTimer'].every(k=>bool(x[k]));
const keys = {
  sqlDrafts:'key',sqlAttempts:'id',
  settings: 'id',
  lessonProgress: 'lessonId',
  cards: 'conceptId',
  reviewLogs: 'id',
  dayPlans: 'day',
  dayStats: 'day',
  practice: 'taskId',
  projects: 'projectId',
  interviewAnswers: 'id'
};
export function validate(raw: unknown): Snapshot {
  if (!obj(raw) || raw.app !== 'conduit' || raw.schemaVersion !== 2 || !date(raw.exportedAt) || !obj(raw.data)) return fail();
  const data: Record<string, unknown[]> = {};
  for (const [n, key] of Object.entries(keys)) {
    const rows = raw.data[n];
    if (!Array.isArray(rows)) return fail();
    const seen = new Set();
    data[n] = rows.map(r => {
      if (!obj(r) || !str(r[key]) || !r[key] || seen.has(r[key])) return fail();
      seen.add(r[key]);
      let ok = false;
      switch (n) {
        case 'settings':
          ok = r.id === 'main' && choice(r) && budget(r.budget) && slug(r.focus) && int(r.hintAfter,0) && (r.role===undefined||slug(r.role)) && int(r.cap, 1) && num(r.retention, .8, .95) && int(r.dayStartHour, 0, 23) && Array.isArray(r.weights) && r.weights.length === 4 && r.weights.every(w => num(w)) && r.weights.some(w => w > 0) && one(r.theme, 'light|dark|system') && one(r.font, 'small|medium|large') && (r.headingFont===undefined || one(r.headingFont,'serif|system')) && one(r.width, 'narrow|standard|wide') && [r.onboarded, r.quizSchedule, r.reduceMotion].every(bool) && date(r.modifiedAt) && tomorrow(r.nextReview) && voice(r.voice);
          break;
        case 'cards':
          {
            const c = r.card;
            if (!obj(c) || !str(r.lessonId) || !slug(r.trackId) || !day(r.firstLearnedDay) || !bool(r.suspended) || !int(c.state, 0, 3) || !['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses'].every(k => num(c[k]))) return fail();
            const asDate = (v: unknown) => v instanceof Date && Number.isFinite(+v) ? new Date(v) : date(v) ? new Date(String(v)) : fail();
            return {
              ...r,
              card: {
                ...c,
                due: asDate(c.due),
                ...(c.last_review != null ? {
                  last_review: asDate(c.last_review)
                } : {})
              }
            };
          }
        case 'lessonProgress':
          ok = one(r.status, 'started|done|skipped') && date(r.startedAt) && num(r.scrollY) && obj(r.quizResult) && Object.values(r.quizResult).every(bool) && (!r.completedAt || date(r.completedAt));
          break;
        case 'dayPlans':
          ok = day(r.day) && budget(r.budget) && choice(r) && slug(r.focus) && [r.items, r.reviewIds, r.reviewDone].every(strings) && date(r.createdAt) && (!r.closedAt || date(r.closedAt)) && tomorrow(r.nextReview) && voice(r.voice);
          break;
        case 'dayStats':
          ok = day(r.day) && num(r.activeMinutes) && int(r.lessonsDone, 0) && int(r.reviewsDone, 0);
          break;
        case 'reviewLogs':
          ok = day(r.day) && date(r.ts) && str(r.conceptId) && one(r.format, fmt) && int(r.rating, 1, 4) && num(r.elapsedMs) && (r.relearning===undefined||typeof r.relearning==='boolean');
          break;
        case 'sqlDrafts':
          ok=(slug(r.key)||str(r.key)&&r.key.startsWith('free:')&&slug(r.key.slice(5)))&&str(r.text)&&date(r.updatedAt)&&
            (r.history===undefined||str(r.key)&&r.key.startsWith('free:')&&Array.isArray(r.history)&&strings(r.history)&&r.history.length<=20);break;
        case 'sqlAttempts':
          ok=slug(r.exerciseId)&&day(r.day)&&date(r.ts)&&str(r.sql)&&[r.passed,r.usedHint,r.viewedSolution].every(bool)&&int(r.checks,1)&&num(r.ms)&&one(r.source,'lesson|review|playground');break;
        case 'practice':
          ok = Array.isArray(r.status) && r.status.every(bool) && str(r.notes);
          break;
        case 'projects':
          ok = strings(r.done) && str(r.repoUrl) && str(r.notes);
          break;
        case 'interviewAnswers':
          ok = date(r.ts) && str(r.questionId) && str(r.text) && num(r.coverage, 0, 1);
          break;
      }
      if(!ok)return fail();
      if(n==='dayPlans'||n==='settings'){const {ratio,...clean}=r;return {...clean,focus:restoredFocus(String(r.focus))}}
      return r;
    });
  }
  return {
    ...raw,
    data
  } as unknown as Snapshot;
}
