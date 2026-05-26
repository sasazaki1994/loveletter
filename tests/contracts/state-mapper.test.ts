import test from 'node:test';
import assert from 'node:assert/strict';
import { mapToClientState } from '@/lib/server/game/state-mapper';

const baseGame:any={id:'g',roomId:'r',phase:'choose_card',turnIndex:0,round:1,createdAt:new Date(),updatedAt:new Date(),deckState:{drawPile:['sentinel'],burnCard:null},discardPile:[],revealedSetupCards:[],activePlayerId:'p1',awaitingPlayerId:null,result:null};
const players:any=[{id:'p1',nickname:'p1',seat:0,shield:false,isEliminated:false,isBot:false,role:'player',lastActiveAt:new Date()},{id:'p2',nickname:'p2',seat:1,shield:false,isEliminated:false,isBot:false,role:'player',lastActiveAt:new Date()}];
const hands:any=[{playerId:'p1',cards:['oracle']},{playerId:'p2',cards:['legate']}];

test('self sees own hand only',()=>{const s=mapToClientState(baseGame,players,hands,[],[],'p1');assert.deepEqual(s.hand,['oracle']);assert.equal(s.players[1]?.handCount,1);});
test('peek hint only for actor with persisted payload cardId',()=>{const act:any=[{id:'a1',type:'peek',actorId:'p1',payload:{targetId:'p2',cardId:'legate'}}];const s1=mapToClientState(baseGame,players,hands,act,[],'p1');const s2=mapToClientState(baseGame,players,hands,act,[],'p2');assert.equal(s1.effectHints?.peek?.card,'legate');assert.equal(s2.effectHints?.peek,undefined);});
test('peek hint is hidden when legacy payload has no cardId',()=>{const act:any=[{id:'a1',type:'peek',actorId:'p1',payload:{targetId:'p2'}}];const s1=mapToClientState(baseGame,players,hands,act,[],'p1');assert.equal(s1.effectHints?.peek,undefined);});
