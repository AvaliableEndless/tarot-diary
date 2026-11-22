import { test, expect } from '@playwright/test';

test('daily draw, yesterday review and editable journal survive refresh', async ({ page }) => {
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.revealed-card')).toBeVisible();
  const card = await page.locator('.revealed-card img').getAttribute('alt');
  await page.reload();
  await expect(page.locator('.revealed-card img')).toHaveAttribute('alt', card);

  await page.locator('.mobile-yesterday .yesterday-row').click();
  await page.getByRole('button', { name: '没有发生', exact: true }).click();
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await expect(page.locator('.modal-sheet')).toHaveCount(0);
  await expect(page.locator('.mobile-yesterday')).toContainText('没有发生');

  await page.getByRole('button', { name: '按住说话', exact: true }).click();
  await page.getByRole('textbox').fill('今天完成了可以试用的第一步。');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: '继续记录', exact: true }).click();
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('textbox')).toHaveValue('今天完成了可以试用的第一步。');
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('shinian-tarot-v1')));
  expect(records.find((record) => record.text.includes('可以试用')).status).toBe('noted');
  await page.locator('.bottom-nav').getByRole('button', { name: '回看', exact: true }).click();
  await page.locator('.history-section .entry').first().click();
  await expect(page.locator('.entry-detail')).toContainText('可以试用的第一步');
});

test('all 78 cards are searchable and browsing does not draw a card', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '打开牌库', exact: true }).click();
  await expect(page.locator('.collection-card')).toHaveCount(78);
  await page.getByRole('tab', { name: '圣杯', exact: true }).click();
  await expect(page.locator('.collection-card')).toHaveCount(14);
  await page.getByRole('tab', { name: '全部', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索牌名' }).fill('星星');
  await expect(page.locator('.collection-card')).toHaveCount(1);
  await page.locator('.collection-card').click();
  await expect(page.locator('.card-detail')).toContainText('星星');
  await page.getByRole('button', { name: '关闭牌意', exact: true }).click();
  await page.locator('.bottom-nav').getByRole('button', { name: '今天', exact: true }).click();
  await expect(page.locator('.draw-button')).toBeVisible();
});

test('corrupted stored data is not silently replaced', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('shinian-tarot-v1', '{keep-this-broken-backup'));
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.locator('.draw-button').click();
  await expect(page.locator('.toast')).toContainText('没有保存成功');
  expect(await page.evaluate(() => localStorage.getItem('shinian-tarot-v1'))).toBe(
    '{keep-this-broken-backup',
  );
});

test('a failed text write leaves the editor and draft available', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '按住说话', exact: true }).click();
  await page.getByRole('textbox').fill('这句话不能因为保存失败而丢失。');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await expect(page.locator('.record-error')).toContainText('没有保存成功');
  await expect(page.getByRole('textbox')).toHaveValue('这句话不能因为保存失败而丢失。');
  await expect(page.locator('.save-button')).toBeEnabled();
});

test('the next local day allows a new card without changing yesterday', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-21T23:59:50+08:00') });
  await page.goto('/');
  await page.locator('.draw-button').click();
  await page.clock.runFor(1000);
  await expect(page.locator('.revealed-card')).toBeVisible();
  const before = await page.locator('.revealed-card img').getAttribute('alt');
  await page.clock.runFor(31_000);
  await expect(page.locator('.draw-button')).toBeVisible();
  await page.locator('.draw-button').click();
  await page.clock.runFor(1000);
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('shinian-tarot-v1')));
  expect(records.some((record) => record.date === '2026-11-22' && record.cardId)).toBe(true);
  expect(records.some((record) => record.date === '2026-11-21' && record.cardId)).toBe(true);
  await page.locator('.mobile-yesterday .yesterday-row').click();
  await expect(page.locator('.record-question img')).toHaveAttribute('alt', before.split(' · ')[0]);
});

test.describe('audio capture', () => {
  test.use({ permissions: ['microphone'] });
  test('recorder initialization failure releases the microphone', async ({ page }) => {
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (options) => {
        const stream = await original(options);
        window.testCapturedStream = stream;
        return stream;
      };
      window.MediaRecorder = class {
        constructor() {
          throw new Error('unsupported encoder');
        }
      };
    });
    await page.goto('/');
    await page.getByRole('button', { name: '按住说话', exact: true }).click();
    await page.getByRole('button', { name: '开始录音', exact: true }).click();
    await expect(page.locator('.record-error')).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.testCapturedStream.getTracks().every((track) => track.readyState === 'ended'),
      ),
    ).toBe(true);
    await expect(page.getByRole('textbox')).toBeEnabled();
  });
  test('real recorder pauses, persists original audio and exports it', async ({ page }) => {
    await page.addInitScript(() => {
      window.SpeechRecognition = undefined;
      window.webkitSpeechRecognition = undefined;
    });
    await page.goto('/');
    await page.getByRole('button', { name: '按住说话', exact: true }).click();
    await page.getByRole('button', { name: '开始录音', exact: true }).click();
    await expect(page.locator('.voice-space')).toHaveClass(/recording/);
    await page.getByRole('button', { name: '暂停录音', exact: true }).click();
    await expect(page.locator('.voice-space')).toHaveClass(/paused/);
    await page.getByRole('button', { name: '继续录音', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '结束录音', exact: true }).click();
    await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('.asr-note')).toContainText('不支持自动转写');
    await page.getByRole('textbox').fill('测试原始录音保存。');
    await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: '按住说话', exact: true }).click();
    await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
    await page.getByRole('button', { name: '设置与数据', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出全部记录/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/拾念-.*\.json$/);
    const stream = await download.createReadStream();
    let content = '';
    for await (const chunk of stream) content += chunk.toString();
    const exported = JSON.parse(content);
    expect(
      exported.records.some(
        (record) => record.text === '测试原始录音保存。' && record.audio?.startsWith('data:audio/'),
      ),
    ).toBe(true);
    await page.getByRole('button', { name: '关闭设置', exact: true }).click();
    await page.getByRole('button', { name: '按住说话', exact: true }).click();
    await page.getByRole('textbox').fill('');
    await page.getByRole('button', { name: '移除录音', exact: true }).click();
    await expect(page.locator('.save-button')).toBeDisabled();
    await page.getByRole('button', { name: '放弃本次修改', exact: true }).click();
    await page.getByRole('button', { name: '放弃并离开', exact: true }).click();
    await page.getByRole('button', { name: '按住说话', exact: true }).click();
    await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
    await expect(page.getByRole('textbox')).toHaveValue('测试原始录音保存。');
  });
});

