import { api } from "@/lib/api";
import type { EvaluationRecord, QARunResult } from "@/types/evaluations";

export async function getEvaluation(conversationId: string): Promise<EvaluationRecord> {
  return api.get<EvaluationRecord>(`/evaluations/${conversationId}`);
}

export async function listEvaluations(limit = 50): Promise<EvaluationRecord[]> {
  const capped = Math.min(limit ?? 50, 200);
  return api.get<EvaluationRecord[]>(`/evaluations/?limit=${capped}`);
}

export async function runQAEvaluations(params: { conversation_ids?: string[]; limit?: number }): Promise<QARunResult[]> {
  return api.post<QARunResult[]>(`/qa_runs/run`, params);
}

export async function updateEvaluationReview(conversationId: string, data: { reviewed?: boolean; review_note?: string | null }): Promise<EvaluationRecord> {
  return api.patch<EvaluationRecord>(`/evaluations/${conversationId}`, data);
}


// User prompt endpoints
export async function getMyPrompt(): Promise<{ prompt: string }> {
  return api.get(`/prompts/me`);
}

export async function updateMyPrompt(prompt: string): Promise<{ prompt: string }> {
  return api.put(`/prompts/me`, { prompt });
}

export async function deleteMyPrompt(): Promise<{ status: string; prompt: string }> {
  return api.delete(`/prompts/me`);
}


