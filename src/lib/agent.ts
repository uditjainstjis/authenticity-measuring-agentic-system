import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "../types";

export const createAgentGraph = (callbacks: {
  onNodeStart: (node: string, state: any) => Promise<Partial<AgentState>>;
}) => {
  const workflow = new StateGraph<any>({
    channels: {
      status: null,
      logs: null,
      claims: null,
      results: null,
      verdict: null,
    }
  }) as any;

  // Extraction & Parallel Discovery Node
  workflow.addNode("discovery", async (state: any) => {
    const update = await callbacks.onNodeStart("discovery", state);
    return { ...state, ...update };
  });

  // Synthesis Node (The "Jury")
  workflow.addNode("synthesis", async (state: any) => {
    const update = await callbacks.onNodeStart("synthesis", state);
    return { ...state, ...update };
  });

  workflow.addEdge(START, "discovery");
  workflow.addEdge("discovery", "synthesis");
  workflow.addEdge("synthesis", END);

  return workflow.compile();
};
