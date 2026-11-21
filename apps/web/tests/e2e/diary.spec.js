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

  await page.getByRole('button', { name: '留一句，打开录音', exact: true }).click();
  await page.locator('#journal-text').fill('今天完成了可以试用的第一步。');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: '继续记录', exact: true }).click();
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await page.reload();
  await expect(page.locator('.today-quote')).toContainText('可以试用的第一步');
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
  await page.getByRole('textbox', { name: '搜索牌名' }).fill('星星');
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
  await page.getByRole('button', { name: '留一句，打开录音', exact: true }).click();
  await page.locator('#journal-text').fill('这句话不能因为保存失败而丢失。');
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await expect(page.locator('.record-error')).toContainText('没有保存成功');
  await expect(page.locator('#journal-text')).toHaveValue('这句话不能因为保存失败而丢失。');
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
  test('real recorder pauses, persists original audio and exports it', async ({ page }) => {
    await page.addInitScript(() => {
      window.SpeechRecognition = undefined;
      window.webkitSpeechRecognition = undefined;
    });
    await page.goto('/');
    await page.getByRole('button', { name: '留一句，打开录音', exact: true }).click();
    await page.getByRole('button', { name: '开始录音', exact: true }).click();
    await expect(page.locator('.voice-space')).toHaveClass(/recording/);
    await page.getByRole('button', { name: '暂停录音', exact: true }).click();
    await expect(page.locator('.voice-space')).toHaveClass(/paused/);
    await page.getByRole('button', { name: '继续录音', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '结束录音', exact: true }).click();
    await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('.asr-note')).toContainText('不支持自动转写');
    await page.locator('#journal-text').fill('测试原始录音保存。');
    await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: '留一句，打开录音', exact: true }).click();
    await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
    await page.getByRole('button', { name: '关闭记录', exact: true }).click();
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
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
      page.off('pageerror', onError);
    }
  });
}
