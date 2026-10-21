import assert from 'node:assert/strict';
import test from 'node:test';
import { withOfficialQuizzes, OFFICIAL_QUIZZES } from '../src/services/officialQuizzes';
import { checkpointProblems, quizCheckpoints } from '../src/services/videoQuiz';

test('included lessons stay available after an upgrade without overwriting or duplicating personal quizzes', () => {
  const official=OFFICIAL_QUIZZES[0], personal={...official,id:'my-volcanoes',title:'My edited lesson'};
  const saved=[personal], before=JSON.stringify(saved), available=withOfficialQuizzes(saved);
  assert.equal(available.length,1+OFFICIAL_QUIZZES.length); assert.equal(available[0],personal);
  assert.equal(JSON.stringify(saved),before);
  assert.equal(available[1].title,'Tipi di vulcani con geopop');
  assert.equal(quizCheckpoints(available[1]).length,11);
  assert.deepEqual(checkpointProblems(available[1]),[]);
  const edited={...official,title:'My version of the included quiz'};
  assert.deepEqual(withOfficialQuizzes([edited]),[edited,...OFFICIAL_QUIZZES.slice(1)]);
  assert.equal(withOfficialQuizzes(withOfficialQuizzes(saved)).length,1+OFFICIAL_QUIZZES.length);
  const parmigiana=available.find(quiz=>quiz.id==='quiz-1792575203784');
  assert.ok(parmigiana);
  assert.equal(parmigiana.title,'Parmigiana di melanzane');
  assert.deepEqual(quizCheckpoints(parmigiana).map(checkpoint=>checkpoint.timestamp),[31,62,108,143,165,174]);
  assert.deepEqual(checkpointProblems(parmigiana),[]);
  const editedParmigiana={...parmigiana,title:'My edited cooking lesson'};
  assert.equal(withOfficialQuizzes([editedParmigiana]).filter(quiz=>quiz.id===parmigiana.id).length,1);
  assert.equal(withOfficialQuizzes([editedParmigiana])[0],editedParmigiana);
});
