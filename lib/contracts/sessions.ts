import type { ChatMessage } from "./chat";

/** Contrato de GET /api/sessions y GET /api/sessions/:id. Fuente de verdad: tasks.md, sección 6.4. */
export interface SessionSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

export interface SessionsListResponse {
  sessions: SessionSummary[];
}

export interface SessionDetailResponse {
  session: SessionSummary;
  messages: ChatMessage[];
}
