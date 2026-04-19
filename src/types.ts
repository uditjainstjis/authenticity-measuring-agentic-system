export interface Claim {
  id: string;
  text: string;
  category: string;
  confidence: number;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  sourceType: "TRUSTED" | "NEUTRAL" | "BIASED" | "UNKNOWN";
}

export interface AgentState {
  status: "IDLE" | "SCRAPING" | "EXTRACTING" | "EMBEDDING" | "RESEARCHING" | "ANALYZING" | "COMPLETING" | "ERROR";
  logs: string[];
  claims: Claim[];
  results: SearchResult[];
  sourceSnippet?: string;
  verdict?: {
    score: number; // 0-100
    label: "CREDIBLE" | "DUBIOUS" | "FALSE" | "MIXED";
    summary: string;
    analysis: string;
    evidence: string[];
    recommendations: string[];
  };
}

export type AgentNode = "START" | "EXTRACT" | "RESEARCH" | "EVALUATE" | "FINISH";

export const INITIAL_STATE: AgentState = {
  status: "IDLE",
  logs: [],
  claims: [],
  results: [],
};
