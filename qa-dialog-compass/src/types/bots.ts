export interface BotResponse {
  id: string;
  index: number; // legacy bot id stored as bot_index on server
  name: string;
  created_at: string; // ISO datetime
}

export interface BotVersionResponse {
  id: string;
  bot_index: number;
  system_prompt: string;
  knowledge_base: Record<string, unknown>;
  created_at: string; // ISO datetime
}


