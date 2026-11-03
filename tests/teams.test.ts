import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
import QRCode from 'qrcode';
import { startLanServer, round } from './helpers/lanServer';
import { DEFAULT_QUIZZES } from '../src/data/defaultQuizzes';
import { assignTeams, makeTeams, MAX_TEAMS, teamStandings } from '../src/services/teams';
import type { GameSession, Player, Team } from '../src/types/quiz';

const names = { red: 'Rossa', blue: 'Blu', yellow: 'Gialla', green: 'Verde', purple: 'Viola', orange: 'Arancione' };
const person = (id: string, extra: Partial<Player> = {}): Player => ({ id, nickname: id, name: id, avatar: '🦊', score: 0, streak: 0, ...extra });

test('teams: 2 to 6 with distinct colours, average score ranking, the unassigned join the smallest in order of arrival', () => {
  assert.deepEqual(makeTeams(3, names).map(team => [team.id, team.name, team.color]), [['team-red', 'Rossa', 'red'], ['team-blue', 'Blu', 'blue'], ['team-yellow', 'Gialla', 'yellow']]);
  assert.equal(makeTeams(1, names).length, 2, 'a team game has at least two teams');
  assert.equal(makeTeams(9, names).length, MAX_TEAMS);

  // The average counts, not the size: one strong member beats three average ones; an empty team goes last.
  const teams = makeTeams(3, names);
  const standings = teamStandings(teams, [
    person('a', { teamId: 'team-red', score: 900 }), person('b', { teamId: 'team-red', score: 600 }), person('c', { teamId: 'team-red', score: 601 }),
    person('d', { teamId: 'team-blue', score: 1000 }),
  ]);
  assert.deepEqual(standings.map(s => [s.team.id, s.members.length, s.score]), [['team-blue', 1, 1000], ['team-red', 3, 700], ['team-yellow', 0, 0]]);

  const players = {
    a: person('a', { teamId: 'team-red', joinedAt: 1 }), b: person('b', { teamId: 'team-red', joinedAt: 2 }),
    c: person('c', { joinedAt: 5 }), d: person('d', { joinedAt: 3 }), e: person('e', { teamId: 'team-gone', joinedAt: 4 }),
  };
  const assigned = assignTeams(players, teams);
  // d (3) goes to blue, e (4, team removed) to yellow, c (5) to blue or yellow: the first smallest, blue.
  assert.deepEqual(Object.fromEntries(Object.values(assigned).map(p => [p.id, p.teamId])), { a: 'team-red', b: 'team-red', c: 'team-blue', d: 'team-blue', e: 'team-yellow' });
  assert.equal(players.c.teamId, undefined, 'the input is not changed');
});

