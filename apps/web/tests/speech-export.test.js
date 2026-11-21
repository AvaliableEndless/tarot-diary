import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserSpeechRecognition } from '../src/services/speech-recognition.js';
import { createDiaryExport } from '../src/services/export-diary.js';
import { upsertRecord } from '../src/domain/diary.js';

test('unsupported speech recognition returns an explicit unsupported result', () => {
  assert.equal(createBrowserSpeechRecognition({ scope: {} }), null);
});
test('recognition separates final text from interim text and handles failure', () => {
  let instance;
  class Recognition {
    constructor() {
      instance = this;
    }
    start() {}
    stop() {}
    abort() {}
  }
  const final = [],
    interim = [],
    errors = [];
  const session = createBrowserSpeechRecognition({
    scope: { SpeechRecognition: Recognition },
    onFinal: (value) => final.push(value),
    onInterim: (value) => interim.push(value),
    onError: (value) => errors.push(value),
  });
  session.start();
  assert.equal(instance.lang, 'zh-CN');
  instance.onresult({
    resultIndex: 0,
    results: [
      Object.assign([{ transcript: '今天完成了' }], { isFinal: true }),
      Object.assign([{ transcript: '第一步' }], { isFinal: false }),
    ],
  });
  assert.deepEqual(final, ['今天完成了']);
  assert.deepEqual(interim, ['第一步']);
  instance.onerror({ error: 'network' });
  instance.onerror({ error: 'aborted' });
  assert.deepEqual(errors, ['network']);
  instance.onend();
  assert.equal(interim.at(-1), '');
});
test('export preserves user text and attaches the original recording', async () => {
  const records = upsertRecord([], '2026-11-21', {
    cardId: 18,
    text: '原话',
    status: 'noted',
    audioId: 'voice-1',
  });
  const result = await createDiaryExport(records, {
    readAudio: async (id) => {
      assert.equal(id, 'voice-1');
      return new Blob(['sound']);
    },
    encodeAudio: async (blob) =>
      `data:audio/webm;base64,${Buffer.from(await blob.text()).toString('base64')}`,
    now: '2026-11-21T12:00:00Z',
  });
  assert.equal(result.records[0].text, '原话');
  assert.equal(result.records[0].card, '星星');
  assert.equal(result.records[0].audio, 'data:audio/webm;base64,c291bmQ=');
});
test('export must fail visibly rather than silently omit a missing recording', async () => {
  const records = upsertRecord([], '2026-11-21', { text: '', status: 'noted', audioId: 'missing' });
  await assert.rejects(createDiaryExport(records, { readAudio: async () => undefined }), /missing/);
});
