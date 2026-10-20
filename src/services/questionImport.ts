import type { Question, Quiz, ImageAttribution } from '../types/quiz';
import type { ImportIssue, ImportMessageKey } from '../i18n/questionImport';
import { COLOR_KEYS, SHAPE_KEYS } from '../utils/quizStyles';
import { editableVideoQuiz } from './videoQuiz';

export const IMPORT_LIMITS = { bytes: 5 * 1024 * 1024, records: 1000, columns: 64 } as const;
export const OPTION_FIELDS = Array.from({ length: 12 }, (_, i) => `option${String.fromCharCode(65 + i)}`);
export const IMPORT_FIELDS = ['text', 'type', ...OPTION_FIELDS, 'options', 'correct', 'explanation', 'points', 'timeLimit', 'mediaUrl', 'mediaType', 'id'];
export type Mapping = Record<string, string>;
export interface CsvRecord { cells: string[]; line: number }
export interface ImportSource { kind: 'csv' | 'canonical' | 'flat'; fullQuiz: boolean; records: unknown[]; columns: string[]; lines: number[] }
export interface ImportRow { index: number; line: number; question?: Question; errors: ImportIssue[]; warnings: ImportIssue[]; duplicate?: { kind: 'identical' | 'similar'; source: 'target' | 'file'; index: number } }
export interface ImportConfig { mapping: Mapping; defaultType: Question['type']; correctMode: 'letters' | 'numbers' | 'texts' }
export class QuestionImportError extends Error {
  constructor(public issue: ImportIssue) { super(issue.key); }
}
const problem = (key: ImportMessageKey, args?: ImportIssue['args']): ImportIssue => ({ key, args });
function fail(key: ImportMessageKey, args?: ImportIssue['args']): never { throw new QuestionImportError(problem(key, args)); }
const object = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export async function readQuestionFile(file: File): Promise<string> {
  if (file.size > IMPORT_LIMITS.bytes) fail('tooLarge');
  if (!/\.(csv|tsv|json)$/i.test(file.name)) fail('fileType');
  let buffer: ArrayBuffer;
  try { buffer = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = reject; reader.readAsArrayBuffer(file);
  }); } catch { return fail('readError'); }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); } catch { return fail('encoding'); }
}

/** Bounded RFC-style quoted records, retaining physical line numbers for diagnostics. */
export function parseQuestionCsv(input: string, separator: string): CsvRecord[] {
  if (input.length > IMPORT_LIMITS.bytes) fail('tooLarge');
  if (![',', ';', '\t'].includes(separator)) fail('fileType');
  const text = input.replace(/^\uFEFF/, ''), rows: CsvRecord[] = [];
  let cells: string[] = [], field = '', quoted = false, closed = false, line = 1, start = 1;
  const cell = () => { cells.push(field); field = ''; closed = false; if (cells.length > IMPORT_LIMITS.columns) fail('tooMany'); };
  const row = () => { cell(); if (cells.some(value => value.trim())) rows.push({ cells, line: start }); cells = []; if (rows.length > IMPORT_LIMITS.records + 1) fail('tooMany'); };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i++; field += '\n'; line++; }
      else field += char;
    } else if (char === separator) cell();
    else if (char === '\n' || char === '\r') { row(); if (char === '\r' && text[i + 1] === '\n') i++; line++; start = line; }
    else if (char === '"') { if (field || closed) fail('csvQuote', { line }); quoted = true; }
    else { if (closed && !/[ \t]/.test(char)) fail('csvQuote', { line }); if (!closed) field += char; }
  }
  if (quoted) fail('csvQuote', { line: start });
  if (field || cells.length || closed) row();
  return rows;
}

export function detectQuestionSeparator(text: string): string {
  const scores = [',', ';', '\t'].map(separator => {
    try { const rows = parseQuestionCsv(text, separator).slice(0, 10); const widths = rows.map(row => row.cells.length); const width = widths[0] || 0;
      return { separator, score: width > 1 ? widths.filter(n => n === width).length * 100 + width : 0 };
    } catch { return { separator, score: -1 }; }
  });
  return scores.sort((a, b) => b.score - a.score)[0].separator;
}

export function csvImportSource(text: string, separator: string, header: boolean): ImportSource {
  const rows = parseQuestionCsv(text, separator), first = rows[0];
  if (!first) fail('empty');
  const data = header ? rows.slice(1) : rows;
  if (!data.length) fail('empty');
  if (data.length > IMPORT_LIMITS.records) fail('tooMany');
  // Keys are column positions, so duplicate headings remain separately mappable.
  return { kind: 'csv', fullQuiz: false, records: data.map(row => row.cells), columns: first.cells, lines: data.map(row => row.line) };
}

