import { apiFetch } from "@/lib/api";
import type { EvaluationRecord, QARunResult } from "@/types/evaluations";

const API_V1 = "/api/v1";

export async function getEvaluation(conversationId: string): Promise<EvaluationRecord> {
  return apiFetch<EvaluationRecord>(`${API_V1}/evaluations/${conversationId}`);
}

export async function listEvaluations(limit = 50): Promise<EvaluationRecord[]> {
  return apiFetch<EvaluationRecord[]>(`${API_V1}/evaluations/?limit=${limit}`);
}

export async function runQAEvaluations(params: { conversation_ids?: string[]; limit?: number }): Promise<QARunResult[]> {
  return apiFetch<QARunResult[]>(`${API_V1}/qa_runs/run`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}


