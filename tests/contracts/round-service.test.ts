import test from 'node:test';
import assert from 'node:assert/strict';
import { determineWinnersByHandFromCards } from '@/lib/server/game/round-service';

test('highest rank wins', ()=>{
  const winners = determineWinnersByHandFromCards([{playerId:'a',cards:['oracle']},{playerId:'b',cards:['legate']}]);
  assert.deepEqual(winners,['b']);
});

test('tie returns multiple winners', ()=>{
  const winners = determineWinnersByHandFromCards([{playerId:'a',cards:['oracle']},{playerId:'b',cards:['oracle']}]);
  assert.deepEqual(winners,['a','b']);
});

test('empty hand excluded', ()=>{
  const winners = determineWinnersByHandFromCards([{playerId:'a',cards:[]},{playerId:'b',cards:['oracle']}]);
  assert.deepEqual(winners,['b']);
});
