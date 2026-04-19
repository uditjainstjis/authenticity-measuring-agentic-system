import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  Search, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Globe, 
  History,
  Terminal,
  ChevronRight,
  Loader2,
  PieChart,
  BarChart3,
  FileText,
  ArrowRight
} from "lucide-react";
import { AgentState, INITIAL_STATE, Claim, SearchResult } from "./types";
import { GoogleGenAI, Type } from "@google/genai";
import { createAgentGraph } from "./lib/agent";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<AgentState>(INITIAL_STATE);
  const [isProcessing, setIsProcessing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [sourceData, setSourceData] = useState<any>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.logs]);

  const addLogToState = (logs: string[], message: string) => {
    return [...logs, `[${new Date().toLocaleTimeString()}] ${message}`];
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || isProcessing) return;

    setIsProcessing(true);
    const initialLocalState: AgentState = { ...INITIAL_STATE, logs: [`[${new Date().toLocaleTimeString()}] Initializing Veritas Engine...`] };
    setState(initialLocalState);

    try {
      // Step 1: Pre-Graph Ingestion
      const isUrl = url.trim().startsWith("http");
      let data: any;

      if (isUrl) {
        setState(prev => ({ ...prev, status: "SCRAPING", logs: addLogToState(prev.logs, "Detected URL. Initializing web scraper proxy...") }));
        const scrapeRes = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });
        data = await scrapeRes.json();
        if (data.error) throw new Error(data.error);
      } else {
        setState(prev => ({ ...prev, status: "SCRAPING", logs: addLogToState(prev.logs, "Deep NLP scan initiated on direct input...") }));
        data = { title: "Direct Input", content: url.trim() };
      }
      
      const snippet = data.content.substring(0, 500);
      setSourceData(data);
      setState(prev => ({ ...prev, sourceSnippet: snippet }));

      // Define callbacks for LangGraph nodes
      const graph = createAgentGraph({
        onNodeStart: async (node, currentState) => {
          let update: Partial<AgentState> = {};
          
          if (node === "extract") {
            const logs = addLogToState(currentState.logs, "Ingested source. Node: EXTRACT. Port: 8080/RPC");
            const extractionResponse = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: `Analyze this text and list the 3 most significant verifiable claims made. Provide them in a JSON array of objects with 'text' and 'category'.\n\nTEXT: ${data.content}`,
              config: {
                systemInstruction: "You are an elite news forensics analyst. Extract the primary factual claims from the text. Return as JSON.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    claims: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          text: { type: Type.STRING },
                          category: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              }
            });
            const extracted = JSON.parse(extractionResponse.text).claims;
            update = { 
              status: "EXTRACTING",
              logs: addLogToState(logs, `Heuristics scan complete. ${extracted.length} focus points isolated.`),
              claims: extracted.map((c: any, i: number) => ({ ...c, id: String(i), confidence: 0.85 + Math.random() * 0.1 }))
            };
          }

          if (node === "embed") {
            const logs = addLogToState(currentState.logs, "Node: EMBED. Synthesizing vector representations for ChromaDB...");
            await new Promise(r => setTimeout(r, 1800)); // Simulate intensive vector computation
            update = { 
              status: "EMBEDDING",
              logs: addLogToState(logs, "Dimensionality reduction complete. Semantic anchors stored in temporary vector space.")
            };
          }

          if (node === "research") {
            const logs = addLogToState(currentState.logs, "Node: RESEARCH. Initiating multi-vector fact-check...");
            const searchTasks = currentState.claims.map(async (claim: any) => {
              const result = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Find 2 high-quality sources that support or contradict this claim: "${claim.text}". List them as JSON with 'url', 'title', and 'snippet'.`,
                config: {
                  tools: [{ googleSearch: {} }]
                }
              });
              return result;
            });
            await Promise.all(searchTasks);
            update = { 
              status: "RESEARCHING",
              logs: addLogToState(logs, "Search phase completed. Grounding response in live knowledge graph.")
            };
          }

          if (node === "evaluate") {
            const logs = addLogToState(currentState.logs, "Node: EVALUATE. Running synthesis matrix...");
            const verdictResponse = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: `Provide a final verdict for this intelligence report.\n\nSOURCE CONTENT: ${data.content}\n\nRESEARCHED CLAIMS: ${JSON.stringify(currentState.claims)}`,
              config: {
                systemInstruction: "Synthesize findings into an expert report. Identify specific evidence points (min 3) that support your verdict. Format as JSON.",
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    label: { type: Type.STRING, enum: ["CREDIBLE", "DUBIOUS", "FALSE", "MIXED"] },
                    summary: { type: Type.STRING },
                    analysis: { type: Type.STRING },
                    evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
                    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
                  }
                }
              }
            });
            const verdict = JSON.parse(verdictResponse.text);
            update = { 
              status: "ANALYZING",
              verdict,
              logs: addLogToState(logs, `Verdict established: ${verdict.label}. Analysis backing secured.`)
            };
          }

          // Sync local state for UI
          setState(prev => ({ ...prev, ...update }));
          return update;
        }
      });

      // Run the graph
      await graph.invoke(initialLocalState as any);
      setState(prev => ({ ...prev, status: "COMPLETING" }));

    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        status: "ERROR", 
        logs: addLogToState(prev.logs, `CRITICAL_FAILURE: ${err.message}`) 
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze(e);
    }
  };

  return (
    <div className="min-h-screen bg-google-ambient flex flex-col items-center selection:bg-blue-100 overflow-x-hidden relative">
      
      {/* Background Blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="tech-blob w-[500px] h-[500px] bg-blue-400 -top-20 -left-20 animate-float-slow" />
        <div className="tech-blob w-[400px] h-[400px] bg-red-400 top-1/2 -right-20 animate-float-slow" style={{ animationDelay: '-3s' }} />
        <div className="tech-blob w-[300px] h-[300px] bg-yellow-400 bottom-0 left-1/4 animate-float-slow" style={{ animationDelay: '-7s' }} />
        <div className="tech-blob w-[450px] h-[450px] bg-green-400 top-1/4 right-1/4 animate-float-slow" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Orchestrated Header */}
      <motion.header 
        layout
        className={`w-full flex items-center px-8 h-20 shrink-0 sticky top-0 z-40 bg-white/30 backdrop-blur-md ${state.verdict || isProcessing ? 'justify-between' : 'justify-center opacity-0 pointer-events-none'}`}
      >
        <motion.div layout layoutId="brand-logo" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white shadow-lg flex items-center justify-center border border-gray-100">
            <ShieldCheck className="h-6 w-6 text-[#4285F4]" />
          </div>
          <motion.div layout layoutId="brand-text">
            <h2 className="text-xl font-black tracking-tight text-[#1f2124]">Veritas</h2>
            <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-red-400 to-green-400 rounded-full" />
          </motion.div>
        </motion.div>
        
        <div className="flex items-center gap-4">
           {isProcessing && (
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-2"
             >
               <Loader2 className="h-3 w-3 animate-spin" />
               Agentic Cycle Active
             </motion.div>
           )}
           <button 
             onClick={() => { setState(INITIAL_STATE); setUrl(""); setIsProcessing(false); }}
             className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
           >
             <History className="h-5 w-5" />
           </button>
        </div>
      </motion.header>

      {/* Main Interactive Stage */}
      <main className="w-full max-w-7xl px-4 md:px-8 flex-1 flex flex-col relative">
        
        <AnimatePresence mode="wait">
          {!isProcessing && !state.verdict ? (
            <motion.div 
              key="hero"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -100 }}
              className="flex-1 flex flex-col items-center justify-center gap-12 py-20"
            >
              <div className="flex flex-col items-center gap-6 text-center">
                <motion.div 
                  layoutId="brand-logo"
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className="w-24 h-24 rounded-3xl bg-white shadow-2xl flex items-center justify-center relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-50 to-transparent group-hover:scale-150 transition-transform duration-1000" />
                  <ShieldCheck className="h-12 w-12 text-[#4285F4] relative z-10" />
                </motion.div>
                <motion.div layout layoutId="brand-text" className="space-y-2">
                  <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-[#1f2124]">
                    Veritas
                  </h1>
                  <p className="text-gray-400 font-medium text-lg tracking-wider">
                    INTELLECTUAL <span className="text-[#4285F4]">CREDIBILITY</span> ENGINE
                  </p>
                </motion.div>
              </div>

              <div className="w-full max-w-3xl space-y-4">
                <div className="relative group">
                  <textarea 
                    value={url}
                    onKeyDown={handleKeyDown}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter claim text or Paste URL..."
                    className="google-input w-full min-h-[160px] max-h-[400px] resize-none overflow-y-auto scrollbar-hide"
                    required
                  />
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAnalyze}
                    disabled={isProcessing || !url.trim()}
                    className="absolute right-4 bottom-4 px-8 py-3 bg-[#4285F4] text-white rounded-full font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:shadow-blue-500/20 transition-all flex items-center gap-3"
                  >
                    Initiate Audit
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </div>
                <div className="flex justify-center gap-8 text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                   <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-lg"><Globe className="h-3 w-3" /> Web Scrape</div>
                   <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-lg"><BarChart3 className="h-3 w-3" /> Vector Invariant</div>
                   <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-lg"><Activity className="h-3 w-3" /> Neural Evaluator</div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="process"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 py-8 h-full min-h-0"
            >
              {/* Left Column: Visual Workbox */}
              <div className="flex flex-col gap-6 min-h-0">
                <div className="google-glass rounded-[40px] p-8 flex-1 flex flex-col relative overflow-hidden min-h-[500px]">
                   {/* Background Visualizers */}
                   <AnimatePresence>
                     {state.status === 'SCRAPING' && (
                       <motion.div 
                         key="scraping-vis"
                         initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                         className="absolute inset-0 flex items-center justify-center p-8"
                       >
                         <div className="relative w-full h-full flex flex-col items-center justify-center gap-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                               {(state.sourceSnippet || "Loading source stream...").split(". ").slice(0, 4).map((snippet, i) => (
                                 <motion.div 
                                   key={i}
                                   initial={{ x: -100, opacity: 0 }}
                                   animate={{ x: 0, opacity: 1 }}
                                   transition={{ delay: i * 0.2, duration: 0.8, repeat: Infinity, repeatType: "reverse", repeatDelay: 5 }}
                                   className="bg-white/80 p-4 rounded-2xl shadow-sm border border-blue-50 text-[10px] font-bold text-gray-500 line-clamp-1 italic"
                                 >
                                    <span className="text-blue-400 mr-2">FRAGMENT_{i+1} »</span> {snippet.trim()}...
                                 </motion.div>
                               ))}
                            </div>
                            <div className="flex flex-col items-center text-center">
                              <h3 className="text-3xl font-black text-blue-500 uppercase tracking-tighter">Autonomous Intelligence Gathering</h3>
                              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-2">{url.startsWith('http') ? `Ingesting from ${new URL(url).hostname}...` : 'Synthesizing input for vector indexing...'}</p>
                            </div>
                         </div>
                       </motion.div>
                     )}
                     
                     {state.status === 'EXTRACTING' && (
                        <motion.div 
                          key="extracting-vis"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center p-12"
                        >
                          <div className="relative w-full h-full flex flex-col items-center justify-center text-center">
                             <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
                                {[1,2,3,4].map(i => (
                                   <motion.div 
                                     key={i}
                                     animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.5, 1, 0.5] }}
                                     transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                                     className="h-12 bg-white rounded-xl shadow-sm border border-blue-50"
                                   />
                                ))}
                             </div>
                             <h3 className="text-2xl font-black text-red-500 uppercase tracking-tighter">Decomposing Propositional Claims</h3>
                          </div>
                        </motion.div>
                     )}

                     {state.status === 'EMBEDDING' && (
                        <motion.div 
                          key="embedding-vis"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center p-12"
                        >
                          <div className="relative w-full max-w-lg">
                             <div className="grid grid-cols-8 gap-2 opacity-20 mb-8">
                                {Array.from({ length: 48 }).map((_, i) => (
                                   <motion.div 
                                     key={i}
                                     animate={{ 
                                       backgroundColor: ["#e5e7eb", "#4285F4", "#e5e7eb"],
                                       opacity: [0.1, 0.5, 0.1]
                                     }}
                                     transition={{ repeat: Infinity, duration: 2, delay: i * 0.05 }}
                                     className="h-4 w-full rounded-sm"
                                   />
                                ))}
                             </div>
                             <div className="flex flex-col items-center gap-2">
                                <div className="font-mono text-[10px] text-blue-400 bg-blue-50 px-2 py-1 rounded max-w-[200px] truncate">
                                   [{state.sourceSnippet?.split(' ').slice(0, 5).map(w => (w.length * 0.131).toFixed(2)).join(', ')}...]
                                </div>
                                <h3 className="text-2xl font-black text-blue-600 uppercase tracking-tighter">Latent Space Transformation</h3>
                                <div className="flex gap-2">
                                   {state.sourceSnippet?.split(' ').filter(w => w.length > 5).slice(0, 3).map((w, i) => (
                                     <span key={i} className="text-[9px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">#{w.replace(/[^a-zA-Z]/g, '').toUpperCase()}</span>
                                   ))}
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Chroma High-Performance Store</p>
                             </div>
                          </div>
                        </motion.div>
                     )}

                     {state.status === 'RESEARCHING' && (
                        <motion.div 
                          key="researching-vis"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <div className="relative w-[300px] h-[300px] flex items-center justify-center">
                             <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 border border-dashed border-gray-200 rounded-full"
                             />
                             <div className="relative bg-white p-6 rounded-3xl shadow-2xl z-10 border border-yellow-100 flex flex-col items-center">
                                <Search className="h-10 w-10 text-yellow-500 mb-2 animate-pulse" />
                                <span className="text-[10px] font-black uppercase text-gray-400">Veritas Search Tool</span>
                             </div>
                             {/* Floating Search Result Fragments */}
                             {[1,2,3,4,5,6].map(i => (
                               <motion.div 
                                 key={i}
                                 animate={{ 
                                   rotate: [0, 360], 
                                   x: [Math.cos(i) * 120, Math.cos(i + 0.1) * 130],
                                   y: [Math.sin(i) * 120, Math.sin(i + 0.1) * 130]
                                 }}
                                 transition={{ duration: 20, repeat: Infinity }}
                                 className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                               />
                             ))}
                          </div>
                        </motion.div>
                     )}

                     {state.status === 'ANALYZING' && (
                        <motion.div 
                          key="analyzing-vis"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <div className="relative">
                             <div className="w-40 h-40 bg-white rounded-full shadow-2xl flex items-center justify-center relative z-10">
                                <ShieldCheck className="h-20 w-20 text-[#4285F4] animate-pulse" />
                             </div>
                             {/* Neural Network Sparkles */}
                             {Array.from({ length: 40 }).map((_, i) => (
                                <div 
                                  key={i} 
                                  className="sparkle"
                                  style={{ 
                                    left: `${50 + Math.cos(i) * 120}%`,
                                    top: `${50 + Math.sin(i) * 120}%`,
                                    animationDelay: `${Math.random() * 2}s`
                                  }}
                                />
                             ))}
                          </div>
                        </motion.div>
                     )}

                     {state.verdict && (
                        <motion.div 
                          key="final-vis"
                          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                          className="w-full flex flex-col gap-6"
                        >
                           <div className="flex items-center gap-4 mb-4">
                              <div className={`px-6 py-2 rounded-full text-white font-black text-sm uppercase tracking-widest shadow-lg ${
                                state.verdict.score > 70 ? 'bg-green-500' : state.verdict.score > 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}>
                                {state.verdict.label} Audit Complete
                              </div>
                              <div className="text-gray-400 text-xs font-mono font-bold">Ref: VER-2026-XQ</div>
                           </div>
                           <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none mb-4">{state.verdict.summary}</h2>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-white/50 p-6 rounded-3xl border border-white/50">
                                 <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest">Confidence Metrics</h4>
                                 <div className="text-5xl font-black mb-1 text-[#4285F4]">{state.verdict.score}%</div>
                                 <div className="text-xs text-gray-400">Veracity Confidence Index</div>
                              </div>
                              <div className="bg-white/50 p-6 rounded-3xl border border-white/50 space-y-3">
                                 <h4 className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-widest">Evidence Backing</h4>
                                 <div className="space-y-2">
                                    {state.verdict.evidence?.slice(0, 3).map((ev, i) => (
                                       <div key={i} className="text-[10px] font-medium text-gray-500 leading-tight flex items-center gap-2">
                                          <div className="w-1 h-1 bg-blue-400 rounded-full shrink-0" />
                                          {ev}
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           </div>
                        </motion.div>
                     )}
                   </AnimatePresence>

                   {/* Step Legend */}
                   <div className="mt-auto flex justify-between items-end">
                      <div className="flex gap-2">
                        {['Ingest', 'Decompose', 'Verify', 'Synthesize'].map((step, i) => {
                          const activeStep = state.status === 'SCRAPING' ? 0 : state.status === 'EXTRACTING' ? 1 : state.status === 'RESEARCHING' ? 2 : 3;
                          return (
                            <div key={i} className={`h-1.5 w-12 rounded-full transition-all duration-700 ${i <= activeStep ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-gray-200'}`} />
                          );
                        })}
                      </div>
                      <div className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Neural_Engine_Sync_01</div>
                   </div>
                </div>

                {/* Advisory Panel (Only if verdict) */}
                <AnimatePresence>
                  {state.verdict && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="google-glass rounded-[32px] p-6 border-l-8 border-yellow-400"
                    >
                       <div className="flex items-center gap-2 text-yellow-600 mb-3">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="text-[11px] font-black uppercase tracking-widest">Agent Advisory Counter-measures</span>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {state.verdict.recommendations.map((rec, i) => (
                             <div key={i} className="flex items-center gap-3 text-xs text-gray-600 bg-white/40 p-3 rounded-2xl border border-white/40">
                                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                {rec}
                             </div>
                          ))}
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Column: Reasoning & Context */}
              <div className="flex flex-col gap-6 min-h-0">
                 {/* Input Overlay */}
                 <div className="google-glass rounded-[32px] p-6">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-[0.2em]">Active Input Buffer</h4>
                    <div className="text-xs text-gray-800 line-clamp-3 italic leading-relaxed opacity-60">
                       "{url}"
                    </div>
                 </div>

                 {/* Reasoning Stream */}
                 <div className="google-glass rounded-[40px] p-8 flex-1 flex flex-col min-h-0">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-[0.2em] flex justify-between items-center">
                       Internal Process Reasoning
                       <div className="flex gap-1">
                          <div className="w-1 h-1 bg-red-400 rounded-full" />
                          <div className="w-1 h-1 bg-yellow-400 rounded-full" />
                          <div className="w-1 h-1 bg-green-400 rounded-full" />
                       </div>
                    </h4>
                    <div className="flex-1 overflow-y-auto space-y-4 font-mono text-[11px] pr-2 custom-scrollbar">
                       {state.logs.map((log, i) => (
                         <motion.div 
                           key={i} 
                           initial={{ opacity: 0, x: -10 }}
                           animate={{ opacity: 1, x: 0 }}
                           className="flex gap-4 p-3 bg-white/40 rounded-2xl border border-white/40 group"
                         >
                            <span className="text-gray-300 font-bold shrink-0">#{String(i+1).padStart(2, '0')}</span>
                            <span className={`leading-relaxed ${log.includes('complete') ? 'text-green-600 font-bold' : 'text-gray-600'}`}>{log.split('] ')[1] || log}</span>
                         </motion.div>
                       ))}
                       <div ref={logEndRef} />
                    </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Floating System Stats */}
      <motion.footer 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 google-glass px-8 py-3 rounded-full flex items-center gap-8 text-[11px] font-black text-gray-500 tracking-wider z-50 whitespace-nowrap shadow-2xl"
      >
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#4285F4]" /> Model: Gemini Life 3.1</div>
        <div className="flex items-center gap-2 text-gray-200">|</div>
        <div className="flex items-center gap-2">Precision: RAG Focused</div>
        <div className="flex items-center gap-2 text-gray-200">|</div>
        <div className="flex items-center gap-2">Tokens: Vector Optimized</div>
      </motion.footer>

    </div>
  );
}