export function jsonImportSource(text: string): ImportSource {
  if (text.length > IMPORT_LIMITS.bytes) fail('tooLarge');
  if (!text.trim()) fail('empty');
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { return fail('jsonSyntax'); }
  const fullQuiz = object(parsed) && typeof parsed.title === 'string' && object(parsed.settings) && Array.isArray(parsed.questions);
  const records = Array.isArray(parsed) ? parsed : object(parsed) && Array.isArray(parsed.questions) ? parsed.questions : null;
  if (!records) fail('jsonStructure');
  if (!records.length) fail('empty');
  if (records.length > IMPORT_LIMITS.records) fail('tooMany');
  const canonical = fullQuiz || records.some(record => object(record) && Array.isArray(record.options) && record.options.every(option => object(option)));
  if (!canonical && !records.every(record => object(record) && Object.values(record).every(value => value === null || ['string', 'number', 'boolean'].includes(typeof value) || Array.isArray(value) && value.every(item => typeof item === 'string')))) fail('jsonStructure');
  const columns = canonical ? [] : [...new Set(records.flatMap(record => Object.keys(record)))];
  if (columns.length > IMPORT_LIMITS.columns) fail('tooMany');
  if (columns.some(column => column.length > 200)) fail('jsonStructure');
  return { kind: canonical ? 'canonical' : 'flat', fullQuiz, records, columns, lines: records.map((_, i) => i + 1) };
}

export function suggestQuestionMapping(columns: string[], csv = true): Mapping {
  const aliases: Record<string, string[]> = {
    text: ['text', 'question', 'domanda', 'testodomanda'], type: ['type', 'tipo'], correct: ['correct', 'correctanswer', 'rispostacorretta', 'corretta'],
    explanation: ['explanation', 'spiegazione'], points: ['points', 'punti'], timeLimit: ['timelimit', 'time', 'tempo', 'secondi'], mediaUrl: ['mediaurl'], mediaType: ['mediatype','tipomedia'], id: ['id'], options: ['options', 'risposte'],
  };
  OPTION_FIELDS.forEach((field, i) => { const letter = String.fromCharCode(65 + i).toLowerCase(); aliases[field] = [`option${letter}`, `risposta${letter}`, `risposta${i + 1}`, `option${i + 1}`]; });
  const result: Mapping = {};
  columns.forEach((column, i) => {
    const normalized = column.normalize('NFKC').toLowerCase().replace(/[\s_-]/g, '');
    const field = Object.keys(aliases).find(key => aliases[key].includes(normalized));
    if (field && result[field] === undefined && !(csv && field === 'options')) result[field] = csv ? String(i) : column;
  });
  return result;
}

