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

test('reduced motion shows a visible gentle crossfade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('shinian-motion-v1', 'system'));
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toHaveAttribute('data-motion', 'gentle');
  await expect(page.locator('.draw-transition')).toHaveAttribute('data-phase', 'reveal');
  await expect(page.locator('.draw-front')).toHaveCSS('animation-name', 'draw-soft-in');
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await expect(page.locator('.revealed-card')).toBeVisible();
  expect(await savedDraw(page)).toHaveLength(1);
});

test('full motion overrides system reduction without Web Animations and replays the saved card', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Element.prototype.animate = undefined;
  });
  await page.goto('/');
  await page.getByRole('button', { name: '设置与数据', exact: true }).click();
  await page.getByRole('combobox', { name: '抽牌动效', exact: true }).selectOption('full');
  await page.getByRole('button', { name: '关闭设置', exact: true }).click();
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveAttribute('data-motion-mode', 'full');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toHaveAttribute('data-phase', 'shuffle');
  await expect(page.locator('.draw-flight')).toHaveCSS('animation-duration', '0.48s');
  await expect(page.locator('.draw-transition')).toHaveAttribute('data-phase', 'reveal');
  await expect(page.locator('.draw-flight')).toHaveCSS('animation-duration', '1.1s');
  const before = await savedDraw(page);
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await page.getByRole('button', { name: '按住说话', exact: true }).click();
  await page.getByRole('textbox').fill('重播时保留这句话。');
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await page.getByRole('button', { name: /重播.*牌/, exact: true }).click();
  await expect(page.locator('.draw-transition')).toHaveAttribute('data-phase', 'reveal');
  await expect(page.getByRole('textbox')).toHaveValue('重播时保留这句话。');
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  const after = await savedDraw(page);
  expect(after).toHaveLength(1);
  expect(after[0].cardId).toBe(before[0].cardId);
  expect(after[0].text).toBe('重播时保留这句话。');
});

test('recording can open during the motion with the same saved card', async ({ page }) => {
  await page.goto('/');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toBeVisible();
  const saved = await savedDraw(page);
  await page.getByRole('button', { name: '按住说话', exact: true }).click();
  await expect(page.locator('.draw-transition')).toHaveCount(0);
  await expect(page.locator('.revealed-card img')).toHaveAttribute(
    'src',
    `/cards/${String(saved[0].cardId).padStart(2, '0')}.webp`,
  );
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await expect(page.locator('.revealed-card')).toBeVisible();
});

test('turning on reduced motion interrupts a running draw safely', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shinian-motion-v1', 'system'));
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

test('the requested complete draw is the default even with system motion reduction', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-motion-mode', 'full');
  await page.locator('.draw-button').click();
  await expect(page.locator('.draw-transition')).toHaveAttribute('data-phase', 'shuffle');
  await page.getByRole('button', { name: '跳过抽卡动画', exact: true }).click();
});

for (const width of [390, 1440]) {
  test(`replay includes the moving three-card deck at ${width}px even in gentle mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('shinian-motion-v1', 'gentle'));
    await page.goto('/?preview=drawn');
    const originalCard = await page.locator('.revealed-card img').getAttribute('src');
    await page.getByRole('button', { name: /重播.*牌/, exact: true }).click();
    const motion = page.locator('.draw-transition');
    await expect(motion).toHaveAttribute('data-motion', 'full');
    await expect(motion).toHaveAttribute('data-phase', 'shuffle');
    await expect(motion.locator('.draw-side')).toHaveCount(2);
    await expect(page.locator('.card-reading')).toBeHidden();
    const movement = await motion.evaluate((root) => {
      const cards = [...root.querySelectorAll('.draw-side')];
      const animations = root.getAnimations({ subtree: true });
      animations.forEach((animation) => {
        animation.pause();
        animation.currentTime = 0;
      });
      const centers = () =>
        cards.map((card) => {
          const box = card.getBoundingClientRect();
          return box.x + box.width / 2;
        });
      const initial = centers();
      animations.forEach((animation) => {
        animation.currentTime = 200;
      });
      const spread = centers();
      const bounds = cards.map((card) => card.getBoundingClientRect());
      const skip = document.querySelector('.skip-draw').getBoundingClientRect();
      const deckBounds = [...bounds, root.querySelector('.draw-flight').getBoundingClientRect()];
      animations.forEach((animation) => animation.play());
      return {
        leftTravel: initial[0] - spread[0],
        rightTravel: spread[1] - initial[1],
        imagesLoaded: cards.every((card) => card.complete && card.naturalWidth > 0),
        inViewport: bounds.every((box) => box.left >= 0 && box.right <= innerWidth),
        skipClear: deckBounds.every(
          (box) =>
            skip.right <= box.left ||
            skip.left >= box.right ||
            skip.bottom <= box.top ||
            skip.top >= box.bottom,
        ),
      };
    });
    expect(movement.imagesLoaded).toBe(true);
    expect(movement.inViewport).toBe(true);
    expect(movement.skipClear).toBe(true);
    expect(movement.leftTravel).toBeGreaterThan(12);
    expect(movement.rightTravel).toBeGreaterThan(12);
    await expect(motion).toHaveCount(0);
    await expect(page.locator('.card-reading')).toBeVisible();
    await expect(page.locator('.revealed-card img')).toHaveAttribute('src', originalCard);
    expect(await page.evaluate(() => localStorage.getItem('shinian-motion-v1'))).toBe('gentle');
  });
}

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
