
export interface TimestampEntry {
  id: string;
  name: string;
  pullTime: string;
}

export interface ParsedLogData {
  valid: boolean;
  entries: TimestampEntry[];
  errorMessage?: string;
}
