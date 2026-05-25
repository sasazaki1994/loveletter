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

test("chooseBotAction avoids guessed rank 1", () => {
  const d = chooseBotAction({ selfId:'s', hand:['sentinel','oracle'], players:[{id:'s',isEliminated:false,shield:false,handCount:2,discardPile:[]},{id:'t',isEliminated:false,shield:false,handCount:1,discardPile:[]}]});
  assert.equal(d.cardId,'sentinel');
  assert.equal(d.guessedRank,2);
  assert.equal(d.targetId,'t');
});

test("chooseBotAction avoids eliminated/shield targets", () => {
  const d = chooseBotAction({ selfId:'s', hand:['oracle','emissary'], players:[{id:'s',isEliminated:false,shield:false,handCount:2,discardPile:[]},{id:'e',isEliminated:true,shield:false,handCount:0,discardPile:[]},{id:'h',isEliminated:false,shield:true,handCount:1,discardPile:[]},{id:'ok',isEliminated:false,shield:false,handCount:1,discardPile:[]}]});
  assert.equal(d.targetId,'ok');
});