function textValue(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail('invalidText', { field, max });
  return value.trim();
}
function numeric(value: unknown, field: string, min: number, max: number, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  if ((typeof value !== 'string' && typeof value !== 'number') || typeof value === 'string' && !/^\d+(?:[.,]\d+)?$/.test(value.trim())) fail('numberRange', { field, min, max });
  const number = typeof value === 'number' ? value : Number(value.trim().replace(',', '.'));
  if (!Number.isFinite(number) || number < min || number > max) fail('numberRange', { field, min, max });
  return number;
}
const httpUrl = (value: string) => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } };
function validateQuestion(raw: Record<string, any>, config: ImportConfig, canonical: boolean, warnings: ImportIssue[]): Question {
  const text = textValue(raw.text, 'text', 20000);
  const types: Record<string, Question['type']> = { multiple_choice: 'multiple_choice', 'multiple choice': 'multiple_choice', scelta_multipla: 'multiple_choice', 'scelta multipla': 'multiple_choice', true_false: 'true_false', 'true/false': 'true_false', 'vero/falso': 'true_false', vero_falso: 'true_false' };
  const inputType = !canonical && (raw.type === undefined || raw.type === '') ? config.defaultType : raw.type;
  const type = typeof inputType === 'string' ? types[inputType.trim().toLowerCase()] : undefined;
  if (!type) fail('invalidType', { value: String(inputType).slice(0, 100) });
  const checkCount = (actual: number) => { if (type === 'true_false' ? actual !== 2 : actual < 2 || actual > 12) fail('optionCount', { count: type === 'true_false' ? '2' : '2–12', actual }); };
  let options: Question['options'];
  if (canonical) {
    if (!Array.isArray(raw.options)) fail('optionType');
    checkCount(raw.options.length);
    options = raw.options.map((option: unknown, i: number) => {
      if (!object(option) || typeof option.isCorrect !== 'boolean') fail('optionType');
      if (option.id !== undefined && typeof option.id !== 'string') fail('optionalType', { field: 'options.id' });
      if (option.color !== undefined && !COLOR_KEYS.includes(option.color) || option.shape !== undefined && !SHAPE_KEYS.includes(option.shape)) fail('styling');
      return { id: option.id ?? `source-option-${i}`, text: textValue(option.text, `option${String.fromCharCode(65 + i)}`, 10000), isCorrect: option.isCorrect, color: option.color ?? COLOR_KEYS[i % 6], shape: option.shape ?? SHAPE_KEYS[i % 6] };
    });
  } else {
    let values: unknown[];
    if (raw.options !== undefined && raw.options !== '') { if (!Array.isArray(raw.options) || !raw.options.every(value => typeof value === 'string')) fail('optionType'); values = raw.options; }
    else {
      let last = OPTION_FIELDS.length - 1;
      while (last >= 0 && (raw[OPTION_FIELDS[last]] === undefined || raw[OPTION_FIELDS[last]] === '')) last--;
      values = OPTION_FIELDS.slice(0, last + 1).map(field => raw[field]);
    }
    checkCount(values.length);
    options = values.map((value, i) => ({ id: `source-option-${i}`, text: textValue(value, `option${String.fromCharCode(65 + i)}`, 10000), isCorrect: false, color: COLOR_KEYS[i % 6], shape: SHAPE_KEYS[i % 6] }));
    if (typeof raw.correct !== 'string' && typeof raw.correct !== 'number') fail('correctMissing');
    const correct = String(raw.correct).trim();
    if (!correct) fail('correctMissing');
    if (config.correctMode === 'texts') {
      const matches = options.map((option, i) => option.text === correct ? i : -1).filter(i => i >= 0);
      if (matches.length !== 1) fail('correctAmbiguous'); options[matches[0]].isCorrect = true;
    } else for (const token of correct.split('|').map(part => part.trim())) {
      const index = config.correctMode === 'letters' && /^[A-L]$/i.test(token) ? token.toUpperCase().charCodeAt(0) - 65 : config.correctMode === 'numbers' && /^\d+$/.test(token) ? Number(token) - 1 : -1;
      if (index < 0 || index >= options.length) fail('correctReference', { value: token.slice(0, 100), count: options.length });
      options[index].isCorrect = true;
    }
  }
  if (type === 'true_false' ? options.length !== 2 : options.length < 2 || options.length > 12) fail('optionCount', { count: type === 'true_false' ? '2' : '2–12', actual: options.length });
  if (new Set(options.map(option => option.id)).size !== options.length) fail('optionIds');
  const correct = options.filter(option => option.isCorrect).length;
  if (!correct || type === 'true_false' && correct !== 1) fail('correctMissing');
  if (raw.id !== undefined && typeof raw.id !== 'string') fail('optionalType', { field: 'id' });
  const question: Question = { id: raw.id || '', text, type, options, points: numeric(raw.points, 'points', 0, 1000000, 1000), timeLimit: numeric(raw.timeLimit, 'timeLimit', 0.001, 86400, 20) };
  if (raw.explanation !== undefined && raw.explanation !== '') {
    if (typeof raw.explanation !== 'string' || raw.explanation.length > 20000) fail('optionalType', { field: 'explanation' }); question.explanation = raw.explanation;
  }
  if (raw.mediaAssetId !== undefined && raw.mediaAssetId !== '' || raw.videoAssetId !== undefined && raw.videoAssetId !== '') fail('asset');
  if (raw.mediaType !== undefined && raw.mediaType !== '' && !['image', 'video'].includes(raw.mediaType)) fail('optionalType', { field: 'mediaType' });
  if (raw.mediaUrl !== undefined && raw.mediaUrl !== '') {
    if (typeof raw.mediaUrl !== 'string' || raw.mediaUrl.length > 2 * 1024 ** 2) fail('asset');
    const embedded = /^data:(image\/(png|jpeg|webp|gif)|video\/(mp4|webm));base64,[A-Za-z0-9+/]+={0,2}$/.test(raw.mediaUrl);
    if (!embedded && !httpUrl(raw.mediaUrl)) fail('asset');
    if (!embedded) warnings.push(problem('externalAsset'));
    question.mediaUrl = raw.mediaUrl; question.mediaType = raw.mediaType || (raw.mediaUrl.startsWith('data:video/') ? 'video' : 'image');
  }
  if (raw.mediaAttribution !== undefined) {
    const credits = raw.mediaAttribution;
    if (!object(credits) || !['title', 'creator', 'license', 'sourceUrl'].every(key => typeof credits[key] === 'string' && credits[key].trim()) || !httpUrl(credits.sourceUrl) || credits.licenseUrl !== undefined && (typeof credits.licenseUrl !== 'string' || !httpUrl(credits.licenseUrl))) fail('attribution');
    question.mediaAttribution = Object.fromEntries(['title', 'creator', 'license', 'sourceUrl', 'licenseUrl'].filter(key => credits[key] !== undefined).map(key => [key, credits[key]])) as unknown as ImageAttribution;
  }
  return question;
}

