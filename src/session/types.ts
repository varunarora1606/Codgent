import { Message } from "../types.ts";

export type SessionInfoEntry = {
  type: "session_info";
  id: string;
  createdAt: string;
  model: string;
  provider: string;
};

export type CompactionEntry = {type: "compaction", summary: string, keep: number}

export type MessageEntry = { type: "message"; message: Message };

export type SessionEntry = SessionInfoEntry | CompactionEntry | MessageEntry;

export type Session = {
  id: string;
  createdAt: string;
  model: string;
  provider: string;
  messages: Message[];
};

export interface SessionSummary {
	id: string;
	createdAt: string;
    mTimeMs: number;
	model: string;
	provider: string;
	messageCount: number;
	firstPrompt: string;
}
