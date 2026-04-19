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

  // Extraction Node
  workflow.addNode("extract", async (state: any) => {
    const update = await callbacks.onNodeStart("extract", state);
    return { ...state, ...update };
  });

  // Vector Embedding Node (Milestone 2)
  workflow.addNode("embed", async (state: any) => {
    const update = await callbacks.onNodeStart("embed", state);
    return { ...state, ...update };
  });

  // Research Node
  workflow.addNode("research", async (state: any) => {
    const update = await callbacks.onNodeStart("research", state);
    return { ...state, ...update };
  });

  // Evaluation Node
  workflow.addNode("evaluate", async (state: any) => {
    const update = await callbacks.onNodeStart("evaluate", state);
    return { ...state, ...update };
  });

  workflow.addEdge(START, "extract");
  workflow.addEdge("extract", "embed");
  workflow.addEdge("embed", "research");
  workflow.addEdge("research", "evaluate");
  workflow.addEdge("evaluate", END);

  return workflow.compile();
};