test('team games on the server: a team is required to join, invalid teams are refused or dropped, the presenter moves players in a video quiz', { timeout: 15000 }, async t => {
  const { request, mint } = await startLanServer(t);
  const hostToken = await mint();
  const teams = makeTeams(2, names);
  const join = (pin: string, p: object) => request(`/api/session/${pin}/join`, 'POST', { player: p });

  // Classic game in teams.
  const initial = { ...round('523456'), status: 'lobby' as const, teams }, path = `/api/session/${initial.pin}`;
  let state = await (await request('/api/session/create', 'POST', { session: initial }, hostToken)).json();
  const publish = async (session: Partial<GameSession>) => request(path + '/state', 'POST', { session: { ...state.session, ...session }, revision: state.revision }, hostToken);
  const refused = await join(initial.pin, person('anna'));
  assert.equal(refused.status, 400); assert.equal((await refused.json()).error, 'Team required');
  assert.equal((await join(initial.pin, person('bruno', { teamId: 'team-green' }))).status, 400, 'a team of another game');
  assert.equal((await join(initial.pin, person('anna', { teamId: 'team-blue' }))).status, 200);
  const anonymous = await (await request(path, 'GET')).json();
  assert.deepEqual(anonymous.session.teams.map((team: { id: string }) => team.id), ['team-red', 'team-blue'], 'the join form reads the teams without credentials');

  for (const invalid of [[teams[0]], makeTeams(6, names).concat({ id: 'team-x', name: 'X', color: 'red' }), [teams[0], teams[0]], [teams[0], { ...teams[1], color: 'pink' }]] as Team[][]) {
    assert.equal((await publish({ teams: invalid })).status, 400, JSON.stringify(invalid.map(team => team.id)));
  }
  // Removing a team leaves its members without one, until the start assigns them again.
  const fewer = await publish({ teams: [teams[0], { id: 'team-yellow', name: 'Gialla', color: 'yellow' }] });
  assert.equal(fewer.status, 200); state = await fewer.json();
  assert.equal(state.session.players.anna.teamId, undefined);
  const none = await publish({ teams: undefined });
  assert.equal(none.status, 200); state = await none.json();
  assert.equal((await join(initial.pin, person('carla', { teamId: 'team-red' }))).status, 200, 'without teams any team sent is ignored');
  state = await (await request(path, 'GET', undefined, hostToken)).json();
  assert.equal(state.session.players.carla.teamId, undefined);

  // Video quiz: players are server-owned, yet the presenter may still move them to another team.
  const quiz = structuredClone(DEFAULT_QUIZZES[0]), pin = '723456', videoToken = await mint();
  const createdVideo = await request('/api/session/create', 'POST', { videoQuiz: quiz, session: { ...round(pin), mode: 'video', status: 'lobby', currentQuestion: undefined, questionStartTime: 0, teams } }, videoToken);
  assert.equal(createdVideo.status, 200, await createdVideo.clone().text());
  let video = await createdVideo.json();
  assert.equal((await join(pin, person('dario', { teamId: 'team-red' }))).status, 200);
  video = await (await request(`/api/session/${pin}`, 'GET', undefined, videoToken)).json();
  const moved = await request(`/api/session/${pin}/state`, 'POST', { session: { ...video.session, players: { dario: { ...video.session.players.dario, teamId: 'team-blue', score: 99999 } } }, revision: video.revision }, videoToken);
  assert.equal(moved.status, 200, await moved.clone().text());
  const after = (await moved.json()).session.players.dario;
  assert.equal(after.teamId, 'team-blue');
  assert.equal(after.score, 0, 'the presenter cannot change a video quiz score while moving a player');
});

