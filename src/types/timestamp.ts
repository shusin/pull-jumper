
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

export interface LogsApiResponse {
  fights?: {
    id: number;
    name: string;
    startTime: number;
    endTime: number;
    bossPercentage?: number;
    lastPhaseForPercentageDisplay?: number;
  }[];
  start: number;
  end: number;
  error?: string;
}
