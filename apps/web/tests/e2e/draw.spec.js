import { test, expect } from '@playwright/test';

async function savedDraw(page) {
  return page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return JSON.parse(localStorage.getItem('shinian-tarot-v1')).filter(
      (record) => record.date === date,
    );
  });
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('the actual saved card is decoded, shuffled, flipped and placed', async ({ page }) => {
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toBeVisible();
  await expect(page.locator('.draw-button')).toBeDisabled();
  const saved = await savedDraw(page);
  expect(saved).toHaveLength(1);
  await expect(page.locator('.card-area')).toHaveClass(/draw-shuffle/);
  expect(
    await page.locator('.draw-front').evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
  await expect(page.locator('.card-area')).toHaveClass(/draw-reveal/);
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.draw-front')).opacity) > 0.5,
  );
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await expect(page.locator('.revealed-card')).toBeVisible();
  await expect(page.locator('.revealed-card img')).toHaveAttribute(
    'src',
    `/cards/${String(saved[0].cardId).padStart(2, '0')}.webp`,
  );
  await expect(page.locator('.daily-stage')).toHaveAttribute('aria-busy', 'false');
  expect((await savedDraw(page))[0].cardId).toBe(saved[0].cardId);
});

test('rapid clicks and skipping cannot reroll the day', async ({ page }) => {
  await page.goto('/');
  await page.locator('.draw-button').evaluate((button) => {
    button.click();
    button.click();
  });
  const saved = await savedDraw(page);
  expect(saved).toHaveLength(1);
  await page.getByRole('button', { name: '跳过抽卡动画', exact: true }).click();
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await expect(page.locator('.revealed-card')).toBeVisible();
  await page.reload();
  await expect(page.locator('.revealed-card img')).toHaveAttribute(
    'src',
    `/cards/${String(saved[0].cardId).padStart(2, '0')}.webp`,
  );
  await expect(page.locator('.draw-transition')).toHaveCount(0);
});

test('leaving the page ends the motion and keeps the saved result', async ({ page }) => {
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toBeVisible();
  const saved = await savedDraw(page);
  await page.locator('.bottom-nav').getByRole('button', { name: '回看', exact: true }).click();
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await page.locator('.bottom-nav').getByRole('button', { name: '今天', exact: true }).click();
  await expect(page.locator('.revealed-card img')).toHaveAttribute(
    'src',
    `/cards/${String(saved[0].cardId).padStart(2, '0')}.webp`,
  );
});

test('reduced motion reveals the result immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await expect(page.locator('.revealed-card')).toBeVisible();
  expect(await savedDraw(page)).toHaveLength(1);
});

test('recording can open during the motion with the same saved card', async ({ page }) => {
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toBeVisible();
  const saved = await savedDraw(page);
  await page.getByRole('button', { name: '留一句，打开录音', exact: true }).click();
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await expect(page.locator('.record-question img')).toHaveAttribute(
    'src',
    `/cards/${String(saved[0].cardId).padStart(2, '0')}.webp`,
  );
  await page.getByRole('button', { name: '关闭记录', exact: true }).click();
  await expect(page.locator('.revealed-card')).toBeVisible();
});

test('turning on reduced motion interrupts a running draw safely', async ({ page }) => {
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toBeVisible();
  const saved = await savedDraw(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await expect(page.locator('.revealed-card img')).toHaveAttribute(
    'src',
    `/cards/${String(saved[0].cardId).padStart(2, '0')}.webp`,
  );
});

test('a slow image is never turned over before decoding', async ({ page }) => {
  await page.addInitScript(() => {
    crypto.getRandomValues = (array) => {
      array.fill(21);
      return array;
    };
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/cards/22.webp', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/');
    await page.locator('.draw-button').click();
    await expect(page.locator('.card-area')).toHaveClass(/draw-loading/);
    await expect(page.locator('.draw-front')).toHaveCSS('opacity', '0');
    expect((await savedDraw(page))[0].cardId).toBe(22);
    release();
    await expect(page.locator('.draw-transition')).toHaveCount(0);
    await expect(page.locator('.revealed-card img')).toHaveAttribute('src', '/cards/22.webp');
  } finally {
    release();
  }
});

test('an image failure keeps the same draw and restores usable controls', async ({ page }) => {
  await page.addInitScript(() => {
    crypto.getRandomValues = (array) => {
      array.fill(21);
      return array;
    };
  });
  await page.route('**/cards/22.webp', (route) => route.abort());
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await expect(page.locator('.card-reading')).toContainText('世界');
  await expect(page.locator('.toast')).toContainText('牌已保存');
  expect((await savedDraw(page))[0].cardId).toBe(22);
  await expect(page.locator('.today-record-button')).toBeEnabled();
});
