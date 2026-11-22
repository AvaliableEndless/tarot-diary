import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, getCard, symbolismSource } from '../src/domain/cards.js';
import symbolism from '../src/data/symbolism.json' with { type: 'json' };
import { createDemoRecords } from '../src/fixtures/demo-records.js';
import { validateRecords } from '../src/domain/diary.js';

test('the complete 78-card catalog has unique identities and questions', () => {
  assert.equal(cards.length, 78);
  assert.equal(new Set(cards.map((card) => card.id)).size, 78);
  assert.equal(new Set(cards.map((card) => card.image)).size, 78);
  assert.equal(new Set(cards.map((card) => card.question)).size, 78);
  for (const card of cards)
    for (const key of ['name', 'english', 'prompt', 'question', 'detail']) assert.ok(card[key]);
});
test('card groups contain 22 majors and four 14-card suits', () => {
  assert.equal(cards.filter((card) => card.suit === 'major').length, 22);
  for (const suit of ['wands', 'cups', 'swords', 'pentacles'])
    assert.equal(cards.filter((card) => card.suit === suit).length, 14);
  assert.equal(getCard(18).name, '星星');
});

test('each card has three sourced upright symbols and a short daily association', () => {
  assert.equal(symbolism.cards.length, 78);
  assert.equal(new Set(symbolism.cards.map((card) => card.id)).size, 78);
  assert.equal(symbolismSource.orientation, 'upright');
  for (const card of cards) {
    assert.equal(card.symbols.length, 3, card.name);
    assert.equal(new Set(card.symbols).size, 3, card.name);
    assert.ok(card.symbols.every((word) => typeof word === 'string' && word.length > 0));
    assert.ok(card.todayHint.length > 0 && card.todayHint.length <= 34, card.name);
    const source = new URL(card.meaningSource);
    assert.equal(source.origin, 'https://labyrinthos.co');
    const name = card.english.toLowerCase().replace('judgment', 'judgement').replaceAll(' ', '-');
    assert.ok(source.pathname.includes(name), `Source must refer to ${card.name}`);
  }
});

test('sourced symbols are separate from the retained open-ended reflection', () => {
  assert.deepEqual(getCard(18).symbols, ['希望', '信念', '复苏']);
  assert.deepEqual(getCard(21).symbols, ['内省', '审视', '觉醒']);
  assert.equal(
    getCard(21).detail,
    '旧的经历可以有新的解释。先记录今天的看法，也允许以后的自己继续改变。',
  );
  assert.notEqual(getCard(21).todayHint, getCard(21).detail);
});
test('sample records conform to the real schema and retain fixture provenance', () => {
  const fixtures = createDemoRecords();
  validateRecords(fixtures);
  assert.ok(fixtures.every((record) => record.demo));
});
