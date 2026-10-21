import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';

test('the desktop library uses a compact workspace shell, native menu commands and the quiz name as window title', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://qurioso.localhost/?app=network&lang=it' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, localStorage: dom.window.localStorage, indexedDB: new IDBFactory(), IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => new Response('{}', { status: 404 }),
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  let sharingListener: (state: { phase: string }) => void = () => {};
  let menuListener: (command: string) => void = () => {};
  const menuStates: boolean[] = [];
  (window as any).quriosoDesktop = {
    serverPort: 54321,
    internetSharing: { status: async () => ({ phase: 'idle' }), start: async () => ({ phase: 'idle' }), stop: async () => ({ phase: 'idle' }), onChange: (callback: typeof sharingListener) => { sharingListener = callback; return () => {}; } },
    menu: { onCommand: (callback: typeof menuListener) => { menuListener = callback; return () => {}; }, setLibraryVisible: (visible: boolean) => menuStates.push(visible) },
  };
  const { createRoot } = await import('react-dom/client');
  const { LanguageProvider } = await import('../src/context/LanguageContext');
  const { gameSync } = await import('../src/services/gameSync');
  const getInfo = gameSync.getServerInfo, recover = gameSync.recoverPresenter;
  gameSync.getServerInfo = async () => ({ port: 54321, localIps: ['192.168.1.7'], status: 'ok', protocol: 'http', host: 'test', fullUrl: 'http://192.168.1.7:54321' });
  gameSync.recoverPresenter = async () => ({ status: 'none' }) as any;
  const { default: App } = await import('../src/App');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => {
    gameSync.getServerInfo = getInfo; gameSync.recoverPresenter = recover;
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  });
  const settle = async (condition: () => boolean) => { for (let n = 0; n < 100 && !condition(); n++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); };
  const buttons = () => [...document.querySelectorAll('button')];
  const text = () => document.body.textContent!;
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App))));
  await settle(() => Boolean(document.querySelector('[data-shell="desktop"]')) && document.querySelector('[data-server-badge]')?.getAttribute('data-server-badge') === 'lan');

  assert.equal(menuStates[0], false, 'native library commands stay disabled while the library loads');
  assert.equal(menuStates.at(-1), true);
  // Website elements are gone from the desktop frame.
  assert.ok(document.querySelector('[data-shell="desktop"]'));
  assert.equal(document.querySelector('footer'), null);
  assert.equal([...document.querySelectorAll('a')].some(a => a.getAttribute('href') === './'), false, 'no link back to the landing page');
  for (const removed of ['Prepara la lezione', 'Torna alla pagina iniziale', 'Partecipa con PIN', 'GitHub', 'Rilasciato sotto licenza', 'GNU Affero']) assert.equal(text().includes(removed), false, removed);
  assert.equal(document.querySelector('header a[href*="app=guide"]'), null, 'guide moved to Settings and the Help menu');
  assert.equal(document.querySelector('header button[aria-expanded][aria-haspopup="menu"]')?.textContent, 'Nuovo quiz');
  assert.equal(document.querySelectorAll('header button').length, 2, 'only “New quiz” and Settings in the toolbar');

  // Server badge follows LAN and Internet sharing.
  assert.match(document.querySelector('[data-server-badge]')!.getAttribute('aria-label')!, /Stato del server: LAN/);
  await act(async () => sharingListener({ phase: 'active' }));
  assert.equal(document.querySelector('[data-server-badge]')!.textContent, 'Internet attivo');
  await act(async () => sharingListener({ phase: 'reconnecting' }));
  assert.equal(document.querySelector('[data-server-badge]')!.textContent, 'Internet interrotto');
  await act(async () => sharingListener({ phase: 'idle' }));

  // Compact segmented mode control, without the descriptive cards.
  const modes = [...document.querySelectorAll<HTMLButtonElement>('[data-activity-mode]')];
  assert.deepEqual(modes.map(b => [b.textContent, b.getAttribute('aria-pressed')]), [['Lezione in aula', 'false'], ['Quiz sui dispositivi', 'true']]);
  assert.equal(text().includes('Ogni partecipante risponde dal proprio telefono'), false, 'the extended explanation stays in the guide');
  await act(async () => modes[0].click());
  assert.equal(modes[0].getAttribute('aria-pressed'), 'true');
  assert.ok(buttons().some(b => b.textContent === 'Attività in classe'));
  await act(async () => modes[1].click());

  // "New quiz" menu: classic or video.
  const trigger = document.querySelector<HTMLButtonElement>('header button[aria-haspopup="menu"]')!;
  await act(async () => trigger.click());
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  const items = [...document.querySelectorAll<HTMLButtonElement>('[role="menu"] [role="menuitem"]')];
  assert.deepEqual(items.map(b => b.textContent), ['Quiz classico', 'Quiz video']);
  assert.equal(document.activeElement, items[0]);
  await act(async () => { document.querySelector('[role="menu"]')!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  assert.equal(document.querySelector('[role="menu"]'), null);
  assert.equal(document.activeElement, trigger);
  await act(async () => trigger.click());
  await act(async () => document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[1].click());
  await settle(() => Boolean(document.querySelector('.quiz-editor')));
  assert.ok(document.querySelector('.quiz-editor'));
  assert.equal(document.title, 'Nuovo quiz video — Qurioso', 'the window title names the open quiz');
  assert.equal(menuStates.at(-1), false, 'native library commands are disabled in the editor');
  await act(async () => menuListener('new-quiz'));
  assert.equal(document.title, 'Nuovo quiz video — Qurioso', 'a menu command cannot replace the quiz being edited');

  // Back in the library, native menu commands work and Settings holds the information moved out of the frame.
  await act(async () => root.render(React.createElement('div')));
  await act(async () => root.render(React.createElement(LanguageProvider, null, React.createElement(App, { key: 'again' }))));
  await settle(() => Boolean(document.querySelector('[data-shell="desktop"]')));
  assert.equal(document.title, 'Qurioso');
  assert.equal(menuStates.at(-1), true);
  await act(async () => menuListener('about'));
  await settle(() => Boolean(document.querySelector('[data-qurioso-settings]')));
  const about = document.querySelector('[data-settings-about]')!;
  assert.equal(document.activeElement, about.querySelector('h2'), 'Help → About focuses the section');
  assert.match(about.textContent!, /Maurizio Napolitano/);
  assert.match(about.textContent!, /GNU Affero General Public License/);
  assert.ok([...about.querySelectorAll('button')].some(b => b.textContent === 'Compilazione e GitHub'));
  assert.ok(document.querySelector('[data-qurioso-settings] button[aria-expanded]'), 'language selector in Settings');
  assert.ok(buttons().some(b => b.getAttribute('aria-pressed') !== null && /Audio/.test(b.textContent || '')), 'sound toggle in Settings');
  assert.ok(document.querySelector('[data-qurioso-settings] a[href*="app=guide"]'), 'guide link in Settings');
  await act(async () => menuListener('import-questions'));
  assert.ok(document.querySelector('.question-import-dialog'));
});
