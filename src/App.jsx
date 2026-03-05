import { useState, useEffect, useMemo } from "react";

// ── Objection Handler Data ─────────────────────────────────────────
const OBJECTIONS = [
  "I'm really busy right now",
  "Send me an email",
  "We don't have time to switch systems right now",
  "What sets you apart from competitors?",
  "Our manager handles all the hiring",
  "We're not looking right now",
  "Call me back next quarter",
  "We already have a system",
  "We're using Indeed and it's working fine",
  "We don't have budget",
  "We're happy with what we have",
  "I'm not the right person",
  "We tried something like this before",
  "We've never had trouble finding workers",
];

const CACHE_KEY = "workstream-objection-cache";
function loadCache() { try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } }
function saveCache(c) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {} }
async function fetchRebuttal(objection) {
  const res = await fetch("/api/rebuttal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objection }) });
  if (!res.ok) throw new Error("API error");
  return res.json();
}

// ── Call Tracker Data ──────────────────────────────────────────────
const OPENERS = [
  { id: "o1", text: "Hey [Name], I'll be upfront — this is a cold call. Got 24 seconds?" },
  { id: "o2", text: "Hey [Name], have you heard Workstream's name tossed around at all?" },
  { id: "o3", text: "Hey [Name], is it alright if I take just 24 seconds to tell you why I'm calling — and then you can tell me if it makes sense to keep talking?" },
];
const HOOKS = [
  { id: "h1", text: "We take all the manual work out of recruiting + onboarding for you." },
  { id: "h2", text: "We help companies hire faster and manage their workforce all in one place." },
  { id: "h3", text: "We help teams fill positions in days rather than weeks." },
];
const DEFAULT_SQS = [
  { id: "sq1", text: "How are you currently handling your hourly hiring?" },
  { id: "sq2", text: "What does your onboarding process look like right now?" },
  { id: "sq3", text: "How long is it typically taking you to fill a position?" },
];
const DEFAULT_PAIN = [
  { id: "pp1", text: "Too slow to hire / losing candidates" },
  { id: "pp2", text: "Manual / paper-based onboarding" },
  { id: "pp3", text: "High turnover, always rehiring" },
];

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}

const emptyRate = () => ({ uses: 0, meetings: 0 });
const pct = (n, d) => d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function getLabel(id, lists) { for (const l of lists) { const f = l.find(i => i.id === id); if (f) return f.text; } return "—"; }

// ── Label Colors (Objection Handler) ──────────────────────────────
const labelColors = {
  "Curious & Disarming": { bg: "#1a2a1a", border: "#2d5a2d", text: "#6ee86e", dot: "#4caf50" },
  "Pain-Led":            { bg: "#2a1a2a", border: "#6e2d5a", text: "#ff8ce8", dot: "#ff4fcc" },
  "Value-Led":           { bg: "#1a1f2e", border: "#2d3f6e", text: "#7eb3ff", dot: "#4a7fff" },
  "Challenge & Redirect":{ bg: "#2a1a1a", border: "#6e2d2d", text: "#ff8c8c", dot: "#ff4f4f" },
};

// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [activeTab, setActiveTab] = useState("objections");

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Georgia', serif", color: "#e8e0d0", position: "relative", overflow: "hidden" }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a0a0f; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn { from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)} }
        .fade-up { animation: fadeUp 0.18s ease forwards; }
        .toast-in { animation: toastIn 0.2s ease forwards; }
        .choice:hover { border-color: rgba(255,120,50,0.5) !important; background: rgba(255,120,50,0.04) !important; }
        .del-btn { opacity:0; transition:opacity 0.15s; }
        .history-row:hover .del-btn { opacity:1; }
        .history-row:hover { background: rgba(255,255,255,0.02) !important; }
        button { cursor: pointer; }
        input:focus, textarea:focus { outline: none !important; }
      `}</style>

      {/* Grain overlay */}
      <div style={{ position:"fixed", inset:0, opacity:0.03, pointerEvents:"none", zIndex:0, backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
      <div style={{ position:"fixed", top:"-20%", left:"50%", transform:"translateX(-50%)", width:"600px", height:"400px", pointerEvents:"none", zIndex:0, background:"radial-gradient(ellipse, rgba(255,120,50,0.06) 0%, transparent 70%)" }} />

      <div style={{ maxWidth:"760px", margin:"0 auto", padding:"40px 24px", position:"relative", zIndex:1 }}>

        {/* Header */}
        <div style={{ marginBottom:"36px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"rgba(255,120,50,0.1)", border:"1px solid rgba(255,120,50,0.2)", borderRadius:"4px", padding:"4px 12px", marginBottom:"16px" }}>
            <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#ff7832", animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:"11px", letterSpacing:"0.15em", color:"#ff7832", fontFamily:"monospace", textTransform:"uppercase" }}>Workstream SDR Toolkit</span>
          </div>
          <h1 style={{ fontSize:"clamp(28px,4vw,42px)", fontWeight:"400", lineHeight:"1.1", letterSpacing:"-0.02em", color:"#f5ede0" }}>
            Your SDR <em style={{ color:"#ff7832" }}>Toolkit.</em>
          </h1>
        </div>

        {/* Tab Nav */}
        <div style={{ display:"flex", gap:"2px", marginBottom:"36px", background:"rgba(255,255,255,0.03)", border:"1px solid #2a2520", borderRadius:"6px", padding:"4px", width:"fit-content" }}>
          {[
            ["objections", "🥊 Objection Handler"],
            ["log",        "📞 Log Call"],
            ["dashboard",  "📊 Stats"],
            ["history",    "🗂 History"],
          ].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding:"8px 18px", borderRadius:"4px", border:"none",
              background: activeTab === tab ? "#ff7832" : "transparent",
              color: activeTab === tab ? "#0a0a0f" : "#7a7060",
              fontSize:"12px", fontFamily:"monospace", letterSpacing:"0.08em",
              textTransform:"uppercase", transition:"all 0.2s", fontWeight: activeTab === tab ? "700" : "400",
            }}>{label}</button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "objections" && <ObjectionHandler />}
        {(activeTab === "log" || activeTab === "dashboard" || activeTab === "history") && (
          <CallTracker activeTab={activeTab} setActiveTab={setActiveTab} />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// OBJECTION HANDLER
// ══════════════════════════════════════════════════════════════════
function ObjectionHandler() {
  const [objection, setObjection] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [inputMode, setInputMode] = useState("quick");
  const [cache, setCache] = useState({});
  const [cachedKeys, setCachedKeys] = useState(new Set());
  const [preloading, setPreloading] = useState(false);

  useEffect(() => {
    const loadAndPreload = async () => {
      const existingCache = loadCache();
      setCache(existingCache);
      setCachedKeys(new Set(Object.keys(existingCache)));
      const missing = OBJECTIONS.filter(o => !existingCache[o]);
      if (missing.length === 0) return;
      setPreloading(true);
      const newCache = { ...existingCache };
      await Promise.all(missing.map(async (obj) => {
        try {
          const parsed = await fetchRebuttal(obj);
          newCache[obj] = { objection: obj, ...parsed };
          setCache(prev => ({ ...prev, [obj]: newCache[obj] }));
          setCachedKeys(prev => new Set([...prev, obj]));
        } catch {}
      }));
      saveCache(newCache);
      setPreloading(false);
    };
    loadAndPreload();
  }, []);

  const handleSubmit = async (text) => {
    const query = text || objection;
    if (!query.trim()) return;
    if (cache[query]) { setResult(cache[query]); setObjection(query); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const parsed = await fetchRebuttal(query);
      const newResult = { objection: query, ...parsed };
      setResult(newResult);
      const newCache = { ...cache, [query]: newResult };
      setCache(newCache); setCachedKeys(new Set(Object.keys(newCache))); saveCache(newCache);
    } catch { setError("Something went wrong. Try again."); }
    finally { setLoading(false); }
  };

  const handleQuickSelect = (obj) => { setObjection(obj); handleSubmit(obj); };
  const copyToClipboard = (text, idx) => { navigator.clipboard.writeText(text); setCopied(idx); setTimeout(() => setCopied(null), 2000); };

  return (
    <div style={{ animation:"fadeIn 0.3s ease" }}>
      <p style={{ color:"#7a7060", fontSize:"15px", marginBottom:"28px", lineHeight:"1.6" }}>Drop an objection. Get 3 battle-tested rebuttals instantly.</p>

      {/* Mode Toggle */}
      <div style={{ display:"flex", marginBottom:"24px", border:"1px solid #2a2520", borderRadius:"6px", overflow:"hidden", width:"fit-content" }}>
        {["quick","custom"].map(mode => (
          <button key={mode} onClick={() => setInputMode(mode)} style={{
            padding:"8px 20px", border:"none", fontSize:"12px", fontFamily:"monospace",
            letterSpacing:"0.1em", textTransform:"uppercase",
            background: inputMode === mode ? "#ff7832" : "transparent",
            color: inputMode === mode ? "#0a0a0f" : "#7a7060", transition:"all 0.2s",
          }}>{mode === "quick" ? "Quick Pick" : "Type It"}</button>
        ))}
      </div>

      {inputMode === "quick" && (
        <div style={{ marginBottom:"32px" }}>
          {preloading && (
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
              <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#ff7832", animation:"pulse 1s infinite" }} />
              <span style={{ fontSize:"11px", fontFamily:"monospace", color:"#7a7060", letterSpacing:"0.08em" }}>Caching responses for instant access...</span>
            </div>
          )}
          {!preloading && cachedKeys.size >= OBJECTIONS.length && (
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
              <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:"#4caf50" }} />
              <span style={{ fontSize:"11px", fontFamily:"monospace", color:"#4caf50", letterSpacing:"0.08em" }}>All responses cached — instant access ready</span>
            </div>
          )}
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
            {OBJECTIONS.map(obj => {
              const isCached = cachedKeys.has(obj);
              const isSelected = objection === obj;
              return (
                <button key={obj} onClick={() => handleQuickSelect(obj)} style={{
                  padding:"8px 16px", borderRadius:"4px", fontSize:"13px", border:"1px solid",
                  fontFamily:"'Georgia', serif", transition:"all 0.15s",
                  background: isSelected ? "rgba(255,120,50,0.15)" : "rgba(255,255,255,0.02)",
                  color: isSelected ? "#ff7832" : "#c8b89a",
                  borderColor: isSelected ? "rgba(255,120,50,0.4)" : isCached ? "rgba(76,175,80,0.25)" : "#2a2520",
                }}>
                  {obj}
                  {isCached && !isSelected && <span style={{ marginLeft:"6px", fontSize:"9px", color:"#4caf50", fontFamily:"monospace" }}>⚡</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {inputMode === "custom" && (
        <div style={{ marginBottom:"32px" }}>
          <textarea value={objection} onChange={e => setObjection(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
            placeholder='e.g. "We already use ADP for everything..."' rows={3}
            style={{ width:"100%", padding:"16px", borderRadius:"6px", resize:"none", background:"rgba(255,255,255,0.03)", border:"1px solid #2a2520", color:"#e8e0d0", fontSize:"15px", fontFamily:"'Georgia', serif", lineHeight:"1.6", boxSizing:"border-box" }}
            onFocus={e => e.target.style.borderColor="rgba(255,120,50,0.4)"}
            onBlur={e => e.target.style.borderColor="#2a2520"}
          />
          <button onClick={() => handleSubmit()} disabled={loading || !objection.trim()} style={{
            marginTop:"12px", padding:"12px 32px", borderRadius:"4px", border:"none",
            background: loading || !objection.trim() ? "#2a2520" : "#ff7832",
            color: loading || !objection.trim() ? "#4a4030" : "#0a0a0f",
            fontSize:"13px", fontFamily:"monospace", letterSpacing:"0.1em", textTransform:"uppercase", transition:"all 0.2s",
          }}>{loading ? "Generating..." : "Get Rebuttals →"}</button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign:"center", padding:"48px 0" }}>
          <div style={{ display:"flex", justifyContent:"center", gap:"6px", marginBottom:"16px" }}>
            {[0,1,2].map(i => <div key={i} style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#ff7832", animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
          <p style={{ color:"#7a7060", fontSize:"13px", fontFamily:"monospace" }}>Loading your rebuttals...</p>
        </div>
      )}

      {error && <div style={{ padding:"16px", background:"rgba(255,79,79,0.1)", border:"1px solid rgba(255,79,79,0.2)", borderRadius:"6px", color:"#ff8c8c", fontSize:"14px" }}>{error}</div>}

      {result && !loading && (
        <div style={{ animation:"fadeIn 0.4s ease" }}>
          <div style={{ marginBottom:"24px", padding:"12px 16px", background:"rgba(255,255,255,0.02)", borderLeft:"3px solid #ff7832", borderRadius:"0 4px 4px 0" }}>
            <span style={{ fontSize:"11px", color:"#7a7060", fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.1em" }}>Objection</span>
            <p style={{ margin:"4px 0 0", fontSize:"15px", color:"#c8b89a", fontStyle:"italic" }}>"{result.objection}"</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"12px", marginBottom:"24px" }}>
            {result.rebuttals.map((r, i) => {
              const colors = labelColors[r.label] || labelColors["Value-Led"];
              return (
                <div key={i} style={{ padding:"20px", borderRadius:"8px", border:`1px solid ${colors.border}`, background:colors.bg }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:colors.dot }} />
                      <span style={{ fontSize:"10px", fontFamily:"monospace", letterSpacing:"0.12em", textTransform:"uppercase", color:colors.text }}>{r.label}</span>
                    </div>
                    <button onClick={() => copyToClipboard(r.text, i)} style={{ background:"transparent", border:"none", color:copied===i ? colors.dot:"#4a4030", fontSize:"11px", fontFamily:"monospace", transition:"color 0.2s", padding:"2px 8px" }}>
                      {copied === i ? "✓ copied" : "copy"}
                    </button>
                  </div>
                  <p style={{ margin:0, fontSize:"15px", lineHeight:"1.65", color:"#d8cfc0" }}>{r.text}</p>
                </div>
              );
            })}
          </div>
          <div style={{ padding:"16px 20px", borderRadius:"6px", background:"rgba(255,120,50,0.05)", border:"1px solid rgba(255,120,50,0.15)" }}>
            <span style={{ fontSize:"10px", fontFamily:"monospace", color:"#ff7832", letterSpacing:"0.12em", textTransform:"uppercase" }}>Coach's tip</span>
            <p style={{ margin:"6px 0 0", fontSize:"14px", color:"#a89880", lineHeight:"1.6" }}>{result.tip}</p>
          </div>
          <button onClick={() => { setResult(null); setObjection(""); }} style={{ marginTop:"24px", background:"transparent", border:"1px solid #2a2520", color:"#7a7060", padding:"8px 20px", borderRadius:"4px", fontSize:"12px", fontFamily:"monospace", letterSpacing:"0.1em", textTransform:"uppercase" }}>
            ← New Objection
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CALL TRACKER
// ══════════════════════════════════════════════════════════════════
function CallTracker({ activeTab, setActiveTab }) {
  const [situationalQs, setSituationalQs] = useLocalStorage("ws_sqs", DEFAULT_SQS);
  const [painPoints, setPainPoints] = useLocalStorage("ws_pain", DEFAULT_PAIN);
  const [calls, setCalls] = useLocalStorage("ws_calls", []);
  const [step, setStep] = useState(1);
  const [current, setCurrent] = useState({});
  const [addingItem, setAddingItem] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [filterStep, setFilterStep] = useState("all");
  const [toast, setToast] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2400); };
  const resetLog = () => { setStep(1); setCurrent({}); };

  const pick = (key, value) => {
    const next = { ...current, [key]: value };
    setCurrent(next);
    if (key === "answered" && value === false) {
      setCalls(prev => [{ id: Date.now(), ts: new Date().toISOString(), answered: false }, ...prev]);
      showToast("Call logged — no answer"); resetLog(); return;
    }
    if (key === "answered") { setStep(3); return; }
    if (key === "opener")   { setStep(4); return; }
    if (key === "hook")     { setStep(5); return; }
    if (key === "sq")       { setStep(6); return; }
    if (key === "pain")     { setStep(7); return; }
    if (key === "meeting")  {
      setCalls(prev => [{ id: Date.now(), ts: new Date().toISOString(), ...next }, ...prev]);
      showToast(value ? "🎉 Meeting booked!" : "Call logged"); resetLog();
    }
  };

  const addItem = type => {
    if (!newItemText.trim()) return;
    const id = type + Date.now();
    if (type === "sq") setSituationalQs(prev => [...prev, { id, text: newItemText.trim() }]);
    else setPainPoints(prev => [...prev, { id, text: newItemText.trim() }]);
    setNewItemText(""); setAddingItem(null);
  };

  const deleteCall = id => setCalls(prev => prev.filter(c => c.id !== id));

  const exportCSV = () => {
    const headers = ["Date","Answered","Opener","7-Sec Hook","Situational Q","Pain Point","Meeting Booked"];
    const rows = calls.map(c => [
      formatDate(c.ts), c.answered?"Yes":"No",
      c.opener ? getLabel(c.opener,[OPENERS]) : "—",
      c.hook   ? getLabel(c.hook,[HOOKS])     : "—",
      c.sq     ? getLabel(c.sq,[situationalQs]) : "—",
      c.pain   ? getLabel(c.pain,[painPoints])  : "—",
      c.meeting?"Yes":c.answered?"No":"—",
    ]);
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`workstream-calls-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url); showToast("CSV exported!");
  };

  const analytics = useMemo(() => {
    const total = calls.length, answered = calls.filter(c=>c.answered).length, meetings = calls.filter(c=>c.meeting).length;
    const byOpener={}, byHook={}, bySQ={}, byPain={};
    OPENERS.forEach(o=>{byOpener[o.id]=emptyRate()});
    HOOKS.forEach(h=>{byHook[h.id]=emptyRate()});
    situationalQs.forEach(q=>{bySQ[q.id]=emptyRate()});
    painPoints.forEach(p=>{byPain[p.id]=emptyRate()});
    calls.filter(c=>c.answered).forEach(c=>{
      if(c.opener&&byOpener[c.opener]){byOpener[c.opener].uses++;if(c.meeting)byOpener[c.opener].meetings++;}
      if(c.hook&&byHook[c.hook]){byHook[c.hook].uses++;if(c.meeting)byHook[c.hook].meetings++;}
      if(c.sq&&bySQ[c.sq]){bySQ[c.sq].uses++;if(c.meeting)bySQ[c.sq].meetings++;}
      if(c.pain&&byPain[c.pain]){byPain[c.pain].uses++;if(c.meeting)byPain[c.pain].meetings++;}
    });
    return {total,answered,meetings,byOpener,byHook,bySQ,byPain};
  }, [calls,situationalQs,painPoints]);

  const STEP_LABELS = ["","Start","Answered?","Opener","7-Sec Hook","Situational Q","Pain Point","Outcome"];

  const cardStyle = { background:"rgba(255,255,255,0.03)", border:"1px solid #2a2520", borderRadius:12, padding:"22px 24px", marginBottom:14 };
  const labelStyle = { fontSize:10, color:"#7a7060", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10, display:"block", fontWeight:600, fontFamily:"monospace" };
  const choiceBtn = active => ({
    width:"100%", textAlign:"left", padding:"13px 16px", borderRadius:8, border:`1px solid ${active?"rgba(255,120,50,0.5)":"#2a2520"}`,
    background: active ? "rgba(255,120,50,0.12)" : "rgba(255,255,255,0.02)",
    color: active ? "#ff7832" : "#c8b89a",
    fontFamily:"'Georgia', serif", fontSize:14, marginBottom:8, transition:"all 0.12s", display:"block",
  });

  return (
    <div>
      {/* Top action bar for history/stats */}
      {(activeTab === "history" || activeTab === "dashboard") && (
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16, gap:8 }}>
          <button onClick={exportCSV} style={{ background:"#ff7832", color:"#0a0a0f", border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, fontFamily:"monospace", letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:700 }}>⬇ Export CSV</button>
        </div>
      )}

      {/* ── LOG ── */}
      {activeTab === "log" && (
        <div className="fade-up">
          {/* Step indicator */}
          <div style={{ display:"flex", alignItems:"center", marginBottom:28 }}>
            {[1,2,3,4,5,6,7].map((n,i) => (
              <div key={n} style={{ display:"flex", alignItems:"center" }}>
                <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background: step>n?"#4caf50":step===n?"#ff7832":"#2a2520", color: step>=n?"#0a0a0f":"#4a4030", fontSize:11, fontWeight:700, flexShrink:0, transition:"all 0.2s", fontFamily:"monospace" }}>{step>n?"✓":n}</div>
                {i<6 && <div style={{ width:20, height:2, background:step>n?"#4caf50":"#2a2520", transition:"background 0.3s" }} />}
              </div>
            ))}
            <span style={{ marginLeft:12, fontSize:11, color:"#7a7060", fontFamily:"monospace", letterSpacing:"0.08em", textTransform:"uppercase" }}>{STEP_LABELS[step]}</span>
          </div>

          {step === 1 && (
            <div style={cardStyle} className="fade-up">
              <span style={labelStyle}>Ready to log a call?</span>
              <p style={{ fontSize:14, color:"#7a7060", marginBottom:20, lineHeight:1.6 }}>Track every step — opener, hook, question, pain point, and outcome. Data saves automatically.</p>
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:18, background:"rgba(76,175,80,0.05)", border:"1px solid rgba(76,175,80,0.15)", borderRadius:8, padding:"10px 14px" }}>
                <span style={{ fontSize:16 }}>💾</span>
                <span style={{ fontSize:12, color:"#7a7060", lineHeight:1.5, fontFamily:"monospace" }}><span style={{ color:"#c8b89a" }}>{calls.length} calls</span> saved to your browser.</span>
              </div>
              <button onClick={() => setStep(2)} style={{ background:"#ff7832", color:"#0a0a0f", border:"none", borderRadius:8, padding:"14px 24px", fontSize:13, fontWeight:700, width:"100%", fontFamily:"monospace", letterSpacing:"0.08em", textTransform:"uppercase" }}>📞 Start Logging Call</button>
            </div>
          )}

          {step === 2 && (
            <div style={cardStyle} className="fade-up">
              <span style={labelStyle}>Did they answer?</span>
              {[{label:"✅  Yes, they picked up",val:true},{label:"📵  No answer / voicemail",val:false}].map(o=>(
                <button key={String(o.val)} className="choice" onClick={()=>pick("answered",o.val)} style={choiceBtn(current.answered===o.val)}>{o.label}</button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div style={cardStyle} className="fade-up">
              <span style={labelStyle}>Which opener did you use?</span>
              {OPENERS.map(o=><button key={o.id} className="choice" onClick={()=>pick("opener",o.id)} style={choiceBtn(current.opener===o.id)}>{o.text}</button>)}
            </div>
          )}

          {step === 4 && (
            <div style={cardStyle} className="fade-up">
              <span style={labelStyle}>Which 7-second hook did you use?</span>
              {HOOKS.map(h=><button key={h.id} className="choice" onClick={()=>pick("hook",h.id)} style={choiceBtn(current.hook===h.id)}>{h.text}</button>)}
            </div>
          )}

          {step === 5 && (
            <div style={cardStyle} className="fade-up">
              <span style={labelStyle}>Which situational question did you use?</span>
              {situationalQs.map(q=><button key={q.id} className="choice" onClick={()=>pick("sq",q.id)} style={choiceBtn(current.sq===q.id)}>{q.text}</button>)}
              {addingItem==="sq"
                ? <div style={{display:"flex",gap:8,marginTop:4}}><input autoFocus value={newItemText} onChange={e=>setNewItemText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem("sq")} placeholder="New question..." style={{flex:1,border:"1px solid #2a2520",borderRadius:8,padding:"10px 13px",fontSize:13,fontFamily:"'Georgia',serif",background:"rgba(255,255,255,0.03)",color:"#e8e0d0"}} /><button onClick={()=>addItem("sq")} style={{background:"#ff7832",color:"#0a0a0f",border:"none",borderRadius:8,padding:"0 16px",fontSize:12,fontFamily:"monospace",fontWeight:700}}>Add</button><button onClick={()=>{setAddingItem(null);setNewItemText("")}} style={{background:"#1a1a14",color:"#7a7060",border:"1px solid #2a2520",borderRadius:8,padding:"0 12px",fontSize:12}}>✕</button></div>
                : <button onClick={()=>setAddingItem("sq")} style={{color:"#4a4030",background:"none",border:"1px dashed #2a2520",borderRadius:8,padding:"10px 16px",fontSize:13,width:"100%",marginTop:2,fontFamily:"monospace",letterSpacing:"0.06em"}}>+ Add new question</button>
              }
            </div>
          )}

          {step === 6 && (
            <div style={cardStyle} className="fade-up">
              <span style={labelStyle}>Which pain point came up?</span>
              {painPoints.map(p=><button key={p.id} className="choice" onClick={()=>pick("pain",p.id)} style={choiceBtn(current.pain===p.id)}>{p.text}</button>)}
              {addingItem==="pp"
                ? <div style={{display:"flex",gap:8,marginTop:4}}><input autoFocus value={newItemText} onChange={e=>setNewItemText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem("pp")} placeholder="New pain point..." style={{flex:1,border:"1px solid #2a2520",borderRadius:8,padding:"10px 13px",fontSize:13,fontFamily:"'Georgia',serif",background:"rgba(255,255,255,0.03)",color:"#e8e0d0"}} /><button onClick={()=>addItem("pp")} style={{background:"#ff7832",color:"#0a0a0f",border:"none",borderRadius:8,padding:"0 16px",fontSize:12,fontFamily:"monospace",fontWeight:700}}>Add</button><button onClick={()=>{setAddingItem(null);setNewItemText("")}} style={{background:"#1a1a14",color:"#7a7060",border:"1px solid #2a2520",borderRadius:8,padding:"0 12px",fontSize:12}}>✕</button></div>
                : <button onClick={()=>setAddingItem("pp")} style={{color:"#4a4030",background:"none",border:"1px dashed #2a2520",borderRadius:8,padding:"10px 16px",fontSize:13,width:"100%",marginTop:2,fontFamily:"monospace",letterSpacing:"0.06em"}}>+ Add new question</button>
              }
            </div>
          )}

          {step === 7 && (
            <div style={cardStyle} className="fade-up">
              <span style={labelStyle}>What was the outcome?</span>
              {[{label:"🎉  Meeting booked!",val:true},{label:"❌  No meeting set",val:false}].map(o=>(
                <button key={String(o.val)} className="choice" onClick={()=>pick("meeting",o.val)} style={choiceBtn(current.meeting===o.val)}>{o.label}</button>
              ))}
            </div>
          )}

          {step > 1 && <button onClick={()=>setStep(s=>s-1)} style={{background:"none",border:"none",color:"#4a4030",fontSize:13,padding:"4px 0",marginTop:4,fontFamily:"monospace"}}>← Back</button>}
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {activeTab === "dashboard" && (
        <div className="fade-up">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
            {[
              {label:"Total Calls",val:analytics.total,color:"#f5ede0"},
              {label:"Answer Rate",val:pct(analytics.answered,analytics.total),color:"#7eb3ff"},
              {label:"Meetings",val:analytics.meetings,color:"#4caf50"},
              {label:"Meeting Rate",val:pct(analytics.meetings,analytics.answered),color:"#ff7832"},
            ].map(stat=>(
              <div key={stat.label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid #2a2520",borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:10,color:"#7a7060",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6,fontWeight:600,fontFamily:"monospace"}}>{stat.label}</div>
                <div style={{fontSize:28,fontWeight:300,color:stat.color,fontFamily:"monospace"}}>{stat.val}</div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#4a4030",fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",fontFamily:"monospace"}}>Filter:</span>
            {[["all","All"],["opener","Openers"],["hook","7-Sec Hooks"],["sq","Situational Qs"],["pain","Pain Points"]].map(([key,label])=>(
              <button key={key} onClick={()=>setFilterStep(key)} style={{padding:"5px 14px",borderRadius:99,border:`1px solid ${filterStep===key?"#ff7832":"#2a2520"}`,background:filterStep===key?"rgba(255,120,50,0.15)":"transparent",color:filterStep===key?"#ff7832":"#7a7060",fontSize:11,fontFamily:"monospace",letterSpacing:"0.08em",textTransform:"uppercase"}}>{label}</button>
            ))}
          </div>

          {(filterStep==="all"||filterStep==="opener") && <BreakdownSection title="Openers" items={OPENERS} data={analytics.byOpener} />}
          {(filterStep==="all"||filterStep==="hook")   && <BreakdownSection title="7-Second Hooks" items={HOOKS} data={analytics.byHook} />}
          {(filterStep==="all"||filterStep==="sq")     && <BreakdownSection title="Situational Questions" items={situationalQs} data={analytics.bySQ} />}
          {(filterStep==="all"||filterStep==="pain")   && <BreakdownSection title="Pain Points" items={painPoints} data={analytics.byPain} />}

          {analytics.total===0 && <div style={{textAlign:"center",color:"#4a4030",fontSize:14,padding:"60px 0",lineHeight:2,fontFamily:"monospace"}}>No calls logged yet.<br/>Head to Log Call to get started!</div>}
        </div>
      )}

      {/* ── HISTORY ── */}
      {activeTab === "history" && (
        <div className="fade-up">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <div style={{fontWeight:400,fontSize:15,color:"#f5ede0"}}>Call History</div>
              <div style={{fontSize:11,color:"#7a7060",marginTop:2,fontFamily:"monospace"}}>{calls.length} calls · saved to your browser</div>
            </div>
            {calls.length>0 && (
              confirmClear
                ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:12,color:"#7a7060",fontFamily:"monospace"}}>Sure?</span>
                    <button onClick={()=>{setCalls([]);setConfirmClear(false);showToast("History cleared");}} style={{background:"rgba(255,79,79,0.15)",color:"#ff8c8c",border:"1px solid rgba(255,79,79,0.3)",borderRadius:8,padding:"6px 12px",fontSize:11,fontFamily:"monospace"}}>Yes, clear</button>
                    <button onClick={()=>setConfirmClear(false)} style={{background:"transparent",color:"#7a7060",border:"1px solid #2a2520",borderRadius:8,padding:"6px 12px",fontSize:11,fontFamily:"monospace"}}>Cancel</button>
                  </div>
                : <button onClick={()=>setConfirmClear(true)} style={{background:"transparent",color:"#4a4030",border:"1px solid #2a2520",borderRadius:8,padding:"7px 14px",fontSize:11,fontFamily:"monospace",letterSpacing:"0.08em"}}>Clear all</button>
            )}
          </div>

          {calls.length===0 && <div style={{textAlign:"center",color:"#4a4030",fontSize:14,padding:"60px 0",fontFamily:"monospace"}}>No calls logged yet.</div>}

          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {calls.map(call=>(
              <div key={call.id} className="history-row" style={{background:"rgba(255,255,255,0.02)",border:"1px solid #2a2520",borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"flex-start",gap:12,transition:"background 0.12s"}}>
                <div style={{flexShrink:0,marginTop:2,fontSize:18}}>
                  {!call.answered?"📵":call.meeting?"🎉":"📞"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:call.answered?6:0}}>
                    <span style={{fontSize:11,color:"#4a4030",fontFamily:"monospace"}}>{formatDate(call.ts)}</span>
                    {!call.answered && <span style={{fontSize:11,color:"#ff7832",background:"rgba(255,120,50,0.1)",border:"1px solid rgba(255,120,50,0.2)",borderRadius:99,padding:"1px 8px",fontFamily:"monospace"}}>No answer</span>}
                    {call.meeting && <span style={{fontSize:11,color:"#4caf50",background:"rgba(76,175,80,0.1)",border:"1px solid rgba(76,175,80,0.2)",borderRadius:99,padding:"1px 8px",fontFamily:"monospace"}}>Meeting booked 🎉</span>}
                    {call.answered&&!call.meeting && <span style={{fontSize:11,color:"#7a7060",background:"rgba(255,255,255,0.03)",border:"1px solid #2a2520",borderRadius:99,padding:"1px 8px",fontFamily:"monospace"}}>No meeting</span>}
                  </div>
                  {call.answered && (
                    <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:4}}>
                      {call.opener && <div style={{fontSize:12,color:"#a89880"}}><span style={{color:"#4a4030",marginRight:6,fontFamily:"monospace"}}>Opener:</span>{getLabel(call.opener,[OPENERS])}</div>}
                      {call.hook   && <div style={{fontSize:12,color:"#a89880"}}><span style={{color:"#4a4030",marginRight:6,fontFamily:"monospace"}}>Hook:</span>{getLabel(call.hook,[HOOKS])}</div>}
                      {call.sq     && <div style={{fontSize:12,color:"#a89880"}}><span style={{color:"#4a4030",marginRight:6,fontFamily:"monospace"}}>Question:</span>{getLabel(call.sq,[situationalQs])}</div>}
                      {call.pain   && <div style={{fontSize:12,color:"#a89880"}}><span style={{color:"#4a4030",marginRight:6,fontFamily:"monospace"}}>Pain point:</span>{getLabel(call.pain,[painPoints])}</div>}
                    </div>
                  )}
                </div>
                <button className="del-btn" onClick={()=>deleteCall(call.id)} style={{background:"none",border:"none",color:"#2a2520",fontSize:18,padding:"2px 4px",flexShrink:0}}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-in" style={{position:"fixed",bottom:24,right:24,background:"#ff7832",color:"#0a0a0f",borderRadius:8,padding:"12px 20px",fontSize:13,fontWeight:700,fontFamily:"monospace",letterSpacing:"0.08em",boxShadow:"0 8px 28px rgba(255,120,50,0.3)",zIndex:999}}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Breakdown Section ──────────────────────────────────────────────
function BreakdownSection({ title, items, data }) {
  const sorted = [...items].map(item=>({...item, uses:data[item.id]?.uses||0, meetings:data[item.id]?.meetings||0}))
    .sort((a,b)=>(b.uses?b.meetings/b.uses:0)-(a.uses?a.meetings/a.uses:0));

  return (
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid #2a2520",borderRadius:12,padding:"20px 24px",marginBottom:14}}>
      <div style={{fontSize:10,fontWeight:700,color:"#ff7832",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16,fontFamily:"monospace"}}>{title}</div>
      {sorted.map((item,i)=>{
        const rate = item.uses ? Math.round((item.meetings/item.uses)*100) : 0;
        const barColor = rate>=30?"#4caf50":rate>=15?"#ff7832":"#2a2520";
        return (
          <div key={item.id} style={{marginBottom:i<sorted.length-1?18:0,paddingBottom:i<sorted.length-1?18:0,borderBottom:i<sorted.length-1?"1px solid #1a1a14":"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8}}>
              <div style={{fontSize:13,color:"#c8b89a",lineHeight:1.5,flex:1,fontFamily:"'Georgia',serif"}}>{item.text}</div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <span style={{background:"rgba(76,175,80,0.1)",color:"#4caf50",border:"1px solid rgba(76,175,80,0.2)",borderRadius:99,padding:"2px 9px",fontSize:11,fontFamily:"monospace"}}>{rate}% mtg</span>
                <span style={{background:"rgba(255,255,255,0.03)",color:"#7a7060",border:"1px solid #2a2520",borderRadius:99,padding:"2px 9px",fontSize:11,fontFamily:"monospace"}}>{item.uses} uses</span>
              </div>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{flex:1,height:4,background:"#1a1a14",borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${rate}%`,background:barColor,borderRadius:99,transition:"width 0.4s ease"}} />
              </div>
              <span style={{fontSize:11,color:"#2a2520",fontFamily:"monospace",whiteSpace:"nowrap"}}>{item.meetings}/{item.uses}</span>
            </div>
          </div>
        );
      })}
      {items.length===0 && <div style={{fontSize:13,color:"#4a4030",fontFamily:"monospace"}}>None yet.</div>}
    </div>
  );
}
