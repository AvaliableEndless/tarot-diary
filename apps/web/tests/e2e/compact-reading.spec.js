import { test, expect } from '@playwright/test';
import { cards } from '../../src/domain/cards.js';

async function showCard(page, cardId) {
  await page.evaluate((id) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const value = JSON.stringify([{ id: date, date, cardId: id, text: '', status: 'pending' }]);
    localStorage.setItem('shinian-tarot-v1', value);
    window.dispatchEvent(new StorageEvent('storage', { key: 'shinian-tarot-v1', newValue: value }));
  }, cardId);
}

test('drawn card shows symbols and one daily association, with details behind an icon', async ({
  page,
}) => {
  await page.goto('/?preview=drawn');
  await expect(page.locator('.card-reading h2')).toHaveText('星星');
  await expect(page.locator('.card-symbols')).toHaveText('常见象征希望 · 信念 · 复苏');
  await expect(page.locator('.daily-prompt')).toContainText('也许会带来期待');
  await expect(page.locator('.is-drawn .card-caption')).toHaveCount(0);
  await expect(page.locator('.reading-kicker, .saved-card-label, .meaning-toggle')).toHaveCount(0);
  await expect(page.locator('.card-reading')).not.toContainText('今天的牌，已为你留好');
  await page.getByRole('button', { name: '查看星星牌义与来源', exact: true }).click();
  await expect(page.locator('.detail-symbolism')).toContainText('希望 · 信念 · 复苏');
  await expect(page.getByRole('link', { name: 'Labyrinthos · 正位释义' })).toHaveAttribute(
    'href',
    'https://labyrinthos.co/blogs/tarot-card-meanings-list/the-star-meaning-major-arcana-tarot-card-meanings',
  );
  await expect(page.locator('.detail-reflection h3')).toHaveText('今日联想');
});

test('Judgement retains the requested reflection in the detail view', async ({ page }) => {
  await page.goto('/');
  await showCard(page, 21);
  await expect(page.locator('.card-reading h2')).toHaveText('审判');
  await expect(page.locator('.daily-prompt')).toHaveText('今天，一件旧事或许会让你有新的理解。');
  await expect(page.locator('.card-reading')).not.toContainText('允许以后的自己继续改变');
  await page.getByRole('button', { name: '查看审判牌义与来源', exact: true }).click();
  await expect(page.locator('.detail-reflection')).toContainText(
    '旧的经历可以有新的解释。先记录今天的看法，也允许以后的自己继续改变。',
  );
});

test('all 78 cards keep a compact reading and clear tool targets at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  for (const card of cards) {
    await showCard(page, card.id);
    await expect(page.locator('.card-reading h2')).toHaveText(card.name);
    const layout = await page.locator('.card-reading').evaluate((reading) => {
      const title = reading.querySelector('h2').getBoundingClientRect();
      const tools = reading.querySelector('.card-tools').getBoundingClientRect();
      const hint = reading.querySelector('.daily-prompt');
      const symbols = reading.querySelector('.card-symbols');
      return {
        hintLines:
          hint.getBoundingClientRect().height / parseFloat(getComputedStyle(hint).lineHeight),
        symbolLines:
          symbols.getBoundingClientRect().height / parseFloat(getComputedStyle(symbols).lineHeight),
        titleClear: title.right <= tools.left,
        height: reading.getBoundingClientRect().height,
        fits: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    expect(layout.titleClear, card.name).toBe(true);
    expect(layout.fits, card.name).toBe(true);
    expect(layout.symbolLines, card.name).toBeLessThan(1.1);
    expect(layout.hintLines, card.name).toBeLessThan(2.1);
    expect(layout.height, card.name).toBeLessThan(210);
  }
});
