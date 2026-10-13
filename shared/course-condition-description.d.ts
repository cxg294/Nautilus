export interface ConditionDescription { text: string; translated: boolean; notes: string[] }
export function describeCondition(source: string | undefined): ConditionDescription;
