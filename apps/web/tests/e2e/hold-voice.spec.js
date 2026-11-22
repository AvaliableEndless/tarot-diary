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

async function hold(page, selector = '.capture-nav', expectedStarts = 1) {
  const button = page.locator(selector);
  const box = await button.boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await expect(page.locator('.inline-recorder.recording')).toBeVisible();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.voiceProbe.starts)).toBe(expectedStarts);
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
  await expect(page.locator('.live-transcript')).toContainText('今天想起一个');
  await page.mouse.up();
  await expect(page.locator('.live-transcript')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveValue('今天想起一个值得记录的念头。');
  await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
  await expectReleased(page);
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('textbox')).toHaveValue('今天想起一个值得记录的念头。');
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 640 },
]) {
  test(`card and transcription stay above the anchored microphone at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?preview=drawn');
    const before = await page.locator('.capture-nav').boundingBox();
    await hold(page);
    const after = await page.locator('.capture-nav').boundingBox();
    expect(after).toEqual(before);
    const layout = await page.evaluate(() => {
      const card = document.querySelector('.revealed-card');
      const prompt = document.querySelector('.daily-prompt').getBoundingClientRect();
      const transcript = document.querySelector('.live-transcript').getBoundingClientRect();
      const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
      return {
        cardOpacity: getComputedStyle(card).opacity,
        cardTop: card.getBoundingClientRect().top,
        promptBottom: prompt.bottom,
        transcriptTop: transcript.top,
        transcriptBottom: transcript.bottom,
        navTop: nav.top,
        focused: document.activeElement.tagName,
      };
    });
    expect(layout.cardOpacity).toBe('1');
    expect(layout.cardTop).toBeGreaterThan(0);
    expect(layout.transcriptTop).toBeGreaterThan(layout.promptBottom);
    expect(layout.transcriptBottom).toBeLessThanOrEqual(layout.navTop);
    expect(layout.focused).not.toBe('TEXTAREA');
    await page.mouse.up();
    await expect(page.getByRole('textbox')).toHaveValue('今天想起一个值得记录的念头。');
    expect(await page.evaluate(() => document.activeElement.tagName)).not.toBe('TEXTAREA');
  });
}

test('the inline microphone itself stays captured through permission and recording', async ({
  page,
}) => {
  await page.goto('/?preview=drawn');
  const original = await page.locator('.inline-microphone').boundingBox();
  await hold(page, '.inline-microphone');
  expect(await page.locator('.inline-microphone').boundingBox()).toEqual(original);
  await page.mouse.up();
  await expect(page.getByRole('textbox')).toHaveValue('今天想起一个值得记录的念头。');
  await expectReleased(page);
});

test('the waveform responds to audio samples and releases the generated audio stream', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (options) => {
      const capture = await original(options);
      capture.getTracks().forEach((track) => track.stop());
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const destination = context.createMediaStreamDestination();
      gain.gain.value = 0.35;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      await context.resume();
      window.testSignal = { context, oscillator, gain, stream: destination.stream };
      return destination.stream;
    };
  });
  await page.goto('/?preview=drawn');
  await hold(page);
  const paintedRows = () =>
    page.locator('.voice-waveform').evaluate((canvas) => {
      const data = canvas.getContext('2d').getImageData(0, 0, 640, 44).data;
      const rows = new Set();
      for (let index = 3; index < data.length; index += 4)
        if (data[index]) rows.add(Math.floor(index / 4 / 640));
      return rows.size;
    });
  await expect.poll(paintedRows).toBeGreaterThan(12);
  await page.evaluate(() => {
    window.testSignal.gain.gain.value = 0;
  });
  await expect.poll(paintedRows).toBeLessThan(6);
  await page.mouse.up();
  await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
  expect(
    await page.evaluate(() =>
      window.testSignal.stream.getTracks().every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    window.testSignal.oscillator.stop();
    await window.testSignal.context.close();
  });
});

test('canceling a second hold restores the unsaved text and original audio draft', async ({
  page,
}) => {
  await page.goto('/?preview=drawn');
  await hold(page);
  await page.mouse.up();
  await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('textbox').fill('这是没有保存的文字草稿。');
  const digest = () =>
    page.locator('.audio-review audio').evaluate(async (audio) => {
      const bytes = await (await fetch(audio.src)).arrayBuffer();
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))];
    });
  const original = await digest();
  const point = await hold(page, '.capture-nav', 2);
  await page.mouse.move(point.x, point.y - 100, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('textbox')).toHaveValue('这是没有保存的文字草稿。');
  await expect(page.locator('.audio-review audio')).toHaveAttribute('src', /^blob:/);
  expect(await digest()).toEqual(original);
  await expectReleased(page);
});

test('leaving an unsaved inline entry offers continue or discard', async ({ page }) => {
  await page.goto('/?preview=drawn');
  await page.getByRole('textbox').fill('先保留这条没有保存的草稿。');
  await page.locator('.bottom-nav').getByRole('button', { name: '回看', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await page.getByRole('button', { name: '继续记录', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveValue('先保留这条没有保存的草稿。');
  await page.locator('.bottom-nav').getByRole('button', { name: '回看', exact: true }).click();
  await page.getByRole('button', { name: '放弃并离开', exact: true }).click();
  await expect(page.locator('.history-layout')).toBeVisible();
});

test('a draft spanning midnight is saved to the day it started', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-22T23:59:50+08:00') });
  await page.goto('/');
  await page.getByRole('textbox').fill('午夜前开始写下的这一句。');
  await page.clock.runFor(31_000);
  await expect(page.locator('.inline-note-heading')).toContainText('昨天的一句话');
  await expect(page.getByRole('textbox')).toHaveValue('午夜前开始写下的这一句。');
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('shinian-tarot-v1')));
  expect(records.find((record) => record.date === '2026-11-22').text).toBe(
    '午夜前开始写下的这一句。',
  );
  await expect(page.getByRole('textbox')).toHaveValue('');
  await expect(page.locator('.inline-note-heading')).toContainText('此刻的一句话');
});

test('sliding upward cancels without changing an existing diary', async ({ page }) => {
  await page.goto('/');
  await page.locator('.capture-nav').click();
  await page.getByRole('textbox').fill('已有的记录需要保留。');
  await page.getByRole('button', { name: '留好这一刻', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('shinian-tarot-v1'));
  const point = await hold(page);
  await page.mouse.move(point.x, point.y - 100, { steps: 5 });
  await expect(page.locator('.inline-recorder')).toHaveClass(/is-cancelling/);
  await page.mouse.up();
  await expect(page.locator('.modal-sheet')).toHaveCount(0);
  await expectReleased(page);
  await expect(page.getByRole('textbox')).toHaveValue('已有的记录需要保留。');
  expect(await page.evaluate(() => localStorage.getItem('shinian-tarot-v1'))).toBe(saved);
});

test('short tap and keyboard open the editor without requesting a mic', async ({ page }) => {
  await page.goto('/');
  await page.locator('.capture-nav').click();
  await expect(page.getByRole('textbox')).toBeVisible();
  expect(await page.evaluate(() => window.voiceProbe.streams.length)).toBe(0);
  await page.locator('.capture-nav').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox')).toBeVisible();
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
  await expect(page.locator('.inline-voice-status')).toContainText('等待麦克风权限');
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
  await expect(page.getByRole('textbox')).toHaveValue('今天想起一个值得记录的念头。');
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
    await expect(page.locator('.inline-recorder')).toHaveAttribute('data-phase', 'idle');
    await expectReleased(page);
  });
}

test('touch capture stays on the page while recording inline', async ({ page, context }) => {
  await page.goto('/');
  const box = await page.locator('.capture-nav').boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect(page.locator('.inline-recorder.recording')).toBeVisible();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.voiceProbe.starts)).toBe(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByRole('textbox')).toHaveValue('今天想起一个值得记录的念头。');
  await expectReleased(page);
  await cdp.detach();
});
