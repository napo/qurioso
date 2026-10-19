import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import QRCode from 'qrcode';
import { getJoinAddresses } from '../src/utils/connectionUrl';
import { copyText } from '../src/utils/clipboard';

test('LAN address choices exclude loopback and retain every interface with the actual port', () => {
  const info = { port: 52317, localIps: ['192.168.1.25', '10.0.0.4', '192.168.1.25'] };
  assert.deepEqual(getJoinAddresses('http://qurioso.localhost', info), ['http://192.168.1.25:52317', 'http://10.0.0.4:52317']);
  assert.deepEqual(getJoinAddresses('http://localhost:52317', null), []);
  assert.deepEqual(getJoinAddresses('http://10.0.0.4:52317', info), ['http://10.0.0.4:52317', 'http://192.168.1.25:52317']);
});

test('selected interface drives base-address copying and QR PIN; HTTP clipboard has a fallback', async t => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'http://localhost:52317' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const info = { port: 52317, localIps: ['192.168.1.25', '10.0.0.4'] };
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true, fetch: async () => new Response(JSON.stringify(info)),
  })) { saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
  const qrPayloads: string[] = [];
  const originalCanvas = QRCode.toCanvas;
  QRCode.toCanvas = ((_canvas: unknown, value: string) => { qrPayloads.push(value); }) as typeof QRCode.toCanvas;
  const { createRoot } = await import('react-dom/client');
  const { JoinInstructions } = await import('../src/components/common/JoinInstructions');
  const { QRCodeDisplay } = await import('../src/components/common/QRCodeDisplay');
  const root = createRoot(document.getElementById('app')!);
  t.after(async () => { await act(async () => root.unmount()); QRCode.toCanvas = originalCanvas; dom.window.close();
    for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
  });
  function Lobby() {
    const [address, setAddress] = React.useState(`http://${info.localIps[0]}:${info.port}`);
    return React.createElement(React.Fragment, null,
      React.createElement(JoinInstructions, { pin: '123456', addresses: getJoinAddresses(window.location.origin, info), address, onAddressChange: setAddress }),
      React.createElement(QRCodeDisplay, { pin: '123456', baseUrl: address, showDetails: false }));
  }
  let copied = '';
  Object.defineProperty(document, 'execCommand', { configurable: true, value: (command: string) => {
    assert.equal(command, 'copy'); copied = document.querySelector('textarea')!.value; return true;
  } });
  await act(async () => root.render(React.createElement(Lobby)));
  assert.equal(qrPayloads.at(-1), 'http://192.168.1.25:52317/?pin=123456&role=player');
  const select = document.querySelector('select')!;
  await act(async () => { select.value = 'http://10.0.0.4:52317'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(document.querySelector('[data-testid="join-address"]')!.textContent, 'http://10.0.0.4:52317');
  assert.equal(document.querySelector('[data-testid="join-pin"]')!.textContent, '123456');
  assert.equal(qrPayloads.at(-1), 'http://10.0.0.4:52317/?pin=123456&role=player');
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Copia indirizzo')!.click());
  assert.equal(copied, 'http://10.0.0.4:52317');
  assert.equal(new URL(copied).search, '');
  assert.equal(document.querySelector('textarea'), null);
  assert.match(document.body.textContent!, /Indirizzo copiato/);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
  assert.equal(await copyText('http://10.0.0.4:52317'), true);
  Object.defineProperty(document, 'execCommand', { value: () => false });
  assert.equal(await copyText('http://10.0.0.4:52317'), false);
});
