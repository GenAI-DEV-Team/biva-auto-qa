export interface ConversationResponse {
  id: number;
  conversation_id: string | null;
  customer_phone: string | null;
  bot_id: number | null; // legacy bot id
  created_at: string | null;
  updated_at: string | null;
}

export interface SpanResponse {
  id: string; // {conversation_id}:{turn_idx}
  conversation_id: string;
  turn_idx: number;
  role: string; // assistant | user | ...
  text: string;
  embedding: number[] | null;
  created_at: string;
}


