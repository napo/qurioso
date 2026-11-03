import assert from 'node:assert/strict';
import test from 'node:test';
import { nicknameAllowed } from '../src/services/nicknameFilter';

test('nickname filter catches disguised insults in Italian, English and German and leaves ordinary names alone', () => {
  for (const name of ['cazzo', 'C4ZZ0', 'caaazzo', 'c a z z o', 'c.a.z.z.o', 'Stronzetto', 'f u c k me', 'Sh1t', 'Scheiße', 'Arschloch', 'Fick dich', 'Merdaccia', 'il negro', 'ass', 'figa'])
    assert.equal(nicknameAllowed(name), false, name);
  for (const name of ['Giulia', 'Massimo', 'Assunta', 'Sessantotto', 'Homer Davis', 'Negroni', 'Niger', 'Dickens', 'Peacock', 'Barsch', 'Pupazzo', 'Classe 3B', 'Ana B C', 'Zoë', 'Jürgen'])
    assert.equal(nicknameAllowed(name), true, name);
});
