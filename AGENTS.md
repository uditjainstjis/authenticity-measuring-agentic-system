# Veritas Agentic Workflow: Technical Specification

## Overview
Veritas is a high-performance intelligence engine designed for autonomous news credibility analysis and misinformation monitoring. It leverages a stateful multi-node architecture powered by **LangGraph**, integrating **RAG (Retrieval-Augmented Generation)** principles with specialized LLM evaluation logic.

---

## 🏗️ Core Architecture (The LangGraph Registry)

The workflow is defined as a directed acyclic graph (DAG) where each node represents a specialized agentic function:

### 1. Ingest Node (`SCRAPING`)
- **Action**: Extracts content via server-side scraper or direct text ingestion.
- **Goal**: Establish the raw fact-set for analysis.
- **Output**: Raw string content and document metadata (Title, URL).

### 2. Decompose Node (`EXTRACTING`)
- **Action**: Uses **Gemini 3 Flash** to decompose long-form content into atomic **Propositional Claims**.
- **Constraint**: Isolates only verifiable factual statements, filtering out pure editorializing.
- **Output**: Array of `Claim` objects (text, category, confidence floor).

### 3. Embed Node (`EMBEDDING`)
- **Action**: Simulates the transformation of claims into high-dimensional vector space.
- **Infrastructure**: Targeted for **ChromaDB** integration (Milestone 2).
- **Utility**: Enables semantic similarity checks and latent space mapping for future cross-audit correlation.

### 4. Verify Node (`RESEARCHING`)
- **Action**: **Autonomous Search Loop**. For each extracted claim, the agent initiates a live web search via the **Google Search Tool**.
- **RAG Integration**: Dynamically retrieves support/contradictory evidence from the live internet.
- **Output**: A collection of `SearchResult` objects (URLs, Titles, Snippets).

### 5. Synthesize Node (`EVALUATE`)
- **Action**: The "Jury" node. Consumes all claims and researched evidence.
- **Logic**: Performs a synthesis matrix check:
    - **Labeling**: Categorizes the news as CREDIBLE, DUBIOUS, FALSE, or MIXED.
    - **Scoring**: Calculates a Veracity Confidence Index (0-100).
    - **Evidence Backing**: Directly links findings to specific researched artifacts.
- **Output**: Structured `Verdict` report and actionable `Advisory Recommendations`.

---

## 🛠️ State Management
The system utilizes a central `AgentState` object to synchronize the frontend visualizers with the backend logic:
- **`status`**: Drives the dynamic CSS/Motion transitions between visualizer stages.
- **`logs`**: A persistence layer for the agent's internal reasoning stream.
- **`claims` / `results`**: Shared state accessible by evaluating nodes to ensure total context awareness.

## 🛡️ Responsible AI & Ethical Guardrails
- **Verification Priority**: The evaluate node is instructed to prioritize high-trust sources (Reuters, Associated Press) over unverified social signals.
- **Transparency**: Every verdict is backed by the "Internal Reasoning Stream" and an "Evidence Backing" list, allowing users to trace the agent's logic.
- **Neutrality**: System instructions mandate an elite, forensic tone, avoiding political bias or emotional framing.
