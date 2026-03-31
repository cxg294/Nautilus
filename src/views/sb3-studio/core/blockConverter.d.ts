/**
 * SB3 积木转换器类型声明
 */
export const HAT_OPCODES: Set<string>;
export function blockToText(blockId: string, blocks: any): string;
export function extractScripts(target: any): any[];
export function extractOrphans(target: any): any[];
export function extractReferencedResources(target: any): {
  variables: any[];
  broadcasts: {
    sends: string[];
    receives: string[];
  };
};
export function getOpcodeLabel(opcode: string): string;
export function registerOpcodes(extraLabels: Record<string, string>): void;
