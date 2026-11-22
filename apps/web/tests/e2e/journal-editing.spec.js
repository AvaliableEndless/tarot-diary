import { test, expect } from '@playwright/test';

test.use({ permissions: ['microphone'] });

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-22T12:00:00+08:00') });
  await page.addInitScript(() => {
    if (!localStorage.getItem('shinian-tarot-v1'))
      localStorage.setItem(
        'shinian-tarot-v1',
        JSON.stringify([
          {
            id: '2026-11-21',
            date: '2026-11-21',
            cardId: 18,
            text: '原先写下的一句话。',
            status: 'noted',
          },
        ]),
      );
    window.journalVoice = {
      instances: [],
      texts: ['第一段语音。', '第二段语音。', '第三段语音。'],
      streams: [],
    };
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await getMedia(options);
      window.journalVoice.streams.push(stream);
      return stream;
    };
    window.SpeechRecognition = class {
      constructor() {
        window.journalVoice.instances.push(this);
      }
      emit(text, final) {
        const result = Object.assign([{ transcript: text }], { isFinal: final });
        this.onresult?.({ resultIndex: 0, results: [result] });
      }
      start() {
        this.text = window.journalVoice.texts.shift();
        this.emit(this.text, false);
      }
      stop() {
        this.emit(this.text, true);
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    };
  });
});

async function openHistoryEditor(page) {
  await page
    .locator('.bottom-nav:visible, .desktop-nav:visible')
    .getByRole('button', { name: '回看', exact: true })
    .click();
  await page.locator('.history-section .entry').click();
  await page.getByRole('button', { name: '编辑记录', exact: true }).click();
  await expect(page.locator('#journal-text')).toBeVisible();
}

async function dictate(page, scope = '.modal-sheet') {
  const editor = page.locator(scope);
  await editor.getByRole('button', { name: /^(开始录音|追加语音)$/ }).click();
  await expect(editor.locator('.voice-space')).toHaveAttribute('data-phase', 'recording');
  await page.waitForTimeout(300);
  await editor.getByRole('button', { name: '结束录音', exact: true }).click();
  await expect(editor.getByRole('textbox')).toBeVisible();
}

async function records(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('shinian-tarot-v1')));
}

async function saveHistory(page) {
  await page.locator('.modal-sheet .save-button').click();
  await expect(page.locator('.modal-sheet')).toHaveCount(0);
}

test('history supports text-only editing without requesting a microphone', async ({ page }) => {
  await page.goto('/');
  await openHistoryEditor(page);
  const field = page.getByRole('textbox', { name: '记录内容', exact: true });
  await field.fill('直接打字，修改那天的记录。\n可以继续补充。');
  expect(await page.evaluate(() => window.journalVoice.streams.length)).toBe(0);
  await saveHistory(page);
  await page.reload();
  await openHistoryEditor(page);
  await expect(field).toHaveValue('直接打字，修改那天的记录。\n可以继续补充。');
  const saved = await records(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].date).toBe('2026-11-21');
  expect(saved[0].cardId).toBe(18);
});

test('repeated dictation appends to manual edits on one historical card and retains every clip', async ({
  page,
}) => {
  await page.goto('/');
  await openHistoryEditor(page);
  const field = page.locator('#journal-text');
  await field.fill('我亲手修改的开头。');
  await dictate(page);
  await expect(field).toHaveValue('我亲手修改的开头。\n第一段语音。');
  await field.fill('我亲手修改的开头。\n第一段已人工纠错。');
  await dictate(page);
  await expect(field).toHaveValue('我亲手修改的开头。\n第一段已人工纠错。\n第二段语音。');
  await page.evaluate(() => window.journalVoice.instances[0].emit('旧结果不该复原。', true));
  await expect(field).toHaveValue('我亲手修改的开头。\n第一段已人工纠错。\n第二段语音。');
  await expect(page.locator('.modal-sheet audio')).toHaveCount(2);
  await saveHistory(page);
  const firstSave = (await records(page))[0];
  expect(firstSave.audioIds).toHaveLength(2);
  await page.reload();
  await openHistoryEditor(page);
  await expect(page.locator('.modal-sheet audio')).toHaveCount(2);
  await page.evaluate(() => {
    window.journalVoice.texts = ['第三段语音。'];
  });
  await dictate(page);
  await expect(field).toHaveValue(
    '我亲手修改的开头。\n第一段已人工纠错。\n第二段语音。\n第三段语音。',
  );
  await saveHistory(page);
  const saved = await records(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].cardId).toBe(18);
  expect(saved[0].audioIds).toHaveLength(3);
  expect(saved[0].audioIds.slice(0, 2)).toEqual(firstSave.audioIds);
  const sizes = await page.evaluate(async (ids) => {
    const { getAudio } = await import('/src/services/audio-store.js');
    return Promise.all(ids.map(async (id) => (await getAudio(id))?.size));
  }, saved[0].audioIds);
  expect(sizes.every((size) => size > 0)).toBe(true);
});

