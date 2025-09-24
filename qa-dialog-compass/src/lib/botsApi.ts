import { apiFetch } from "@/lib/api";
import type { BotResponse, BotVersionResponse } from "@/types/bots";

const API_V1 = "/api/v1";

export async function listBots(options?: { limit?: number }): Promise<BotResponse[]> {
  const limit = options?.limit ?? 100;
  const search = new URLSearchParams({ limit: String(limit) });
  return apiFetch<BotResponse[]>(`${API_V1}/bots/?${search.toString()}`);
}

export async function getBot(botId: string): Promise<BotResponse> {
  return apiFetch<BotResponse>(`${API_V1}/bots/${botId}`);
}

export async function createBotByLegacyIndex(index: number): Promise<BotResponse> {
  return apiFetch<BotResponse>(`${API_V1}/bots/`, {
    method: "POST",
    body: JSON.stringify({ index }),
  });
}

export async function listBotVersions(botId: string): Promise<BotVersionResponse[]> {
  return apiFetch<BotVersionResponse[]>(`${API_V1}/bots/${botId}/versions`);
}

export async function regenerateKnowledgeBase(botIndex: number): Promise<BotVersionResponse> {
  return apiFetch<BotVersionResponse>(`${API_V1}/bots/${botIndex}/knowledge_base/regenerate`, {
    method: "POST",
  });
}