test('presenter lobby: the teacher picks the teams, moves a participant, and the start puts everyone without a team in the smallest', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://qurioso.localhost/?app=network&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const originalCanvas = QRCode.toCanvas;
  QRCode.toCanvas = (() => {}) as unknown as typeof QRCode.toCanvas;
  const { gameSync } = await import('../src/services/gameSync');
  const methods = { getServerInfo: gameSync.getServerInfo, register: gameSync.register, unregister: gameSync.unregister, subscribe: gameSync.subscribe, createSessionOnServer: gameSync.createSessionOnServer, canRecoverPresenter: gameSync.canRecoverPresenter, fetchSessionFromServer: gameSync.fetchSessionFromServer, removeSession: gameSync.removeSession };
  const writes: GameSession[] = [];
  gameSync.getServerInfo = async () => null; gameSync.register = () => {}; gameSync.unregister = () => {}; gameSync.subscribe = () => () => {};
  gameSync.fetchSessionFromServer = async () => null; gameSync.canRecoverPresenter = () => true; gameSync.removeSession = async () => {};
  gameSync.createSessionOnServer = async session => { writes.push(structuredClone(session)); return true; };
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { HostScreen } = await import('../src/components/host/HostScreen');
  const quiz = DEFAULT_QUIZZES.find(q => !q.videoConfig)!;
  const session: GameSession = { pin: '133456', quizId: quiz.id, quizTitle: quiz.title, mode: 'standard', status: 'lobby', currentQuestionIndex: 0, questionStartTime: 0, timeRemaining: 20,
    players: { a: person('Anna', { joinedAt: 1 }), b: person('Bruno', { joinedAt: 2 }), c: person('Carla', { joinedAt: 3 }) }, answersForCurrentQuestion: {}, totalQuestions: quiz.questions.length };
  for (const [key, value] of Object.entries(session.players)) session.players[key] = { ...value, id: key };
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); Object.assign(gameSync, methods); QRCode.toCanvas = originalCanvas; dom.window.close(); for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(HostScreen, { quiz, onExit: () => {}, recoveredSession: session }))));
  const choose = async (select: HTMLSelectElement, value: string) => act(async () => { select.value = value; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  const teamCount = () => [...document.querySelectorAll('label')].find(label => label.textContent!.startsWith('Squadre'))!.querySelector('select')!;
  const groups = () => [...document.querySelectorAll('.host-team-list section')].map(section => [section.getAttribute('aria-label'), [...section.querySelectorAll('span.font-bold')].map(name => name.textContent)]);

  assert.equal(document.querySelector('.host-team-list'), null, 'no teams by default');
  await choose(teamCount(), '3');
  assert.deepEqual(writes.at(-1)!.teams!.map(team => team.name), ['Squadra rossa', 'Squadra blu', 'Squadra gialla']);
  assert.deepEqual(groups(), [['Squadra rossa', []], ['Squadra blu', []], ['Squadra gialla', []], ['Senza squadra', ['Anna', 'Bruno', 'Carla']]]);

  await choose(document.querySelector<HTMLSelectElement>('select[aria-label="Squadra di Bruno"]')!, 'team-blue');
  assert.equal(writes.at(-1)!.players.b.teamId, 'team-blue');
  assert.deepEqual(groups()[1], ['Squadra blu', ['Bruno']]);

  await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent!.trim() === 'Inizia il quiz')!.click());
  const started = writes.find(write => Object.values(write.players).every(p => p.teamId))!;
  assert.ok(started, 'the start assigns everyone');
  assert.deepEqual(Object.fromEntries(Object.entries(started.players).map(([id, p]) => [id, p.teamId])), { a: 'team-red', b: 'team-blue', c: 'team-yellow' });

  // Back to no teams: nobody keeps one.
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(HostScreen, { key: 'again', quiz, onExit: () => {}, recoveredSession: { ...started, status: 'lobby' } }))));
  await choose(teamCount(), '0');
  assert.equal(writes.at(-1)!.teams, undefined);
  assert.equal(Object.values(writes.at(-1)!.players).some(p => p.teamId), false);
});

test('phone: in a team game the student picks a team before joining, and the choice travels with the join', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://10.0.0.4:4000/?pin=223456&role=player&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const joins: { player: Player }[] = [];
  const teams = makeTeams(2, { ...names, red: 'Squadra rossa', blue: 'Squadra blu' });
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, init?: RequestInit) => {
      if (String(url) === '/api/session/223456') return new Response(JSON.stringify({ session: { teams } }));
      if (String(url).endsWith('/join')) { joins.push(JSON.parse(String(init!.body))); return new Response('{}', { status: 503 }); }
      return new Response('{}', { status: 404 });
    },
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { default: ParticipantApp } = await import('../src/ParticipantApp');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
  await act(async () => { root.render(React.createElement(LanguageProvider, null, React.createElement(ParticipantApp))); await new Promise(resolve => setTimeout(resolve, 20)); });
  const nickname = document.querySelectorAll<HTMLInputElement>('form input')[1];
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(nickname, 'Giulia'); nickname.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  const submit = () => act(async () => { document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })); await new Promise(resolve => setTimeout(resolve, 20)); });
  const teamButtons = () => [...document.querySelectorAll<HTMLButtonElement>('fieldset button')];

  assert.match(document.querySelector('fieldset legend')!.textContent!, /Scegli la tua squadra/);
  assert.deepEqual(teamButtons().map(button => button.textContent), ['Squadra rossa', 'Squadra blu']);
  await submit();
  assert.match(document.body.textContent!, /Scegli una squadra per entrare/);
  assert.equal(joins.length, 0, 'nothing is sent without a team');

  await act(async () => teamButtons()[1].click());
  assert.deepEqual(teamButtons().map(button => button.getAttribute('aria-pressed')), ['false', 'true']);
  await submit();
  assert.equal(joins.length, 1);
  assert.equal(joins[0].player.teamId, 'team-blue');
});
