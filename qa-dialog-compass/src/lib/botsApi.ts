import { api } from "@/lib/api";
import type { BotResponse, BotVersionResponse } from "@/types/bots";

export async function listBots(options?: { limit?: number }): Promise<BotResponse[]> {
  const limit = options?.limit ?? 100;
  const search = new URLSearchParams({ limit: String(limit) });
  return api.get<BotResponse[]>(`/bots/?${search.toString()}`);
}

export async function getBot(botId: string): Promise<BotResponse> {
  return api.get<BotResponse>(`/bots/${botId}`);
}

export async function createBotByLegacyIndex(index: number): Promise<BotResponse> {
  return api.post<BotResponse>(`/bots/`, { index });
}

export async function listBotVersions(botId: string): Promise<BotVersionResponse[]> {
  return api.get<BotVersionResponse[]>(`/bots/${botId}/versions`);
}

export async function regenerateKnowledgeBase(botIndex: number): Promise<BotVersionResponse> {
  return api.post<BotVersionResponse>(`/bots/${botIndex}/knowledge_base/regenerate`);
}

