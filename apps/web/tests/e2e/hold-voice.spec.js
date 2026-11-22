import { test, expect } from '@playwright/test';

test.use({ permissions: ['microphone'] });

// Exercise API timing with a fake recognizer; real MediaRecorder uses Chromium's fake mic.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.voiceProbe = { starts: 0, stops: 0, aborts: 0, streams: [] };
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await original(options);
      window.voiceProbe.streams.push(stream);
      return stream;
    };
    window.SpeechRecognition = class {
      emit(text, final) {
        const result = [{ transcript: text }];
        result.isFinal = final;
        this.onresult?.({ resultIndex: 0, results: [result] });
      }
      start() {
        window.voiceProbe.starts++;
        this.emit('今天想起一个', false);
      }
      stop() {
        window.voiceProbe.stops++;
        setTimeout(() => {
          this.emit('今天想起一个值得记录的念头。', true);
          this.onend?.();
        }, 160);
      }
      abort() {
        window.voiceProbe.aborts++;
        this.onend?.();
      }
    };
  });
});

async function hold(page, selector = '.capture-nav') {
  const button = page.locator(selector);
  const box = await button.boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(page.locator('.hold-recording')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.voiceProbe.starts)).toBe(1);
  return point;
}

async function expectReleased(page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.voiceProbe.streams.length > 0 &&
          window.voiceProbe.streams.every((stream) =>
            stream.getTracks().every((track) => track.readyState === 'ended'),
          ),
      ),
    )
    .toBe(true);
}

test('long press starts recognition directly; release keeps the final words and audio', async ({
  page,
}) => {
  await page.goto('/');
  await hold(page);
  await expect(page.locator('.hold-transcript')).toContainText('今天想起一个');
  await page.mouse.up();
  await expect(page.locator('.hold-recording')).toHaveCount(0);
  await expect(page.locator('#journal-text')).toHaveValue('今天想起一个值得记录的念头。');
  await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
  await expectReleased(page);
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await page.reload();
  await expect(page.locator('.today-quote')).toContainText('值得记录的念头');
});

test('sliding upward cancels without changing an existing diary', async ({ page }) => {
  await page.goto('/');
  await page.locator('.capture-nav').click();
  await page.locator('#journal-text').fill('已有的记录需要保留。');
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('shinian-tarot-v1'));
  const point = await hold(page);
  await page.mouse.move(point.x, point.y - 100, { steps: 5 });
  await expect(page.locator('.hold-recording')).toHaveClass(/hold-cancel/);
  await page.mouse.up();
  await expect(page.locator('.modal-sheet')).toHaveCount(0);
  await expectReleased(page);
  expect(await page.evaluate(() => localStorage.getItem('shinian-tarot-v1'))).toBe(saved);
});

test('short tap and keyboard open the editor without requesting a mic', async ({ page }) => {
  await page.goto('/');
  await page.locator('.capture-nav').click();
  await expect(page.locator('#journal-text')).toBeVisible();
  expect(await page.evaluate(() => window.voiceProbe.streams.length)).toBe(0);
  await page.getByRole('button', { name: '关闭记录', exact: true }).click();
  await page.locator('.capture-nav').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#journal-text')).toBeVisible();
  expect(await page.evaluate(() => window.voiceProbe.starts)).toBe(0);
});

test('a permission response after release cannot start recording', async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (options) => {
      await new Promise((resolve) => {
        window.releaseMic = resolve;
      });
      return original(options);
    };
  });
  await page.goto('/');
  const box = await page.locator('.capture-nav').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('.hold-heading')).toContainText('等待麦克风权限');
  await page.mouse.up();
  await page.evaluate(() => window.releaseMic());
  await expectReleased(page);
  expect(await page.evaluate(() => window.voiceProbe.starts)).toBe(0);
  await expect(page.locator('.record-error')).toContainText('麦克风已准备好');
  await expect(page.locator('.voice-space')).toHaveClass(/idle/);
});

test('desktop header supports the same single hold gesture', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await hold(page, '.desktop-capture');
  await page.mouse.up();
  await expect(page.locator('#journal-text')).toHaveValue('今天想起一个值得记录的念头。');
  await expectReleased(page);
});

for (const interruption of ['pointercancel', 'blur']) {
  test(`${interruption} cancels the hold and stops the mic`, async ({ page }) => {
    await page.goto('/');
    await hold(page);
    if (interruption === 'pointercancel')
      await page.locator('.capture-nav').dispatchEvent('pointercancel', { pointerId: 1 });
    else await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.mouse.up();
    await expect(page.locator('.modal-sheet')).toHaveCount(0);
    await expectReleased(page);
  });
}

test('touch capture remains held while the recording HUD opens', async ({ page, context }) => {
  await page.goto('/');
  const box = await page.locator('.capture-nav').boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect(page.locator('.hold-recording')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.voiceProbe.starts)).toBe(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#journal-text')).toHaveValue('今天想起一个值得记录的念头。');
  await expectReleased(page);
  await cdp.detach();
});
