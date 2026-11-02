import type { Language } from '../i18n/translations';

/**
 * A request for any chat assistant the teacher already uses, so Qurioso needs no API key. The answer is a CSV whose
 * headings the question import recognizes, including the time in the video that becomes a checkpoint.
 */
export interface AiPromptOptions { language: Language; count: number; level?: string; transcript?: string }
export const AI_TRANSCRIPT_MAX = 200_000;

const HEADER = {
  it: 'domanda;tipo;risposta_A;risposta_B;risposta_C;risposta_D;corretta;spiegazione;tempo_video',
  en: 'question;type;option_A;option_B;option_C;option_D;correct;explanation;video_time',
  // The import recognizes Italian and English headings; the questions themselves are written in German.
  de: 'question;type;option_A;option_B;option_C;option_D;correct;explanation;video_time',
};

const TEXT = {
  it: {
    intro: (count: number, level: string) => `Sei un insegnante esperto. Prepara ${count} domande di verifica a scelta multipla sul contenuto qui sotto${level ? `, adatte a ${level}` : ''}.`,
    rules: [
      'Ogni domanda ha 4 risposte e una sola corretta; quelle sbagliate devono essere plausibili.',
      'Chiedi solo ciò che il contenuto spiega, nell’ordine in cui compare.',
      'Testi brevi: domanda al massimo 120 caratteri, ogni risposta al massimo 60.',
      'Aggiungi una spiegazione di una frase.',
      'In tempo_video metti il momento (mm:ss) subito dopo la spiegazione dell’argomento, preso dai tempi del contenuto; se non ci sono tempi lascialo vuoto.',
      'Scrivi in italiano.',
    ],
    format: 'Rispondi solo con un CSV separato da punto e virgola, senza altro testo, con questa intestazione:',
    fields: 'Nel campo tipo scrivi multiple_choice; in corretta la lettera (A, B, C o D). Metti tra virgolette i campi che contengono un punto e virgola.',
    content: 'Contenuto:', attached: 'Il contenuto è nel file o nel messaggio che allego.',
  },
  en: {
    intro: (count: number, level: string) => `You are an experienced teacher. Write ${count} multiple-choice check questions about the content below${level ? `, suitable for ${level}` : ''}.`,
    rules: [
      'Each question has 4 answers and exactly one correct; the wrong ones must be plausible.',
      'Ask only about what the content explains, in the order it appears.',
      'Keep it short: questions up to 120 characters, each answer up to 60.',
      'Add a one-sentence explanation.',
      'In video_time put the moment (mm:ss) right after the topic is explained, taken from the times in the content; leave it empty if there are no times.',
      'Write in English.',
    ],
    format: 'Reply only with a semicolon-separated CSV, with no other text, using this header:',
    fields: 'In type write multiple_choice; in correct the letter (A, B, C or D). Quote fields that contain a semicolon.',
    content: 'Content:', attached: 'The content is in the file or message I attach.',
  },
  de: {
    intro: (count: number, level: string) => `Du bist eine erfahrene Lehrkraft. Erstelle ${count} Multiple-Choice-Fragen zur Lernkontrolle über den folgenden Inhalt${level ? `, geeignet für ${level}` : ''}.`,
    rules: [
      'Jede Frage hat 4 Antworten und genau eine richtige; die falschen müssen plausibel sein.',
      'Frage nur, was der Inhalt erklärt, in der Reihenfolge, in der es vorkommt.',
      'Kurze Texte: Fragen höchstens 120 Zeichen, jede Antwort höchstens 60.',
      'Füge eine Erklärung in einem Satz hinzu.',
      'In video_time steht der Zeitpunkt (mm:ss) direkt nach der Erklärung des Themas, aus den Zeiten im Inhalt; ohne Zeiten bleibt das Feld leer.',
      'Schreibe auf Deutsch.',
    ],
    format: 'Antworte nur mit einer durch Semikolons getrennten CSV, ohne weiteren Text, mit dieser Kopfzeile:',
    fields: 'In type steht multiple_choice; in correct der Buchstabe (A, B, C oder D). Setze Felder mit Semikolon in Anführungszeichen.',
    content: 'Inhalt:', attached: 'Der Inhalt steht in der Datei oder Nachricht, die ich anhänge.',
  },
};

export function aiQuestionPrompt({ language, count, level = '', transcript = '' }: AiPromptOptions): string {
  const text = TEXT[language], content = transcript.trim().slice(0, AI_TRANSCRIPT_MAX);
  return [
    text.intro(count, level.trim()), '', ...text.rules.map(rule => `- ${rule}`), '',
    text.format, HEADER[language], text.fields, '',
    text.content, content ? `"""\n${content}\n"""` : text.attached,
  ].join('\n');
}

/** Assistants often wrap the CSV in a code block or add a sentence around it: keep only the table. */
export function csvFromAiAnswer(answer: string): string {
  const lines = answer.replace(/\r\n?/g, '\n').split('\n').filter(line => !/^\s*```/.test(line));
  const start = lines.findIndex(line => /^\s*"?(domanda|question)"?\s*;/i.test(line));
  if (start < 0) return lines.join('\n').trim();
  const rows = lines.slice(start);
  const end = rows.findIndex((line, i) => i > 0 && !line.trim());
  return (end < 0 ? rows : rows.slice(0, end)).join('\n').trim();
}
