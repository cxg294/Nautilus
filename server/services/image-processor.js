/**
 * 图像处理服务
 *
 * 提供：场景裁切、ZIP 打包
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import JSZip from 'jszip';
import config from '../config/env.js';

const OUTPUT_DIR = config.levelStudioOutput;
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 从场景图中裁切指定 Bbox 区域的元素
 * @param {string} scenePath - 场景图路径
 * @param {number[]} bbox - [x, y, width, height]
 * @param {number} padding - 裁切边距（像素）
 * @returns {Promise<string>} 输出文件名
 */
export async function cropElement(scenePath, bbox, padding = 10) {
  const [x, y, w, h] = bbox;
  const metadata = await sharp(scenePath).metadata();
  const imgW = metadata.width;
  const imgH = metadata.height;

  // 加 padding 并限制边界
  const left = Math.max(0, x - padding);
  const top = Math.max(0, y - padding);
  const width = Math.min(imgW - left, w + 2 * padding);
  const height = Math.min(imgH - top, h + 2 * padding);

  const filename = `crop_${crypto.randomUUID().slice(0, 8)}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);

  await sharp(scenePath)
    .extract({ left, top, width, height })
    .png()
    .toFile(filepath);

  return filename;
}

/**
 * 将多个文件打包为 ZIP
 * @param {Array<{path: string, name: string}>} files - 文件列表
 * @returns {Promise<string>} ZIP 文件名
 */
export async function createZip(files) {
  const zip = new JSZip();

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      const data = fs.readFileSync(file.path);
      zip.file(file.name, data);
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const filename = `level_assets_${crypto.randomUUID().slice(0, 8)}.zip`;
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, zipBuffer);

  return filename;
}
