/**
 * SB3 解析器类型声明
 */
export function parseSB3(file: File): Promise<{
  project: any;
  assets: Map<string, Blob>;
  fileName: string;
  fileSize: number;
}>;
export function exportSB3(project: any, assets: Map<string, Blob>, name: string): void;
export function exportJSON(project: any, name: string): void;