const normalize = (text: string) => text.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
const promptKey = (q: Question) => `${q.type}:${normalize(q.text)}`;
const contentKey = (q: Question) => JSON.stringify([promptKey(q), q.options.map(o => [normalize(o.text), o.isCorrect]).sort(), q.points, q.timeLimit, normalize(q.explanation || ''), q.mediaUrl || '', q.mediaType || '', q.mediaAttribution || null]);

export function previewQuestionImport(source: ImportSource, config: ImportConfig, target: Question[] = []): ImportRow[] {
  const columns = Object.values(config.mapping).filter(value => value !== '');
  if (source.kind !== 'canonical') {
    if (!config.mapping.text || !config.mapping.correct || !(config.mapping.options || OPTION_FIELDS.filter(field => config.mapping[field]).length >= 2)) fail('fieldRequired');
    if (new Set(columns).size !== columns.length) fail('repeatedColumn');
  }
  const exact = new Map<string, { source: 'target' | 'file'; index: number }>(), prompts = new Map<string, { source: 'target' | 'file'; index: number }>(), ids = new Set<string>();
  target.forEach((q, index) => { exact.set(contentKey(q), { source: 'target', index }); prompts.set(promptKey(q), { source: 'target', index }); });
  return source.records.map((record, index) => {
    const result: ImportRow = { index, line: source.lines[index], errors: [], warnings: [] };
    try {
      if (source.kind === 'csv' && (record as string[]).length !== source.columns.length) fail('csvColumns', { actual: (record as string[]).length, expected: source.columns.length });
      if (source.kind === 'canonical' && !object(record)) fail('optionType');
      const raw = source.kind === 'canonical' ? record as Record<string, any> : Object.fromEntries(Object.entries(config.mapping).filter(([, key]) => key !== '').map(([field, key]) => [field, source.kind === 'csv' ? (record as string[])[Number(key)] : (record as Record<string, unknown>)[key]]));
      const q = validateQuestion(raw, config, source.kind === 'canonical', result.warnings); result.question = q;
      if (q.id && ids.has(q.id)) result.warnings.push(problem('sourceIds')); if (q.id) ids.add(q.id);
      const match = exact.get(contentKey(q)) || prompts.get(promptKey(q));
      if (match) result.duplicate = { ...match, kind: exact.has(contentKey(q)) ? 'identical' : 'similar' };
      if (!exact.has(contentKey(q))) exact.set(contentKey(q), { source: 'file', index });
      if (!prompts.has(promptKey(q))) prompts.set(promptKey(q), { source: 'file', index });
    } catch (error) { result.errors.push(error instanceof QuestionImportError ? error.issue : problem('failed')); }
    return result;
  });
}

export function importId(prefix = 'q'): string {
  return `${prefix}-${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
/** Atomic immutable append. Source quiz metadata and timestamps are deliberately never copied. */
export function appendImportedQuestions(destination: Quiz, rows: ImportRow[]): Quiz {
  if (!rows.length || rows.some(row => row.errors.length || !row.question)) fail('nothingSelected');
  if (new Set(rows.map(row => row.index)).size !== rows.length) fail('nothingSelected');
  if (destination.questions.length + rows.length > IMPORT_LIMITS.records) fail('targetLimit');
  const base = editableVideoQuiz(destination), used = new Set(base.questions.map(q => q.id));
  const added = rows.map(row => {
    let id = importId(); while (used.has(id)) id = importId(); used.add(id);
    const { videoTimestamp: _timestamp, ...q } = row.question!;
    return { ...q, id, options: q.options.map(option => ({ ...option, id: importId('opt') })) };
  });
  return { ...base, questions: [...base.questions, ...added] };
}

export function questionCsvTemplate(language: 'it' | 'en' = 'it'): string {
  if (language === 'en') return '\uFEFF' + [
    'question;type;option_A;option_B;option_C;option_D;correct;explanation;points;timeLimit',
    'What is the capital of Italy?;multiple_choice;Rome;Milan;Turin;Naples;A;Rome is the capital of Italy.;1000;20',
    'Earth orbits the Sun.;true_false;True;False;;;A;;1000;30',
    'Select an even number.;multiple_choice;2;3;4;5;A|C;Both 2 and 4 are correct.;2000;20',
  ].join('\r\n') + '\r\n';
  return '\uFEFF' + [
    'domanda;tipo;risposta_A;risposta_B;risposta_C;risposta_D;corretta;spiegazione;punti;tempo',
    'Qual è la capitale d’Italia?;multiple_choice;Roma;Milano;Torino;Napoli;A;Roma è la capitale d’Italia.;1000;20',
    'La Terra ruota intorno al Sole.;true_false;Vero;Falso;;;A;;1000;30',
    'Seleziona un numero pari.;multiple_choice;2;3;4;5;A|C;Sono corretti 2 e 4.;2000;20',
  ].join('\r\n') + '\r\n';
}
