import test from "node:test";
import assert from "node:assert/strict";

import { chooseBotAction, chooseBotCard } from "@/lib/server/bot-service";

test("forced chooses forced card", () => {
  assert.equal(chooseBotCard(["marquise", "legate"]), "marquise");
  assert.equal(chooseBotCard(["vizier", "arbiter"]), "vizier");
});

test("without forced chooses lower rank", () => {
  assert.equal(chooseBotCard(["sentinel", "emissary"]), "sentinel");
});

test("chooseBotAction ignores handCount=0 target", () => {
  const d = chooseBotAction({ selfId:'s', hand:['oracle','warder'], players:[{id:'s',isEliminated:false,shield:false,handCount:2,discardPile:[]},{id:'a',isEliminated:false,shield:false,handCount:0,discardPile:[]},{id:'b',isEliminated:false,shield:false,handCount:1,discardPile:[]}]});
  assert.equal(d.targetId,'b');
});

test("chooseBotAction derives sentinel guess from discard and avoids 1/seen ranks", () => {
  const d = chooseBotAction({ selfId:'s', hand:['sentinel','oracle'], players:[{id:'s',isEliminated:false,shield:false,handCount:2,discardPile:[]},{id:'t',isEliminated:false,shield:false,handCount:1,discardPile:['oracle','duelist']}]});
  assert.equal(d.cardId,'sentinel');
  assert.notEqual(d.guessedRank,1);
  assert.notEqual(d.guessedRank,2);
  assert.notEqual(d.guessedRank,3);
});

test("chooseBotAction avoids emissary when another card is playable", () => {
  const d = chooseBotAction({ selfId:'s', hand:['emissary','oracle'], players:[{id:'s',isEliminated:false,shield:false,handCount:2,discardPile:[]},{id:'t',isEliminated:false,shield:false,handCount:1,discardPile:[]}]});
  assert.equal(d.cardId,'oracle');
});

test("chooseBotAction forced card is always prioritized", () => {
  const d = chooseBotAction({ selfId:'s', hand:['vizier','arbiter'], players:[{id:'s',isEliminated:false,shield:false,handCount:2,discardPile:[]},{id:'t',isEliminated:false,shield:false,handCount:1,discardPile:[]}]});
  assert.equal(d.cardId,'vizier');
});

test("chooseBotAction excludes eliminated/shielded/handCount=0", () => {
  const d = chooseBotAction({ selfId:'s', hand:['oracle','emissary'], players:[{id:'s',isEliminated:false,shield:false,handCount:2,discardPile:[]},{id:'e',isEliminated:true,shield:false,handCount:1,discardPile:[]},{id:'h',isEliminated:false,shield:true,handCount:1,discardPile:[]},{id:'z',isEliminated:false,shield:false,handCount:0,discardPile:[]},{id:'ok',isEliminated:false,shield:false,handCount:1,discardPile:[]}]});
  assert.equal(d.targetId,'ok');
});