test('today dictation preserves corrected text and can save several voices without leaving the page', async ({
  page,
}) => {
  await page.goto('/');
  const field = page.locator('#today-journal-text');
  await field.fill('今天先写文字。');
  await dictate(page, '.journal-slot');
  await field.fill('今天先写文字。\n人工修正第一段。');
  await dictate(page, '.journal-slot');
  const expected = '今天先写文字。\n人工修正第一段。\n第二段语音。';
  await expect(field).toHaveValue(expected);
  await page.locator('.journal-slot .save-button').click();
  await expect(page.locator('.toast')).toContainText('留好了');
  await expect(page.locator('.journal-slot .save-button')).toBeDisabled();
  await page.reload();
  await expect(field).toHaveValue(expected);
  const saved = (await records(page)).find((item) => item.date === '2026-11-22');
  expect(saved.audioIds).toHaveLength(2);
});

test('recognition arriving after finalization cannot overwrite a manual correction', async ({
  page,
}) => {
  await page.goto('/');
  await openHistoryEditor(page);
  await page.getByRole('button', { name: '追加语音', exact: true }).click();
  await expect(page.locator('.modal-sheet .recording')).toBeVisible();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.journalVoice.instances[0].stop = () => {};
  });
  await page.getByRole('button', { name: '结束录音', exact: true }).click();
  await page.clock.runFor(1500);
  const field = page.locator('#journal-text');
  await expect(field).toBeVisible();
  await field.fill('我已手动修正，请保留这一版。');
  await page.evaluate(() => {
    window.journalVoice.instances[0].emit('迟到的旧识别内容。', true);
    window.journalVoice.instances[0].onend?.();
  });
  await expect(field).toHaveValue('我已手动修正，请保留这一版。');
});

test('history long press can cancel a second voice without losing edited text or the first clip', async ({
  page,
}) => {
  await page.goto('/');
  await openHistoryEditor(page);
  await dictate(page);
  await page.locator('#journal-text').fill('第一段我已手动修改。');
  const button = page.locator('.history-editor .inline-microphone');
  const box = await button.boundingBox();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(page.locator('.history-editor.recording')).toBeVisible();
  const heldBox = await button.boundingBox();
  expect(Math.abs(heldBox.y - box.y)).toBeLessThanOrEqual(1);
  await page.mouse.move(x, y - 100);
  await page.mouse.up();
  await expect(page.locator('#journal-text')).toHaveValue('第一段我已手动修改。');
  await expect(page.locator('.modal-sheet audio')).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      window.journalVoice.streams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === 'ended'),
      ),
    ),
  ).toBe(true);
});

test('a failed append save preserves the previous recording and can retry with all clips', async ({
  page,
}) => {
  await page.goto('/');
  await openHistoryEditor(page);
  await dictate(page);
  await saveHistory(page);
  const original = (await records(page))[0];
  await openHistoryEditor(page);
  await page.locator('#journal-text').fill('人工改好的正文。');
  await dictate(page);
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    window.failJournalSave = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'shinian-tarot-v1' && window.failJournalSave)
        throw new DOMException('quota', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.locator('.modal-sheet .save-button').click();
  await expect(page.locator('.modal-sheet .record-error')).toContainText('没有保存成功');
  await expect(page.locator('#journal-text')).toHaveValue('人工改好的正文。\n第二段语音。');
  expect((await records(page))[0].audioIds).toEqual(original.audioIds);
  await expect(page.locator('.modal-sheet audio')).toHaveCount(2);
  await page.evaluate(() => {
    window.failJournalSave = false;
  });
  await saveHistory(page);
  const saved = (await records(page))[0];
  expect(saved.audioIds).toHaveLength(2);
  expect(saved.audioIds[0]).toBe(original.audioIds[0]);
  const sizes = await page.evaluate(async (ids) => {
    const { getAudio } = await import('/src/services/audio-store.js');
    return Promise.all(ids.map(async (id) => (await getAudio(id))?.size));
  }, saved.audioIds);
  expect(sizes.every((size) => size > 0)).toBe(true);
});

