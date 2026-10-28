import type {
  AgentIntent,
  ConfidenceBand,
  MessageAuthor,
  MessageBlock,
  TraceStep,
} from '@nexo/shared';

export type MessageRecord = {
  id: string;
  conversationId: string;
  sessionId: string;
  author: MessageAuthor;
  authorId: string | null;
  authorName: string | null;
  text: string;
  blocks: MessageBlock[];
  createdAt: Date;
};

export type NewMessage = Omit<MessageRecord, 'id' | 'createdAt' | 'sessionId'>;

export type DecisionTraceRecord = {
  intent: AgentIntent;
  understood: { summary: string; entities: Record<string, string> };
  action: { type: string; label: string };
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  rationale: string;
  rulesApplied: string[];
  steps: TraceStep[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type SessionRecord = {
  id: string;
  conversationId: string;
  index: number;
  messageCount: number;
  summary: string | null;
  startedAt: Date;
};

export type EmployeeRecord = {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'EMPLOYEE' | 'ANALYST';
  supportLevel: 'N1' | 'N2' | null;
  passwordChangedAt: Date;
};

export type HelpArticleRecord = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
};
