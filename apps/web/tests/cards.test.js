import assert from 'node:assert/strict';
import test from 'node:test';
import { cards, getCard } from '../src/domain/cards.js';
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
test('sample records conform to the real schema and retain fixture provenance', () => {
  const fixtures = createDemoRecords();
  validateRecords(fixtures);
  assert.ok(fixtures.every((record) => record.demo));
});
