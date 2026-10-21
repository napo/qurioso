import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { checkpointProblems, prepareVideoQuiz, quizCheckpoints } from '../src/services/videoQuiz';
import { portableQuiz } from '../src/services/libraryBackup';
import { jsonImportSource, previewQuestionImport } from '../src/services/questionImport';

test('the official volcano quiz is also a portable offline-cover JSON with valid video checkpoints', () => {
  const downloadable = JSON.parse(readFileSync(new URL('../public/quizzes/tipi-di-vulcani.json', import.meta.url), 'utf8'));
  const quiz = DEFAULT_QUIZZES.find(item => item.id === downloadable.id);
  assert.ok(quiz);
  assert.deepEqual(quiz, downloadable, 'the bundled and downloadable quiz have a single source');
  assert.equal(new Set(DEFAULT_QUIZZES.map(item => item.id)).size, DEFAULT_QUIZZES.length);
  assert.equal(quiz.title, 'Tipi di vulcani con geopop');
  assert.equal(quiz.category, 'Scienze');
  assert.equal(quiz.questions.length, 11);
  assert.equal(quiz.videoConfig?.videoUrl, 'https://www.youtube.com/watch?v=r4mRzXmQ6mY');
  assert.deepEqual(checkpointProblems(quiz), []);
  assert.doesNotThrow(() => prepareVideoQuiz(quiz));
  assert.deepEqual(quizCheckpoints(quiz).map(checkpoint => checkpoint.timestamp), [60, 135, 210, 285, 360, 450, 540, 615, 690, 750, 825]);
  for (const question of quiz.questions) {
    assert.equal(question.options.filter(option => option.isCorrect).length, 1, question.text);
    assert.equal(new Set(question.options.map(option => option.text.trim())).size, question.options.length, 'answer texts must be distinct: ' + question.text);
    assert.ok(question.options.every(option => option.text.trim()));
    assert.equal(quizCheckpoints(quiz).find(checkpoint => checkpoint.questionId === question.id)?.timestamp, question.videoTimestamp);
  }
  assert.match(quiz.coverImage!, /^data:image\/jpeg;base64,/);
  const bytes = Buffer.from(quiz.coverImage!.split(',')[1], 'base64');
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff', 'offline cover contains JPEG bytes');
  assert.equal(quiz.coverAttribution?.creator, 'Boaworm');
  assert.equal(quiz.coverAttribution?.license, 'CC BY 3.0');
  assert.equal(quiz.coverAttribution?.sourceUrl, 'https://commons.wikimedia.org/wiki/File:Fimmvorduhals_2010_03_27_dawn.jpg');
  assert.ok(quiz.coverAttribution?.licenseUrl?.startsWith('https://creativecommons.org/licenses/by/3.0'));
  assert.match(quiz.coverAttribution?.attributionText || '', /ridimensionata/);
  assert.deepEqual(portableQuiz(quiz).coverAttribution, quiz.coverAttribution, 'backup retains the complete cover attribution');
});

test('sample quiz images are bundled 800px WebP files with Commons credits that survive backup and import', () => {
  const images = DEFAULT_QUIZZES.flatMap(quiz => [
    { url: quiz.coverImage, credit: quiz.coverAttribution },
    ...quiz.questions.filter(item => item.mediaUrl).map(item => ({ url: item.mediaUrl, credit: item.mediaAttribution })),
  ]).filter(image => image.url && !image.url.startsWith('data:'));
  assert.equal(images.length, 6);
  for (const { url, credit } of images) {
    assert.match(url!, /^quizzes\/covers\/[a-z0-9-]+\.webp$/, 'no hotlinked sample images');
    const bytes = readFileSync(new URL(`../public/${url}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF'); assert.equal(bytes.subarray(8, 16).toString(), 'WEBPVP8 ');
    assert.ok((bytes.readUInt16LE(26) & 0x3fff) <= 800, url);
    assert.match(credit?.sourceUrl || '', /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.ok(credit?.creator && credit.license && credit.title, url);
  }
  for (const quiz of DEFAULT_QUIZZES) assert.deepEqual(portableQuiz(quiz).coverImage, quiz.coverImage, 'backup keeps bundled paths');
  const pantheon = DEFAULT_QUIZZES.flatMap(quiz => quiz.questions).find(item => item.mediaUrl?.startsWith('quizzes/'))!;
  const [row] = previewQuestionImport(jsonImportSource(JSON.stringify([pantheon])), { mapping: {}, defaultType: 'multiple_choice', correctMode: 'letters' });
  assert.deepEqual(row.errors, []); assert.deepEqual(row.warnings.filter(issue => issue.key === 'externalAsset'), []);
  assert.equal(row.question?.mediaUrl, pantheon.mediaUrl);
});

test('English and German sample quizzes are well formed', () => {
  for (const [id, title, trueText] of [['quiz-sample-united-kingdom', 'Discover the United Kingdom', 'True'], ['quiz-sample-germany', 'Deutschland entdecken', 'Wahr']] as const) {
    const quiz = DEFAULT_QUIZZES.find(item => item.id === id);
    assert.ok(quiz, id); assert.equal(quiz.title, title); assert.equal(quiz.questions.length, 5);
    assert.equal(new Set(quiz.questions.map(q => q.id)).size, 5);
    for (const question of quiz.questions) {
      assert.equal(question.options.filter(option => option.isCorrect).length, 1, question.text);
      assert.equal(new Set(question.options.map(option => option.text)).size, question.options.length, question.text);
      assert.ok(question.explanation);
      // Classroom letters (V/F, T/F, W/F) rely on true/false options being stored as [true, false].
      if (question.type === 'true_false') assert.deepEqual(question.options.map(option => [option.text, option.isCorrect]), [[trueText, true], [trueText === 'True' ? 'False' : 'Falsch', false]]);
    }
  }
});
