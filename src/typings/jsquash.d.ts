/**
 * jSquash 包的 TypeScript 类型声明
 *
 * 这些包没有自带类型定义，需要手动声明。
 */

declare module '@jsquash/jpeg' {
  export function decode(buffer: ArrayBuffer): Promise<ImageData>;
  export function encode(data: ImageData, options?: { quality?: number }): Promise<ArrayBuffer>;
}

declare module '@jsquash/png' {
  export function decode(buffer: ArrayBuffer, options?: { bitDepth?: number }): Promise<ImageData>;
  export function encode(data: ImageData): Promise<ArrayBuffer>;
}

declare module '@jsquash/webp' {
  export function decode(buffer: ArrayBuffer): Promise<ImageData>;
  export function encode(data: ImageData, options?: { quality?: number }): Promise<ArrayBuffer>;
}

declare module '@jsquash/oxipng' {
  export function optimise(
    data: ArrayBuffer,
    options?: { level?: number; interlace?: boolean; optimiseAlpha?: boolean }
  ): Promise<ArrayBuffer>;
}
