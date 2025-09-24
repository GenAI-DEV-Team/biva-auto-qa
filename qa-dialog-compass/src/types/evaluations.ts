export interface EvaluationRecord {
  id: string;
  conversation_id: string;
  memory: Record<string, unknown>;
  evaluation_result: Record<string, unknown>;
  reviewed: boolean;
  review_note?: string | null;
}

export interface QARunResult {
  conversation_id: string;
  bot_id: number | null;
  ok: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
}


