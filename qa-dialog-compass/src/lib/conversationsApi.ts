import { api } from "@/lib/api";
import type { ConversationResponse, SpanResponse } from "@/types/conversations";

export async function listConversations(params?: {
  bot_id?: number;
  start_ts?: string;
  end_ts?: string;
  phone_like?: string;
  qa_status?: string;
  review_status?: string;
  overall_status?: string;
  limit?: number;
  offset?: number;
}): Promise<ConversationResponse[]> {
  const search = new URLSearchParams();
  if (params?.bot_id !== undefined) search.set("bot_id", String(params.bot_id));
  if (params?.start_ts) search.set("start_ts", params.start_ts);
  if (params?.end_ts) search.set("end_ts", params.end_ts);
  if (params?.phone_like) search.set("phone_like", params.phone_like);
  if (params?.qa_status) search.set("qa_status", params.qa_status);
  if (params?.review_status) search.set("review_status", params.review_status);
  if (params?.overall_status) search.set("overall_status", params.overall_status);
  search.set("limit", String(params?.limit ?? 50));
  if (params?.offset !== undefined) search.set("offset", String(params.offset));
  return api.get<ConversationResponse[]>(`/conversations/?${search.toString()}`);
}

export async function getConversation(conversationId: string): Promise<ConversationResponse> {
  return api.get<ConversationResponse>(`/conversations/${conversationId}`);
}

export async function listSpans(conversationId: string): Promise<SpanResponse[]> {
  return api.get<SpanResponse[]>(`/conversations/${conversationId}/spans`);
}