test('removing one clip keeps the text and other clip; deleting the day cleans up all saved clips', async ({
  page,
}) => {
  await page.goto('/');
  await openHistoryEditor(page);
  await dictate(page);
  await dictate(page);
  await saveHistory(page);
  const original = (await records(page))[0];
  await openHistoryEditor(page);
  await page.locator('.modal-sheet .audio-clip-group summary').click();
  await page.getByRole('button', { name: '移除录音 1', exact: true }).click();
  await expect(page.locator('#journal-text')).toHaveValue(original.text);
  await saveHistory(page);
  const saved = (await records(page))[0];
  expect(saved.audioIds).toEqual([original.audioIds[1]]);
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const { getAudio } = await import('/src/services/audio-store.js');
        return (await getAudio(id)) === undefined;
      }, original.audioIds[0]),
    )
    .toBe(true);
  await page.locator('.history-section .entry').click();
  await page.getByRole('button', { name: '删除这条记录', exact: true }).click();
  await page.getByRole('button', { name: '删除记录', exact: true }).click();
  expect(await records(page)).toHaveLength(0);
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const { getAudio } = await import('/src/services/audio-store.js');
        return (await getAudio(id)) === undefined;
      }, saved.audioIds[0]),
    )
    .toBe(true);
});

test('an existing single-recording diary can append a voice without losing the old audio', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { putAudio } = await import('/src/services/audio-store.js');
    await putAudio('legacy-voice', new Blob(['legacy original'], { type: 'audio/webm' }));
    const saved = JSON.parse(localStorage.getItem('shinian-tarot-v1'));
    saved[0].audioId = 'legacy-voice';
    localStorage.setItem('shinian-tarot-v1', JSON.stringify(saved));
  });
  await page.reload();
  await openHistoryEditor(page);
  await expect(page.locator('.modal-sheet audio')).toHaveAttribute('src', /^blob:/);
  await dictate(page);
  await saveHistory(page);
  const saved = (await records(page))[0];
  expect(saved.audioIds).toHaveLength(2);
  expect(saved.audioIds[0]).toBe('legacy-voice');
  expect(saved.audioId).toBe('legacy-voice');
  expect(saved.cardId).toBe(18);
  expect(saved.text).toBe('原先写下的一句话。\n第一段语音。');
  expect(
    await page.evaluate(async () => {
      const { getAudio } = await import('/src/services/audio-store.js');
      return (await getAudio('legacy-voice')).text();
    }),
  ).toBe('legacy original');
});

for (const viewport of [
  { width: 320, height: 640 },
  { width: 1440, height: 960 },
]) {
  test(`the combined editor keeps text, audio and save controls separate at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await openHistoryEditor(page);
    await dictate(page);
    await dictate(page);
    const field = await page.locator('#journal-text').boundingBox();
    const playback = await page.locator('.modal-sheet .inline-playback').boundingBox();
    const save = await page.locator('.modal-sheet .save-button').boundingBox();
    expect(field.y + field.height).toBeLessThanOrEqual(playback.y + 1);
    expect(save.y).toBeGreaterThanOrEqual(0);
    expect(save.y + save.height).toBeLessThanOrEqual(viewport.height - 8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.modal-sheet .audio-clip-group summary').click();
    await expect(page.locator('.modal-sheet audio').first()).toBeVisible();
    const attachmentsFit = await page
      .locator('.modal-sheet .audio-clips')
      .evaluate((element) => element.scrollHeight <= element.clientHeight + 1);
    expect(attachmentsFit).toBe(true);
  });
}
