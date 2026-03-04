import { useState, useEffect } from "react";

const OBJECTIONS = [
  "We already have a system",
  "We're not looking right now",
  "Send me an email",
  "We don't have budget",
  "I'm not the right person",
  "We tried something like this before",
  "Call me back next quarter",
  "We're happy with what we have",
  "I'm really busy right now",
];

const CACHE_KEY = "workstream-objection-cache";

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function fetchRebuttal(objection) {
  const res = await fetch("/api/rebuttal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objection }),
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
}

export default function App() {
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

      const missing = OBJECTIONS.filter((o) => !existingCache[o]);
      if (missing.length === 0) return;

      setPreloading(true);
      const newCache = { ...existingCache };

      await Promise.all(
        missing.map(async (obj) => {
          try {
            const parsed = await fetchRebuttal(obj);
            newCache[obj] = { objection: obj, ...parsed };
            // Update state incrementally so ⚡ icons appear as each one finishes
            setCache((prev) => ({ ...prev, [obj]: newCache[obj] }));
            setCachedKeys((prev) => new Set([...prev, obj]));
          } catch {}
        })
      );

      saveCache(newCache);
      setPreloading(false);
    };

    loadAndPreload();
  }, []);

  const handleSubmit = async (text) => {
    const query = text || objection;
    if (!query.trim()) return;

    if (cache[query]) {
      setResult(cache[query]);
      setObjection(query);
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const parsed = await fetchRebuttal(query);
      const newResult = { objection: query, ...parsed };
      setResult(newResult);

      const newCache = { ...cache, [query]: newResult };
      setCache(newCache);
      setCachedKeys(new Set(Object.keys(newCache)));
      saveCache(newCache);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (obj) => {
    setObjection(obj);
    handleSubmit(obj);
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  const labelColors = {
    "Curious & Disarming": { bg: "#1a2a1a", border: "#2d5a2d", text: "#6ee86e", dot: "#4caf50" },
    "Value-Led": { bg: "#1a1f2e", border: "#2d3f6e", text: "#7eb3ff", dot: "#4a7fff" },
    "Challenge & Redirect": { bg: "#2a1a1a", border: "#6e2d2d", text: "#ff8c8c", dot: "#ff4f4f" },
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Georgia', serif",
      color: "#e8e0d0", padding: "0", position: "relative", overflow: "hidden",
    }}>
      {/* Grain */}
      <div style={{
        position: "fixed", inset: 0, opacity: 0.03, pointerEvents: "none", zIndex: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }} />
      {/* Glow */}
      <div style={{
        position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: "600px", height: "400px", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse, rgba(255,120,50,0.06) 0%, transparent 70%)",
      }} />

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "48px 24px", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(255,120,50,0.1)", border: "1px solid rgba(255,120,50,0.2)",
            borderRadius: "4px", padding: "4px 12px", marginBottom: "20px",
          }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff7832", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "11px", letterSpacing: "0.15em", color: "#ff7832", fontFamily: "monospace", textTransform: "uppercase" }}>Workstream SDR Toolkit</span>
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: "400", lineHeight: "1.1", margin: "0 0 12px", letterSpacing: "-0.02em", color: "#f5ede0" }}>
            Objection<br /><em style={{ color: "#ff7832" }}>Handler.</em>
          </h1>
          <p style={{ color: "#7a7060", fontSize: "15px", margin: 0, lineHeight: "1.6" }}>
            Drop an objection. Get 3 battle-tested rebuttals instantly.
          </p>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: "flex", marginBottom: "24px", border: "1px solid #2a2520", borderRadius: "6px", overflow: "hidden", width: "fit-content" }}>
          {["quick", "custom"].map((mode) => (
            <button key={mode} onClick={() => setInputMode(mode)} style={{
              padding: "8px 20px", border: "none", cursor: "pointer", fontSize: "12px",
              fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase",
              background: inputMode === mode ? "#ff7832" : "transparent",
              color: inputMode === mode ? "#0a0a0f" : "#7a7060", transition: "all 0.2s",
            }}>
              {mode === "quick" ? "Quick Pick" : "Type It"}
            </button>
          ))}
        </div>

        {/* Quick Pick */}
        {inputMode === "quick" && (
          <div style={{ marginBottom: "32px" }}>
            {preloading && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ff7832", animation: "pulse 1s infinite" }} />
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#7a7060", letterSpacing: "0.08em" }}>Caching responses for instant access...</span>
              </div>
            )}
            {!preloading && cachedKeys.size >= OBJECTIONS.length && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4caf50" }} />
                <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#4caf50", letterSpacing: "0.08em" }}>All responses cached — instant access ready</span>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {OBJECTIONS.map((obj) => {
                const isCached = cachedKeys.has(obj);
                const isSelected = objection === obj;
                return (
                  <button key={obj} onClick={() => handleQuickSelect(obj)} style={{
                    padding: "8px 16px", borderRadius: "4px", cursor: "pointer", fontSize: "13px",
                    border: "1px solid", fontFamily: "'Georgia', serif", transition: "all 0.15s",
                    background: isSelected ? "rgba(255,120,50,0.15)" : "rgba(255,255,255,0.02)",
                    color: isSelected ? "#ff7832" : "#c8b89a",
                    borderColor: isSelected ? "rgba(255,120,50,0.4)" : isCached ? "rgba(76,175,80,0.25)" : "#2a2520",
                  }}>
                    {obj}
                    {isCached && !isSelected && <span style={{ marginLeft: "6px", fontSize: "9px", color: "#4caf50", fontFamily: "monospace" }}>⚡</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Input */}
        {inputMode === "custom" && (
          <div style={{ marginBottom: "32px" }}>
            <textarea
              value={objection}
              onChange={(e) => setObjection(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
              placeholder='e.g. "We already use ADP for everything..."'
              rows={3}
              style={{
                width: "100%", padding: "16px", borderRadius: "6px", resize: "none",
                background: "rgba(255,255,255,0.03)", border: "1px solid #2a2520",
                color: "#e8e0d0", fontSize: "15px", fontFamily: "'Georgia', serif",
                outline: "none", lineHeight: "1.6", boxSizing: "border-box",
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(255,120,50,0.4)"}
              onBlur={(e) => e.target.style.borderColor = "#2a2520"}
            />
            <button onClick={() => handleSubmit()} disabled={loading || !objection.trim()} style={{
              marginTop: "12px", padding: "12px 32px", borderRadius: "4px", border: "none",
              background: loading || !objection.trim() ? "#2a2520" : "#ff7832",
              color: loading || !objection.trim() ? "#4a4030" : "#0a0a0f",
              fontSize: "13px", fontFamily: "monospace", letterSpacing: "0.1em",
              textTransform: "uppercase", cursor: loading || !objection.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}>
              {loading ? "Generating..." : "Get Rebuttals →"}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "16px" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff7832", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <p style={{ color: "#7a7060", fontSize: "13px", fontFamily: "monospace" }}>Loading your rebuttals...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: "16px", background: "rgba(255,79,79,0.1)", border: "1px solid rgba(255,79,79,0.2)", borderRadius: "6px", color: "#ff8c8c", fontSize: "14px" }}>
            {error}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: "24px", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderLeft: "3px solid #ff7832", borderRadius: "0 4px 4px 0" }}>
              <span style={{ fontSize: "11px", color: "#7a7060", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Objection</span>
              <p style={{ margin: "4px 0 0", fontSize: "15px", color: "#c8b89a", fontStyle: "italic" }}>"{result.objection}"</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {result.rebuttals.map((r, i) => {
                const colors = labelColors[r.label] || labelColors["Value-Led"];
                return (
                  <div key={i} style={{ padding: "20px", borderRadius: "8px", border: `1px solid ${colors.border}`, background: colors.bg }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: colors.dot }} />
                        <span style={{ fontSize: "10px", fontFamily: "monospace", letterSpacing: "0.12em", textTransform: "uppercase", color: colors.text }}>{r.label}</span>
                      </div>
                      <button onClick={() => copyToClipboard(r.text, i)} style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        color: copied === i ? colors.dot : "#4a4030", fontSize: "11px",
                        fontFamily: "monospace", transition: "color 0.2s", padding: "2px 8px",
                      }}>
                        {copied === i ? "✓ copied" : "copy"}
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: "15px", lineHeight: "1.65", color: "#d8cfc0" }}>{r.text}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "16px 20px", borderRadius: "6px", background: "rgba(255,120,50,0.05)", border: "1px solid rgba(255,120,50,0.15)" }}>
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#ff7832", letterSpacing: "0.12em", textTransform: "uppercase" }}>Coach's tip</span>
              <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#a89880", lineHeight: "1.6" }}>{result.tip}</p>
            </div>

            <button onClick={() => { setResult(null); setObjection(""); }} style={{
              marginTop: "24px", background: "transparent", border: "1px solid #2a2520",
              color: "#7a7060", padding: "8px 20px", borderRadius: "4px", cursor: "pointer",
              fontSize: "12px", fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              ← New Objection
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
