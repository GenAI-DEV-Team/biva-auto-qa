import { apiFetch } from "@/lib/api";
import type { ConversationResponse, SpanResponse } from "@/types/conversations";

const API_V1 = "/api/v1";

export async function listConversations(params?: {
  bot_id?: number;
  start_ts?: string;
  end_ts?: string;
  phone_like?: string;
  limit?: number;
  offset?: number;
}): Promise<ConversationResponse[]> {
  const search = new URLSearchParams();
  if (params?.bot_id !== undefined) search.set("bot_id", String(params.bot_id));
  if (params?.start_ts) search.set("start_ts", params.start_ts);
  if (params?.end_ts) search.set("end_ts", params.end_ts);
  if (params?.phone_like) search.set("phone_like", params.phone_like);
  search.set("limit", String(params?.limit ?? 50));
  if (params?.offset !== undefined) search.set("offset", String(params.offset));
  return apiFetch<ConversationResponse[]>(`${API_V1}/conversations/?${search.toString()}`);
}

export async function getConversation(conversationId: string): Promise<ConversationResponse> {
  return apiFetch<ConversationResponse>(`${API_V1}/conversations/${conversationId}`);
}

export async function listSpans(conversationId: string): Promise<SpanResponse[]> {
  return apiFetch<SpanResponse[]>(`${API_V1}/conversations/${conversationId}/spans`);
}