for (const width of [320, 390, 768, 1440]) {
  test(`main screens fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const screen of ['home', 'drawn', 'record', 'history']) {
      const errors = [];
      const onError = (error) => errors.push(error.message);
      page.on('pageerror', onError);
      await page.goto(`/?preview=${screen}`);
      await expect(page.locator('h1')).toBeAttached();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
      page.off('pageerror', onError);
    }
  });
}

test('desktop uses header navigation and a two-column history view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/?preview=drawn');
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await expect(page.locator('.desktop-capture')).toBeVisible();
  const art = await page.locator('.card-area').boundingBox();
  const reading = await page.locator('.card-reading').boundingBox();
  expect(reading.x).toBeGreaterThanOrEqual(art.x + art.width);
  await page.locator('.desktop-nav').getByRole('button', { name: '回看', exact: true }).click();
  const calendar = await page.locator('.calendar-section').boundingBox();
  const entries = await page.locator('.history-section').boundingBox();
  expect(entries.x).toBeGreaterThan(calendar.x + calendar.width);
  await page.getByRole('searchbox', { name: '搜索记录' }).fill('散步');
  await expect(page.locator('.history-section .entry')).toHaveCount(1);
  await page.getByRole('combobox', { name: '记录状态' }).selectOption('pending');
  await expect(page.locator('.history-section .entry')).toHaveCount(0);
  await page.getByRole('button', { name: '清除筛选' }).click();
  await expect(page.locator('.history-section .entry')).toHaveCount(8);
});

test('card category tabs work with keyboard navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '打开牌库', exact: true }).click();
  const all = page.getByRole('tab', { name: '全部', exact: true });
  await all.focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '星币', exact: true })).toBeFocused();
  await expect(page.getByRole('tab', { name: '星币', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.collection-card')).toHaveCount(14);
  await page.keyboard.press('Home');
  await expect(all).toBeFocused();
  await expect(page.locator('.collection-card')).toHaveCount(78);
});

test('mobile history leaves room for records and expands filters on demand', async ({ page }) => {
  await page.goto('/?preview=history');
  await expect(page.getByRole('searchbox', { name: '搜索记录' })).toBeHidden();
  const entry = await page.locator('.history-section .entry').first().boundingBox();
  const nav = await page.locator('.bottom-nav').boundingBox();
  expect(entry.y + entry.height).toBeLessThanOrEqual(nav.y);
  await page.getByRole('button', { name: '展开记录筛选', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索记录' }).fill('散步');
  await expect(page.locator('.history-section .entry')).toHaveCount(1);
});

test('closing and reopening the dirty confirmation keeps keyboard focus inside', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '按住说话', exact: true }).click();
  await page.getByRole('textbox').fill('明天可以回来看。');
  await page.keyboard.press('Escape');
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole('button', { name: '继续记录', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(confirm.getByRole('button', { name: '放弃并离开', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
  await expect(page.getByRole('textbox')).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveValue('明天可以回来看。');
});

test('clearing an existing review result still requires discard confirmation', async ({ page }) => {
  await page.goto('/');
  await page.locator('.mobile-yesterday .yesterday-row').click();
  await page.getByRole('button', { name: '有这样的时刻', exact: true }).click();
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await expect(page.locator('.modal-sheet')).toHaveCount(0);
  await page.locator('.mobile-yesterday .yesterday-row').click();
  await page.getByRole('button', { name: '有这样的时刻', exact: true }).click();
  await expect(page.locator('.modal-sheet .save-button')).toBeDisabled();
  await page.getByRole('button', { name: '关闭记录', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('the save action remains visible with a reduced visual viewport', async ({ page }) => {
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 844, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { value: viewport });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '按住说话', exact: true }).click();
  await page.getByRole('textbox').fill('键盘打开后也要能保存。');
  await page.evaluate(() => {
    window.visualViewport.height = 400;
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).toHaveClass(/keyboard-open/);
  await expect(page.locator('.bottom-nav')).toBeHidden();
  const save = await page.locator('.inline-recorder .save-button').boundingBox();
  expect(save.y).toBeGreaterThanOrEqual(0);
  expect(save.y + save.height).toBeLessThanOrEqual(400);
  await page.evaluate(() => {
    window.visualViewport.scale = 2;
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).not.toHaveClass(/keyboard-open/);
  await page.evaluate(() => {
    window.visualViewport.scale = 1;
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).toHaveClass(/keyboard-open/);
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await expect(page.locator('.modal-sheet')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/keyboard-open/);
});

test('small landscape recorders scroll without hiding their save action', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/?preview=record');
  await expect(page.getByRole('textbox')).toBeAttached();
  const save = await page.locator('.modal-sheet .save-button').boundingBox();
  expect(save.y).toBeGreaterThanOrEqual(0);
  expect(save.y + save.height).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
