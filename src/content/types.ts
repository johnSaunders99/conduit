export type TrackId = string;
export interface Track {
  id: TrackId;
  title: string;
  prefix:string;
  career:boolean;
  short: string;
  color: string;
  summary: string;
}
export interface Module {
  skippable?:boolean;
  subtitle?: string;
  id: string;
  title: string;
  track: TrackId;
  summary: string;
  stage: number;
  order: number;
  outcomes: string[];
  prereqs: string[];
  roles: string[];
  hours: number;
  project?: string;
}
export interface Resource {
  title: string;
  url: string;
  kind: string;
  lang: string;
  minutes: number;
  required: boolean;
  checked: string;
  note?: string;
}
export interface ManualPractice {
  id: string;
  title: string;
  kind: 'hands-on'|'code'|'build'|'explain'|'read';
  minutes: number;
  steps: string[];
  checks: string[];
  solution?: string;
  solutionHtml?: string;
}
export interface SqlCheck {mode?:'state'|'result'; query?:string; ordered?:boolean; columnNames?:boolean; tolerance?:number; allowEmpty?:boolean}
export interface Exercise {
  kind:'sql'; id:string; title:string; minutes:number; level:number; dataset:string; lessonId:string; moduleId:string;
  prompt:string; promptHtml:string; explainHtml:string; solution:string; solutionCodeHtml?:string; starter?:string;
  hints:string[]; tags:string[]; category?:string[]; concepts:string[]; check:SqlCheck;
}
export interface SqlCategory {id:string; label:string; order:number; summary?:string; count:number}
export interface Dataset {id:string; title:string; summary:string; tables:{name:string;summary:string;columns:{name:string;type:string;note:string}[]}[]}
export interface Term {id:string;term:string;en:string;aliases?:string[];cn?:string;tw?:string;short:string;lesson?:string;tags:string[]}
export type Practice=ManualPractice|Exercise;
export interface Lesson {
  subtitle?: string;
  id: string;
  module: string;
  order: number;
  title: string;
  status: 'ready' | 'draft' | 'stub';
  minutes: number;
  level: number;
  objectives: string[];
  tags: string[];
  resources: Resource[];
  concepts: string[];
  practice: Practice[];
  prereqs: string[];
}
export interface Interview {
  question: string;
  points: string[];
  answer: string;
}
export interface Concept {
  id: string;
  prompt: string;
  answer: string;
  trackId: TrackId;
  lessonId: string;
  moduleId: string;
  tags: string[];
  mcq?: {
    question?: string;
    options: string[];
    answer: number;
    explain: string;
  };
  interview?: Interview;
}
export interface Question extends Interview {
  set?: {id:string; title:string};
  id: string;
  track: TrackId;
  module?: string;
  tags: string[];
  conceptId?: string;
  lesson?: string;
}
export interface Project {
  id: string;
  title: string;
  track: TrackId;
  summary: string;
  why: string;
  modules: string[];
  level: number;
  hours: number;
  milestones: {
    id: string;
    title: string;
    checks: string[];
  }[];
  stretch?: string[];
  showcase: string;
}
export interface Catalog {
  datasets:Dataset[]; exercises:Exercise[]; sqlCategories:SqlCategory[]; glossary:Term[];
  version: string;
  tracks: Track[];
  modules: Module[];
  lessons: Lesson[];
  projects: Project[];
  roles: {
    id: string;
    title: string;
    summary: string;
    skills: {
      id: string;
      title: string;
      weight: number;
      modules: string[];
    }[];
  }[];
  path: {
    recommended?: string[];
  };
  counts: Record<string, number>;
  concepts: Concept[];
  questions: Question[];
}
export interface LabNote {lesson:string;tools:string[];note:string}
export interface Body {
  id: string;
  labNote?:LabNote;
  html: string;
  outline: {
    id: string;
    text: string;
    level: number;
  }[];
}
