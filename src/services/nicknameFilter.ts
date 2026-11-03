/**
 * Offensive nicknames in Italian, English and German. The server refuses them on join; the join form checks first
 * so the student sees why. It is a deterrent, not a guarantee: the presenter can still remove a participant.
 *
 * Text is folded before matching: lower case, no accents, look-alike digits and symbols as letters (c4zz0 → cazzo).
 * - `anywhere`: distinctive roots, matched inside each word and inside letters spelled one by one (c.a.z.z.o), but
 *   never across two real words, so "Homer Davis" is not read as containing "merda".
 * - `word`: short or ambiguous words, matched only as whole words, so ordinary names that contain them stay allowed.
 * Every letter may be repeated (caaazzo).
 */
const anywhere = [
  // Italian
  'cazzo', 'cazzi', 'minchia', 'stronz', 'vaffancul', 'fancul', 'coglion', 'puttan', 'mignott', 'bastard', 'merda',
  'froci', 'ricchion', 'porcodio', 'diocane', 'dioporco', 'porcamadonna', 'pompino', 'ritardat', 'handicappat', 'hitler',
  // English
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'slut', 'asshole', 'dickhead', 'motherf', 'wanker', 'retard',
  // German
  'scheiss', 'arschloch', 'fotze', 'wichser', 'hurensohn', 'schlampe', 'missgeburt', 'spast', 'schwuchtel', 'fick',
];
const word = [
  'troia', 'troie', 'figa', 'culo', 'sega', 'seghe', 'zoccola', 'negro', 'negra', 'negri', 'nazi', 'duce',
  'ass', 'dick', 'cock', 'piss', 'rape', 'sex', 'porn', 'porno', 'fag', 'hure', 'arsch', 'neger', 'nazis',
];

const LOOK_ALIKE: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', 'ß': 'ss' };
const fold = (text: string) => text.toLowerCase().replace(/[0-9@$!ß]/g, c => LOOK_ALIKE[c] ?? c).normalize('NFKD').replace(/[̀-ͯ]/g, '');
// Each letter may repeat: "fuuuck" still matches "fuck", while "Niger" does not match "nigger".
const pattern = (root: string) => [...root].map(letter => `${letter}+`).join('');
const ANYWHERE = new RegExp(anywhere.map(pattern).join('|'));
const WORD = new RegExp(`^(?:${word.map(pattern).join('|')})$`);

export function nicknameAllowed(nickname: string): boolean {
  const words: string[] = [];
  let letters = '';
  // Runs of single letters become one word: "f u c k" is read as "fuck".
  for (const part of fold(nickname).split(/[^a-z]+/).filter(Boolean)) {
    if (part.length === 1) { letters += part; continue; }
    if (letters) words.push(letters);
    letters = '';
    words.push(part);
  }
  if (letters) words.push(letters);
  return !words.some(part => ANYWHERE.test(part) || WORD.test(part));
}
