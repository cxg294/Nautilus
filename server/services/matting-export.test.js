import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { encode, decodeFrames } from 'modern-gif';
import { padMattingForGraphics } from './matting-export.js';

function pixels(width, height, color = [60, 120, 180, 255]) {
  return Buffer.from(Array.from({ length: width * height }, () => color).flat());
}

function assertPaddedPixels(actual, original, width, height, outputWidth, outputHeight) {
  const left = Math.floor((outputWidth - width) / 2);
  const top = Math.floor((outputHeight - height) / 2);
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const index = (y * outputWidth + x) * 4;
      if (x >= left && x < left + width && y >= top && y < top + height) {
        const sourceIndex = ((y - top) * width + x - left) * 4;
        if (original[sourceIndex + 3] === 0) {
          assert.equal(actual[index + 3], 0);
        } else {
          assert.deepEqual([...actual.subarray(index, index + 4)], [...original.subarray(sourceIndex, sourceIndex + 4)]);
        }
      } else {
        assert.equal(actual[index + 3], 0, '新增画布必须完全透明');
      }
    }
  }
}

test('PNG 所有余数情况均最小扩边，保留原像素及半透明边缘', async () => {
  for (let width = 1; width <= 8; width++) {
    for (let height = 1; height <= 8; height++) {
      const raw = pixels(width, height, [60, 120, 180, 127]);
      raw.set([240, 30, 10, 255], 0);
      const source = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
      const output = await padMattingForGraphics(source);
      const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, Math.ceil(width / 4) * 4);
      assert.equal(info.height, Math.ceil(height / 4) * 4);
      assertPaddedPixels(data, raw, width, height, info.width, info.height);
      if (width % 4 === 0 && height % 4 === 0) assert.strictEqual(output, source);
    }
  }
});

test('GIF 按每帧高度补齐，保留重复帧、时长、循环及透明边距', async () => {
  const width = 5;
  const height = 7;
  const frames = [
    { data: new Uint8ClampedArray(pixels(width, height, [255, 0, 0, 255])), delay: 100 },
    { data: new Uint8ClampedArray(pixels(width, height, [0, 0, 255, 255])), delay: 200 },
    { data: new Uint8ClampedArray(pixels(width, height, [0, 0, 255, 255])), delay: 300 }
  ];
  // 帧间移动的透明区域也必须保留，不能出现上一帧的残影。
  frames[0].data.fill(0, 0, width * 4);
  frames[1].data.fill(0, (height - 1) * width * 4);
  frames[2].data.set(frames[1].data);
  const source = Buffer.from(await encode({ width, height, frames, looped: true, loopCount: 2 }));
  const originalFrames = decodeFrames(source);
  const output = await padMattingForGraphics(source);
  const metadata = await sharp(output, { animated: true }).metadata();
  const originalMetadata = await sharp(source, { animated: true }).metadata();
  assert.equal(metadata.width, 8);
  assert.equal(metadata.pageHeight, 8);
  assert.equal(metadata.pages, 3);
  assert.equal(metadata.loop, originalMetadata.loop);
  assert.deepEqual(metadata.delay, [100, 200, 300]);
  const outputFrames = decodeFrames(output);
  outputFrames.forEach((frame, index) => {
    assertPaddedPixels(frame.data, originalFrames[index].data, width, height, 8, 8);
  });
});

test('符合尺寸的 GIF 保持原文件字节不变', async () => {
  const source = Buffer.from(await encode({
    width: 4, height: 8,
    frames: [{ data: new Uint8ClampedArray(pixels(4, 8)), delay: 100 }]
  }));
  assert.strictEqual(await padMattingForGraphics(source), source);
});

test('超限 PNG 先等比缩小，再补透明边，最终不超过 960×720', async () => {
  // 原尺寸、缩放后的素材尺寸、补边后的导出尺寸。
  const cases = [
    [1920, 1002, 960, 501, 960, 504],
    [1003, 2000, 361, 720, 364, 720],
    [1254, 1254, 720, 720, 720, 720],
    [1920, 1440, 960, 720, 960, 720],
    [961, 719, 960, 718, 960, 720],
    [959, 721, 958, 720, 960, 720],
    [1, 2000, 1, 720, 4, 720],
    [2000, 1, 960, 1, 960, 4],
    [959, 719, 959, 719, 960, 720],
    [960, 720, 960, 720, 960, 720]
  ];
  for (const [width, height, contentWidth, contentHeight, outputWidth, outputHeight] of cases) {
    const source = await sharp({ create: {
      width, height, channels: 4, background: { r: 60, g: 120, b: 180, alpha: 1 }
    } }).png().toBuffer();
    const output = await padMattingForGraphics(source);
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, outputWidth, `原图 ${width}×${height}`);
    assert.equal(info.height, outputHeight);
    assert.ok(info.width <= 960 && info.height <= 720);
    assert.equal(info.width % 4, 0);
    assert.equal(info.height % 4, 0);
    // 检查透明画布与实际素材边界，防止缩放和补边顺序颠倒。
    const left = Math.floor((outputWidth - contentWidth) / 2);
    const top = Math.floor((outputHeight - contentHeight) / 2);
    for (let y = 0; y < outputHeight; y++) {
      for (let x = 0; x < outputWidth; x++) {
        const inside = x >= left && x < left + contentWidth && y >= top && y < top + contentHeight;
        assert.equal(data[(y * outputWidth + x) * 4 + 3], inside ? 255 : 0);
      }
    }
    if (width === 960 && height === 720) assert.strictEqual(output, source);
  }
});

test('超限 GIF 按每帧等比缩小再补边，保留帧数、时长和循环', async () => {
  const source = Buffer.from(await encode({
    width: 1003, height: 750, looped: true, loopCount: 2,
    frames: [
      { data: new Uint8ClampedArray(pixels(1003, 750, [255, 0, 0, 255])), delay: 100 },
      { data: new Uint8ClampedArray(pixels(1003, 750, [0, 0, 255, 255])), delay: 200 }
    ]
  }));
  const output = await padMattingForGraphics(source);
  const metadata = await sharp(output, { animated: true }).metadata();
  const originalMetadata = await sharp(source, { animated: true }).metadata();
  assert.equal(metadata.width, 960);
  assert.equal(metadata.pageHeight, 720); // 每帧缩小至 960×718，再补上下各 1px。
  assert.equal(metadata.pages, 2);
  assert.deepEqual(metadata.delay, [100, 200]);
  assert.equal(metadata.loop, originalMetadata.loop);
  const frames = decodeFrames(output);
  frames.forEach((frame, index) => {
    const color = index === 0 ? [255, 0, 0, 255] : [0, 0, 255, 255];
    assert.equal(frame.data[3], 0);
    assert.equal(frame.data[(719 * 960) * 4 + 3], 0);
    assert.deepEqual([...frame.data.subarray(960 * 4, 960 * 4 + 4)], color);
  });
});
