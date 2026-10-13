import sharp from 'sharp';

/** 先等比缩小到 960×720 内，再最小透明扩边至 4 的倍数。 */
export async function padMattingForGraphics(source) {
  const image = sharp(source, { animated: true });
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.pageHeight || metadata.height;
  if (!width || !height) throw new Error('无法读取导出图片尺寸');

  const scale = Math.min(1, 960 / width, 720 / height);
  // 像素尺寸取整，极窄 / 极扁图片也至少保留 1px。
  const resizedWidth = Math.max(1, Math.round(width * scale));
  const resizedHeight = Math.max(1, Math.round(height * scale));
  const extraWidth = (4 - resizedWidth % 4) % 4;
  const extraHeight = (4 - resizedHeight % 4) % 4;
  if (scale === 1 && extraWidth === 0 && extraHeight === 0) return source;

  if (scale < 1) {
    image.resize({ width: resizedWidth, height: resizedHeight, fit: 'fill' });
  }
  // 960 和 720 本身均为 4 的倍数，补边后仍不会超限。
  // 居中分配，奇数余量放在右侧 / 下侧。
  const padded = image.ensureAlpha().extend({
    left: Math.floor(extraWidth / 2),
    right: Math.ceil(extraWidth / 2),
    top: Math.floor(extraHeight / 2),
    bottom: Math.ceil(extraHeight / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  });

  return metadata.format === 'gif'
    ? padded.gif({ reuse: true, keepDuplicateFrames: true, interFrameMaxError: 0, interPaletteMaxError: 0 }).toBuffer()
    : padded.png().toBuffer();
}
