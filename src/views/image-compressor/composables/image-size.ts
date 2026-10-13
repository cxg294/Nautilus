export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ResizeOptions {
  resizeMode: 'fit' | 'percentage' | 'original';
  maxWidth: number;
  maxHeight: number;
  scalePercent: number;
}

/** 预览与两种压缩引擎共用尺寸规则；不裁切、不放大。 */
export function getOutputDimensions(source: ImageDimensions, options: ResizeOptions): ImageDimensions {
  let scale = 1;
  if (options.resizeMode === 'fit') {
    scale = Math.min(1, options.maxWidth / source.width, options.maxHeight / source.height);
  } else if (options.resizeMode === 'percentage') {
    scale = Math.min(1, Math.max(1, options.scalePercent) / 100);
  }
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale))
  };
}
