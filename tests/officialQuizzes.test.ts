import assert from 'node:assert/strict';
import test from 'node:test';
import { withOfficialQuizzes, OFFICIAL_QUIZZES } from '../src/services/officialQuizzes';
import { checkpointProblems, quizCheckpoints } from '../src/services/videoQuiz';

test('the included volcano lesson stays available after an upgrade without overwriting or duplicating personal quizzes', () => {
  const official=OFFICIAL_QUIZZES[0], personal={...official,id:'my-volcanoes',title:'My edited lesson'};
  const saved=[personal], before=JSON.stringify(saved), available=withOfficialQuizzes(saved);
  assert.equal(available.length,2); assert.equal(available[0],personal);
  assert.equal(JSON.stringify(saved),before);
  assert.equal(available[1].title,'Tipi di vulcani con geopop');
  assert.equal(quizCheckpoints(available[1]).length,11);
  assert.deepEqual(checkpointProblems(available[1]),[]);
  const edited={...official,title:'My version of the included quiz'};
  assert.deepEqual(withOfficialQuizzes([edited]),[edited]);
  assert.equal(withOfficialQuizzes(withOfficialQuizzes(saved)).length,2);
});
