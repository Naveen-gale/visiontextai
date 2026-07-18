import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Rnd } from "react-rnd";
import { getPptHistoryById, savePptHistory, editSingleSlideData } from "../utils/api";
import { generatePptx, TEMPLATES } from "../utils/pptGenerator";
import { compileSlideToElements } from "../utils/templateCompiler";

// ── Slide Renderer (standalone, used in both preview and thumbnail) ────────────
function SlideView({ slide, tmpl, small = false, index = 0, total = 1 }) {
  if (slide.elements && slide.elements.length > 0) {
    const S = small ? 0.35 : 1;
    return (
      <div style={{ position:"relative", width:"100%", height:"100%", background:`#${tmpl.bg}`, overflow:"hidden", fontFamily:"'Segoe UI',Calibri,Arial,sans-serif" }}>
        {slide.elements.map(el => {
          const color = el.color ? (el.color.startsWith("#") ? el.color : `#${el.color}`) : "#000";
          if (el.type === "shape") {
             return <div key={el.id} style={{ position:"absolute", left:`${el.x}%`, top:`${el.y}%`, width:`${el.w}%`, height:`${el.h}%`, background:color, opacity:el.opacity||1, borderRadius:el.shape==="circle"?"50%":"0" }} />
          } else if (el.type === "image") {
             return <img key={el.id} src={el.src} alt="" style={{ position:"absolute", left:`${el.x}%`, top:`${el.y}%`, width:`${el.w}%`, height:`${el.h}%`, objectFit:"cover", borderRadius:"8px" }} />
          }
          return (
             <div key={el.id} style={{ position:"absolute", left:`${el.x}%`, top:`${el.y}%`, width:`${el.w}%`, height:`${el.h}%`, fontSize:`${el.fontSize * S}px`, color, fontWeight:el.bold?900:400, fontStyle:el.italic?"italic":"normal", textAlign:el.align, opacity:el.opacity||1, lineHeight:1.3 }}>
               {el.text}
             </div>
          );
        })}
      </div>
    );
  }

  const bg         = `#${tmpl.bg}`;
  const accent     = `#${tmpl.accent}`;
  const titleClr   = `#${tmpl.title}`;
  const bodyClr    = `#${tmpl.body}`;
  const hlClr      = `#${tmpl.highlight || tmpl.title}`;
  const subClr     = `#${tmpl.sub}`;

  // Scale font sizes for thumbnail vs full view
  const S = small ? 0.35 : 1;
  const fs = {
    mainTitle:  `${Math.max(14, 58 * S)}px`,
    mainSub:    `${Math.max(10, 26 * S)}px`,
    slideTitle: `${Math.max(12, 38 * S)}px`,
    heading:    `${Math.max(10, 24 * S)}px`,
    body:       `${Math.max(9,  24 * S)}px`,
    bodySmall:  `${Math.max(8,  18 * S)}px`,
    caption:    `${Math.max(8,  16 * S)}px`,
    badge:      `${Math.max(6,  12 * S)}px`,
    statVal:    `${Math.max(16, 56 * S)}px`,
    agendaNum:  `${Math.max(10, 20 * S)}px`,
    quoteText:  `${Math.max(14, 32 * S)}px`,
  };

  const base  = { position:"relative", width:"100%", height:"100%", background:bg, overflow:"hidden", fontFamily:"'Segoe UI',Calibri,Arial,sans-serif" };
  const inner = { position:"absolute", inset:0, display:"flex", flexDirection:"column", padding: small ? "6% 7% 10%" : "3.5% 4.5% 6%", boxSizing:"border-box" };

  const AccentBars = () => (
    <>
      <div style={{ position:"absolute", top:0, left:0, right:0, height: small ? "3px" : "5px", background:accent, zIndex:10 }} />
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height: small ? "2px" : "4px", background:accent, opacity:0.5, zIndex:10 }} />
    </>
  );

  const SlideNum = () => !small && (
    <div style={{ position:"absolute", bottom:"10px", right:"14px", fontSize:fs.badge, color:subClr, opacity:0.55, fontWeight:700, zIndex:5 }}>
      {index + 1} / {total}
    </div>
  );

  const Divider = () => (
    <div style={{ height: small ? "1.5px" : "2px", background:accent, opacity:0.4, borderRadius:"2px", marginBottom: small ? "5px" : "10px", flexShrink:0 }} />
  );

  const Title = ({ text }) => (
    <div style={{ flexShrink:0 }}>
      <div style={{ fontSize:fs.slideTitle, fontWeight:900, color:hlClr, lineHeight:1.2, marginBottom: small ? "3px" : "6px", wordBreak:"break-word" }}>{text}</div>
      <Divider />
    </div>
  );

  const Bullets = ({ bullets = [], size = fs.body }) => (
    <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap: small ? "3px" : "8px" }}>
      {(bullets || []).slice(0, small ? 4 : 7).map((b, i) => (
        <li key={i} style={{ display:"flex", gap: small ? "4px" : "8px", alignItems:"flex-start" }}>
          <span style={{ color:accent, fontWeight:900, fontSize:size, flexShrink:0, marginTop:"1px" }}>•</span>
          <span style={{ color:bodyClr, fontSize:size, lineHeight:1.45, fontWeight:500 }}>{b}</span>
        </li>
      ))}
    </ul>
  );

  switch ((slide.type || "content").toLowerCase()) {

    /* ── TITLE ── */
    case "title":
      return (
        <div style={base}>
          <AccentBars />
          <div style={{ position:"absolute", right:"-6%", top:"-14%", width:"48%", aspectRatio:"1", borderRadius:"50%", background:accent, opacity:0.07 }} />
          <div style={{ position:"absolute", left:"-3%", bottom:"-10%", width:"28%", aspectRatio:"1", borderRadius:"50%", background:accent, opacity:0.05 }} />
          <div style={{ ...inner, justifyContent:"center" }}>
            <div style={{ fontSize:fs.mainTitle, fontWeight:900, color:titleClr, lineHeight:1.12, marginBottom: small ? "6px" : "16px", wordBreak:"break-word" }}>{slide.title}</div>
            <div style={{ width: small ? "22%" : "18%", height: small ? "2px" : "3px", background:accent, borderRadius:"2px", marginBottom: small ? "6px" : "16px" }} />
            {slide.subtitle && <div style={{ fontSize:fs.mainSub, color:subClr, fontWeight:500, lineHeight:1.4 }}>{slide.subtitle}</div>}
          </div>
          <SlideNum />
        </div>
      );

    /* ── SECTION ── */
    case "section":
      return (
        <div style={base}>
          <div style={{ position:"absolute", inset:"28% 0", background:accent, opacity:0.09 }} />
          <AccentBars />
          {slide.sectionNumber && (
            <div style={{ position:"absolute", left:"4%", top:"6%", fontSize: small ? "28px" : "82px", fontWeight:900, color:accent, opacity:0.13, lineHeight:1 }}>{slide.sectionNumber}</div>
          )}
          <div style={{ ...inner, justifyContent:"center", alignItems:"center", textAlign:"center" }}>
            <div style={{ fontSize: small ? "12px" : "38px", fontWeight:900, color:titleClr, lineHeight:1.2, wordBreak:"break-word" }}>{slide.title}</div>
            {slide.subtitle && <div style={{ fontSize:fs.body, color:subClr, fontWeight:500, marginTop: small ? "4px" : "12px" }}>{slide.subtitle}</div>}
          </div>
          <SlideNum />
        </div>
      );

    /* ── AGENDA ── */
    case "agenda": {
      const items = slide.agendaItems || slide.bullets || [];
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap: small ? "3px" : "8px", overflow:"hidden", justifyContent:"space-around" }}>
            {items.slice(0, small ? 5 : 7).map((item, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap: small ? "5px" : "12px" }}>
                <div style={{ flexShrink:0, width: small ? "14px" : "26px", height: small ? "14px" : "26px", borderRadius:"50%", background:accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:fs.agendaNum, fontWeight:900, color:bg }}>{i + 1}</div>
                <div style={{ fontSize:fs.body, color:bodyClr, fontWeight:500 }}>{item}</div>
              </div>
            ))}
          </div>
          <SlideNum />
        </div>
      );
    }

    /* ── QUOTE / CALLOUT ── */
    case "quote":
    case "callout":
      return (
        <div style={base}>
          <AccentBars />
          <div style={{ position:"absolute", top:"5%", left:"3%", fontSize: small ? "30px" : "90px", color:accent, opacity:0.13, fontFamily:"serif", lineHeight:1 }}>"</div>
          <div style={{ ...inner, alignItems:"center", justifyContent:"center", textAlign:"center", gap: small ? "5px" : "14px" }}>
            <div style={{ fontSize:fs.quoteText, fontStyle:"italic", color:titleClr, lineHeight:1.5, fontWeight:600 }}>{slide.quote || slide.title}</div>
            {slide.author && <div style={{ fontSize:fs.caption, color:subClr, fontWeight:800, letterSpacing:"0.12em", textTransform:"uppercase" }}>— {slide.author}</div>}
          </div>
          <SlideNum />
        </div>
      );

    /* ── STATS / CHART ── */
    case "stats":
    case "chart": {
      const stats  = (slide.stats || []).slice(0, small ? 4 : 6);
      const perRow = stats.length <= 3 ? stats.length : stats.length <= 4 ? 2 : 3;
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, display:"grid", gridTemplateColumns:`repeat(${perRow},1fr)`, gap: small ? "4px" : "10px", overflow:"hidden" }}>
            {stats.map((s, i) => (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding: small ? "5px 3px" : "12px 8px", borderRadius:"10px", border:`1.5px solid ${accent}44`, background:`${accent}13`, overflow:"hidden" }}>
                <div style={{ fontSize:fs.statVal, fontWeight:900, color:accent, lineHeight:1, textAlign:"center" }}>{s.value}</div>
                <div style={{ fontSize:fs.caption, color:bodyClr, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginTop:"4px", textAlign:"center" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <SlideNum />
        </div>
      );
    }

    /* ── TWO-COLUMN ── */
    case "two-column":
    case "twocolumn": {
      const left  = slide.leftColumn  || {};
      const right = slide.rightColumn || {};
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, display:"flex", gap:"3%", overflow:"hidden" }}>
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap: small ? "3px" : "7px", overflow:"hidden" }}>
              <div style={{ fontSize:fs.heading, fontWeight:900, color:accent, textTransform:"uppercase", letterSpacing:"0.07em" }}>{left.heading || ""}</div>
              <div style={{ height:"1.5px", background:accent, opacity:0.3 }} />
              <Bullets bullets={left.bullets} />
            </div>
            <div style={{ width:"1.5px", background:accent, opacity:0.18, flexShrink:0 }} />
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap: small ? "3px" : "7px", overflow:"hidden" }}>
              <div style={{ fontSize:fs.heading, fontWeight:900, color:accent, textTransform:"uppercase", letterSpacing:"0.07em" }}>{right.heading || ""}</div>
              <div style={{ height:"1.5px", background:accent, opacity:0.3 }} />
              <Bullets bullets={right.bullets} />
            </div>
          </div>
          <SlideNum />
        </div>
      );
    }

    /* ── TIMELINE ── */
    case "timeline": {
      const items = (slide.timelineItems || []).slice(0, small ? 4 : 6);
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap: small ? "4px" : "8px", overflow:"hidden", justifyContent:"space-around" }}>
            {items.map((t, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap: small ? "6px" : "12px", overflow:"hidden" }}>
                <div style={{ flexShrink:0, width: small ? "6px" : "10px", height: small ? "6px" : "10px", borderRadius:"50%", background:accent, boxShadow:`0 0 6px ${accent}` }} />
                <div style={{ flexShrink:0, minWidth: small ? "30px" : "60px", fontSize:fs.heading, fontWeight:900, color:accent }}>{t.year}</div>
                <div style={{ fontSize:fs.body, color:bodyClr, lineHeight:1.35, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.event}</div>
              </div>
            ))}
          </div>
          <SlideNum />
        </div>
      );
    }

    /* ── COMPARISON / TABLE ── */
    case "comparison":
    case "table": {
      const headers = slide.tableHeaders || ["Feature", "A", "B"];
      const rows    = (slide.tableData || []).slice(0, small ? 4 : 7);
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", gap:"4px" }}>
            <div style={{ display:"flex", gap:"4px" }}>
              {headers.slice(0, 4).map((h, ci) => (
                <div key={ci} style={{ flex:1, background:accent, color:bg, fontSize:fs.heading, fontWeight:900, padding: small ? "3px 5px" : "6px 10px", borderRadius:"5px", textTransform:"uppercase" }}>{h}</div>
              ))}
            </div>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display:"flex", gap:"4px" }}>
                {(Array.isArray(row) ? row : [row]).slice(0, 4).map((cell, ci) => (
                  <div key={ci} style={{ flex:1, background: ri % 2 === 0 ? `${accent}15` : "transparent", color:bodyClr, fontSize:fs.body, fontWeight: ci === 0 ? 700 : 400, padding: small ? "2px 5px" : "5px 10px", borderRadius:"4px", border:`0.5px solid ${accent}22` }}>{cell}</div>
                ))}
              </div>
            ))}
          </div>
          <SlideNum />
        </div>
      );
    }

    /* ── SWOT ── */
    case "swot": {
      const q = slide.swotItems || {};
      const quads = [
        { label:"Strengths",     items:q.strengths    ||[], color:"#16a34a" },
        { label:"Weaknesses",    items:q.weaknesses   ||[], color:"#dc2626" },
        { label:"Opportunities", items:q.opportunities||[], color:"#2563eb" },
        { label:"Threats",       items:q.threats      ||[], color:"#d97706" },
      ];
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, display:"grid", gridTemplateColumns:"1fr 1fr", gridTemplateRows:"1fr 1fr", gap: small ? "3px" : "8px", overflow:"hidden" }}>
            {quads.map((quad, qi) => (
              <div key={qi} style={{ border:`1.5px solid ${quad.color}`, background:`${quad.color}14`, borderRadius:"8px", padding: small ? "4px 7px" : "10px 12px", overflow:"hidden", display:"flex", flexDirection:"column", gap:"3px" }}>
                <div style={{ fontSize:fs.heading, fontWeight:900, color:quad.color, textTransform:"uppercase", letterSpacing:"0.07em" }}>{quad.label}</div>
                {quad.items.slice(0, small ? 2 : 3).map((item, ii) => (
                  <div key={ii} style={{ fontSize:fs.body, color:bodyClr, fontWeight:400, lineHeight:1.3 }}>• {item}</div>
                ))}
              </div>
            ))}
          </div>
          <SlideNum />
        </div>
      );
    }

    /* ── PROCESS ── */
    case "process":
    case "flow": {
      const steps = (slide.processSteps || slide.bullets || []).slice(0, small ? 4 : 6);
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"space-around", overflow:"hidden" }}>
            {steps.map((step, si) => (
              <div key={si} style={{ display:"flex", alignItems:"center", gap: small ? "4px" : "8px" }}>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap: small ? "3px" : "6px", maxWidth: small ? "52px" : "90px" }}>
                  <div style={{ width: small ? "22px" : "40px", height: small ? "22px" : "40px", borderRadius:"50%", background:accent, color:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize: small ? "10px" : "16px", fontWeight:900 }}>{si + 1}</div>
                  <div style={{ fontSize:fs.body, color:bodyClr, textAlign:"center", fontWeight:500, wordBreak:"break-word", lineHeight:1.3 }}>{String(step).slice(0, small ? 16 : 25)}</div>
                </div>
                {si < steps.length - 1 && <div style={{ fontSize: small ? "14px" : "22px", color:accent, fontWeight:900, flexShrink:0 }}>›</div>}
              </div>
            ))}
          </div>
          <SlideNum />
        </div>
      );
    }

    /* ── IMAGE ── */
    case "image": {
      const hasImage = !!(slide.image);
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, display:"flex", gap:"3%", overflow:"hidden" }}>
            <div style={{ flex:1, overflow:"hidden" }}>
              <Bullets bullets={slide.bullets} size={hasImage ? fs.bodySmall : fs.body} />
              {!slide.bullets?.length && slide.subtitle && (
                <div style={{ fontSize:fs.body, color:subClr, fontWeight:500 }}>{slide.subtitle}</div>
              )}
            </div>
            {hasImage && (
              <div style={{ width:"42%", flexShrink:0, borderRadius:"10px", overflow:"hidden", border:`1.5px solid ${accent}33` }}>
                <img src={slide.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              </div>
            )}
          </div>
          <SlideNum />
        </div>
      );
    }

    /* ── IMAGE-FULL ── */
    case "image-full":
      return (
        <div style={base}>
          {slide.image && <img src={slide.image} alt={slide.title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, padding: small ? "4% 5%" : "4% 5%", background:"linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
            <div style={{ fontSize: small ? "10px" : "28px", fontWeight:900, color:"#ffffff" }}>{slide.title}</div>
            {slide.subtitle && <div style={{ fontSize: small ? "7px" : "16px", color:"rgba(255,255,255,0.75)", marginTop:"4px" }}>{slide.subtitle}</div>}
          </div>
          <SlideNum />
        </div>
      );

    /* ── THANK-YOU ── */
    case "thank-you":
    case "conclusion":
      return (
        <div style={{ ...base, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <AccentBars />
          <div style={{ position:"absolute", right:"-6%", top:"-14%", width:"48%", aspectRatio:"1", borderRadius:"50%", background:accent, opacity:0.07 }} />
          <div style={{ textAlign:"center", padding:"6% 8%" }}>
            <div style={{ fontSize: small ? "14px" : "52px", fontWeight:900, color:titleClr, lineHeight:1.15, wordBreak:"break-word" }}>{slide.title || "Thank You!"}</div>
            <div style={{ width: small ? "30px" : "80px", height: small ? "2px" : "3px", background:accent, borderRadius:"2px", margin: small ? "6px auto" : "16px auto" }} />
            {slide.subtitle && <div style={{ fontSize: small ? "7px" : "20px", color:subClr, fontWeight:500 }}>{slide.subtitle}</div>}
            {(slide.contact || slide.bullets?.[0]) && (
              <div style={{ marginTop: small ? "4px" : "12px", fontSize: small ? "6px" : "16px", color:accent, fontWeight:700 }}>{slide.contact || slide.bullets[0]}</div>
            )}
          </div>
        </div>
      );

    /* ── DEFAULT / CONTENT ── */
    default: {
      const hasImage = !!(slide.image);
      return (
        <div style={{ ...base, ...inner }}>
          <AccentBars />
          <Title text={slide.title} />
          <div style={{ flex:1, display:"flex", gap:"3%", overflow:"hidden" }}>
            <div style={{ flex:1, overflow:"hidden" }}>
              <Bullets bullets={slide.bullets} size={hasImage ? fs.bodySmall : fs.body} />
              {!slide.bullets?.length && slide.subtitle && (
                <div style={{ fontSize:fs.body, color:subClr, fontWeight:500, lineHeight:1.4 }}>{slide.subtitle}</div>
              )}
            </div>
            {hasImage && (
              <div style={{ width:"42%", flexShrink:0, borderRadius:"10px", overflow:"hidden", border:`1.5px solid ${accent}33` }}>
                <img src={slide.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              </div>
            )}
          </div>
          <SlideNum />
        </div>
      );
    }
  }
}

// ── Slide Editor Panel ──────────────────────────────────────────────────────
function SlideEditor({ slide, tmpl, onSave, onClose, onAiImprove, aiImproving }) {
  // Use elements if they exist, otherwise compile the slide's template layout into drag-and-drop elements
  const [elements, setElements] = useState(() => slide.elements?.length ? slide.elements : compileSlideToElements(slide, tmpl));
  const [selectedId, setSelectedId] = useState(null);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        // Leave 32px padding on sides (16px * 2)
        const availableWidth = entry.contentRect.width - 32;
        const availableHeight = entry.contentRect.height - 32;
        
        const scaleX = availableWidth / 1066;
        const scaleY = availableHeight / 600;
        
        // Take the smallest scale to maintain aspect ratio without clipping
        setScale(Math.min(1, scaleX, scaleY));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const updateElement = (id, updates) => setElements(p => p.map(e => e.id === id ? { ...e, ...updates } : e));

  const handleSave = () => {
    onSave({ ...slide, elements }); // Save the updated canvas elements array
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-950 backdrop-blur-sm overflow-hidden">
      {/* Header / Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:px-6 md:h-16 border-b border-slate-800 bg-slate-900 shrink-0 gap-4 overflow-x-auto">
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <h3 className="text-base md:text-lg font-black text-white shrink-0">🎨 Canvas Editor</h3>
          {selectedId && elements.find(e => e.id === selectedId)?.type === "text" && (
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg ml-4">
              <span className="text-xs font-bold text-slate-400 mr-2 uppercase tracking-widest">Font</span>
              <button onClick={() => updateElement(selectedId, { fontSize: elements.find(e=>e.id===selectedId).fontSize + 4 })} className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded font-black text-sm transition-colors">+</button>
              <button onClick={() => updateElement(selectedId, { fontSize: Math.max(10, elements.find(e=>e.id===selectedId).fontSize - 4) })} className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded font-black text-sm transition-colors">-</button>
              <div className="w-px h-6 bg-slate-700 mx-1" />
              <input 
                type="color" 
                value={(() => { const c = elements.find(e=>e.id===selectedId).color; return c.startsWith("#") ? c : `#${c}`; })()} 
                onChange={e => updateElement(selectedId, { color: e.target.value })} 
                className="w-8 h-8 rounded bg-transparent cursor-pointer" 
                title="Change Color"
              />
              <div className="w-px h-6 bg-slate-700 mx-1" />
              <button onClick={() => updateElement(selectedId, { bold: !elements.find(e=>e.id===selectedId).bold })} className={`w-8 h-8 rounded font-black text-sm transition-colors ${elements.find(e=>e.id===selectedId).bold ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>B</button>
              <button onClick={() => updateElement(selectedId, { italic: !elements.find(e=>e.id===selectedId).italic })} className={`w-8 h-8 rounded font-black text-sm italic transition-colors ${elements.find(e=>e.id===selectedId).italic ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>I</button>
            </div>
          )}
          {selectedId && (
            <button onClick={() => { setElements(p => p.filter(e => e.id !== selectedId)); setSelectedId(null); }} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-lg text-sm transition-colors">🗑 Delete Element</button>
          )}
          
          <button 
            onClick={() => {
              const newEl = { id: Math.random().toString(36).substr(2, 9), type: "text", text: "New Text", x: 40, y: 40, w: 20, h: 10, fontSize: 32, color: tmpl.body, align: "center" };
              setElements(p => [...p, newEl]);
              setSelectedId(newEl.id);
            }} 
            className="ml-4 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold rounded-lg text-sm transition-colors border border-indigo-500/30"
          >
            + Add Text Box
          </button>
        </div>
        <div className="flex gap-2 shrink-0 self-end md:self-auto">
          <button onClick={onClose} className="px-3 md:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors text-sm md:text-base">Cancel</button>
          <button onClick={handleSave} className="px-3 md:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-colors shadow-lg shadow-indigo-500/20 text-sm md:text-base">💾 Save Canvas</button>
        </div>
      </div>

      {/* Editor Canvas Area */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-4 md:p-8" onClick={() => setSelectedId(null)}>
        {/* We use 1066x600 for a 16:9 canvas to edit on, scaled dynamically */}
        <div className="relative shadow-2xl ring-1 ring-slate-700 overflow-hidden shrink-0" style={{ width: 1066, height: 600, background: `#${tmpl.bg}`, fontFamily:"'Segoe UI',Calibri,Arial,sans-serif", transform: `scale(${scale})` }}>
          {elements.map(el => {
            const color = el.color ? (el.color.startsWith("#") ? el.color : `#${el.color}`) : "#000";
            
            if (el.type === "shape" || el.type === "image") {
              return (
                <div key={el.id} style={{ position:"absolute", left:`${el.x}%`, top:`${el.y}%`, width:`${el.w}%`, height:`${el.h}%`, background:el.type==="shape"?color:"transparent", opacity:el.opacity||1, borderRadius:el.shape==="circle"?"50%":"0", pointerEvents:"none" }}>
                  {el.type==="image" && <img src={el.src} alt="" style={{width:"100%", height:"100%", objectFit:"cover"}} />}
                </div>
              );
            }
            
            const isSelected = selectedId === el.id;
            return (
              <Rnd
                key={el.id}
                bounds="parent"
                position={{ x: (el.x / 100) * 1066, y: (el.y / 100) * 600 }}
                size={{ width: (el.w / 100) * 1066, height: (el.h / 100) * 600 }}
                onDragStop={(e, d) => updateElement(el.id, { x: (d.x / 1066) * 100, y: (d.y / 600) * 100 })}
                onResizeStop={(e, dir, ref, delta, position) => {
                  updateElement(el.id, {
                    w: (parseFloat(ref.style.width) / 1066) * 100,
                    h: (parseFloat(ref.style.height) / 600) * 100,
                    x: (position.x / 1066) * 100,
                    y: (position.y / 600) * 100
                  });
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                className={isSelected ? "ring-2 ring-indigo-500 z-50 bg-indigo-500/10 cursor-move" : "hover:ring-1 ring-slate-500/50 cursor-pointer"}
              >
                <textarea
                  value={el.text}
                  onChange={(e) => updateElement(el.id, { text: e.target.value })}
                  style={{
                    width:"100%", height:"100%", background:"transparent", border:"none", outline:"none", resize:"none",
                    fontSize:`${el.fontSize}px`, color, fontWeight:el.bold?900:400, fontStyle:el.italic?"italic":"normal", textAlign:el.align,
                    lineHeight:1.3
                  }}
                />
              </Rnd>
            );
          })}
        </div>
      </div>
      
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur text-slate-400 font-bold text-xs px-4 py-2 rounded-full ring-1 ring-slate-800 pointer-events-none">
        💡 Drag boxes to move · Drag edges to resize · Select text to edit · Use toolbar to change font/color
      </div>
    </div>,
    document.body
  );
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SharePpt() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [downloading, setDownloading]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [aiImproving, setAiImproving]   = useState(false);
  const [localSlides, setLocalSlides]   = useState(null); // user's local edits
  const [savingCopy, setSavingCopy]     = useState(false);
  const [savedCopy, setSavedCopy]       = useState(false);
  const [toast, setToast]       = useState("");
  const thumbRef    = useRef(null);
  const containerRef= useRef(null);

  const slides = localSlides || data?.slides || [];
  const slide  = slides[currentIndex];
  const tmpl   = data ? (TEMPLATES[data.template] || TEMPLATES.corporate) : TEMPLATES.corporate;

  /* ── Fetch ── */
  useEffect(() => {
    getPptHistoryById(id)
      .then(item => { setData(item); setLocalSlides(null); })
      .catch(() => setError("Could not load presentation. It may have been deleted."))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── Keyboard nav ── */
  useEffect(() => {
    if (!slides.length) return;
    const onKey = e => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault(); setCurrentIndex(p => Math.min(slides.length - 1, p + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault(); setCurrentIndex(p => Math.max(0, p - 1));
      } else if (e.key === "Home") setCurrentIndex(0);
      else if (e.key === "End")  setCurrentIndex(slides.length - 1);
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else if (e.key === "e" || e.key === "E") setShowEditor(true);
      else if (e.key === "Escape") { setShowEditor(false); if (isFullscreen) document.exitFullscreen?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, isFullscreen, currentIndex]);

  /* ── Auto-scroll thumbnail ── */
  useEffect(() => {
    if (!thumbRef.current) return;
    const el = thumbRef.current.querySelector(`[data-thumb="${currentIndex}"]`);
    el?.scrollIntoView({ behavior:"smooth", block:"nearest" });
  }, [currentIndex]);

  /* ── Fullscreen listener ── */
  useEffect(() => {
    const onFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFS);
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const handleDownload = async () => {
    if (!data) return;
    const defaultName = (data.prompt || "Presentation").slice(0, 15).replace(/[^a-z0-9]/gi, "_");
    const name = window.prompt("Enter filename:", defaultName);
    if (name === null) return;
    setDownloading(true);
    try {
      const blob = await generatePptx(slides, data.template, data.fontStyle);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${name || defaultName}.pptx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Save edit ── */
  const handleSaveSlide = async (editedSlide) => {
    const updated = [...slides];
    updated[currentIndex] = editedSlide;
    
    try {
      const { updatePptHistory } = await import("../utils/api");
      await updatePptHistory(id, { slides: updated });
      setData(prev => ({ ...prev, slides: updated }));
      setLocalSlides(null);
      setShowEditor(false);
      showToast("✅ Slide saved permanently!");
    } catch (err) {
      console.error(err);
      setLocalSlides(updated);
      setShowEditor(false);
      showToast("⚠️ Saved locally (you may not be the owner)");
    }
  };

  /* ── AI Improve current slide ── */
  const handleAiImprove = async (editedSlide) => {
    setAiImproving(true);
    try {
      const improved = await editSingleSlideData(
        "Make this slide more professional, detailed, and impactful. Expand bullet points with specific facts and data. Keep the same slide type and structure.",
        editedSlide
      );
      const updated = [...slides];
      updated[currentIndex] = { ...editedSlide, ...improved, type: editedSlide.type };
      setLocalSlides(updated);
      setShowEditor(false);
      showToast("✨ AI improved this slide!");
    } catch (err) {
      alert("AI improve failed: " + err.message);
    } finally {
      setAiImproving(false);
    }
  };

  /* ── AI Improve Entire Presentation ── */
  const handleAiImproveAll = async () => {
    if (!window.confirm("AI will improve all slides with better content. This may take a moment. Continue?")) return;
    setAiImproving(true);
    showToast("✨ AI is improving all slides…");
    try {
      const { editPptData } = await import("../utils/api");
      const updatedSlides = await editPptData(
        "Make this presentation more professional, factual, and detailed. Expand every bullet point with specific real-world facts, statistics, and examples. Keep slide types intact.",
        slides
      );
      if (updatedSlides?.length) {
        setLocalSlides(updatedSlides);
        showToast("✅ All slides improved by AI!");
      }
    } catch (err) {
      showToast("❌ AI improve failed: " + err.message);
    } finally {
      setAiImproving(false);
    }
  };

  /* ── Save My Copy ── */
  const handleSaveCopy = async () => {
    setSavingCopy(true);
    try {
      await savePptHistory({
        prompt: data.prompt || "Shared Presentation",
        slideCount: slides.length,
        template: data.template || "corporate",
        fontStyle: data.fontStyle || "modern",
        slides,
      });
      setSavedCopy(true);
      showToast("✅ Saved to your history! Go to AI PPT to view.");
    } catch (err) {
      showToast("❌ Save failed. Please log in first.");
    } finally {
      setSavingCopy(false);
    }
  };

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center gap-6">
        <div className="w-14 h-14 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-400 font-bold text-lg">Loading presentation…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-5xl">😢</div>
        <h2 className="text-2xl font-black text-white">Presentation Not Found</h2>
        <p className="text-slate-400 max-w-md">{error || "This link may be expired or invalid."}</p>
        <Link to="/" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all">← Go Home</Link>
      </div>
    );
  }

  const total = slides.length;
  const hasLocalEdits = !!localSlides;
  
  const userStr = localStorage.getItem("user");
  let userId = null;
  if (userStr) {
    try { userId = JSON.parse(userStr)._id; } catch(e) {}
  }
  // Allow editing if the current user is the owner, or if the presentation has no owner (legacy) BUT the user must be logged in to claim it.
  const isOwner = userId ? (!data.userId || data.userId === userId) : false;

  return (
    <div ref={containerRef} className="bg-slate-950 h-screen flex flex-col overflow-hidden" style={{ fontFamily:"'Outfit','Segoe UI',sans-serif" }}>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 bg-slate-800 border border-slate-700 text-white font-bold rounded-2xl shadow-2xl text-sm"
          >{toast}</motion.div>
        )}
      </AnimatePresence>

      {/* ── Editor Modal ── */}
      <AnimatePresence>
        {showEditor && slide && (
          <SlideEditor
            slide={slide}
            tmpl={tmpl}
            onSave={handleSaveSlide}
            onClose={() => setShowEditor(false)}
            onAiImprove={handleAiImprove}
            aiImproving={aiImproving}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      {!isFullscreen && (
        <div className="flex-none flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 gap-3 flex-wrap">
          <Link to="/" className="flex items-center gap-2 text-white font-black text-base no-underline hover:text-indigo-400 transition-colors shrink-0">
            <span className="text-xl">⚡</span><span className="hidden sm:block">VisionText AI</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            {hasLocalEdits && (
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest px-2 py-1 bg-amber-400/10 border border-amber-400/30 rounded-full">Unsaved Edits</span>
            )}

            {/* AI Improve All */}
            {isOwner && (
              <button
                onClick={handleAiImproveAll}
                disabled={aiImproving}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 font-bold rounded-xl border border-purple-500/30 text-xs transition-all disabled:opacity-50"
              >
                {aiImproving ? <div className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> : "✨"} AI Improve All
              </button>
            )}

            {/* Edit current slide */}
            {isOwner && (
              <button
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs transition-all"
                title="Edit slide [E]"
              >
                ✏️ Edit Slide
              </button>
            )}

            {/* Save copy */}
            <button
              onClick={handleSaveCopy}
              disabled={savingCopy || savedCopy}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 font-bold rounded-xl border border-emerald-500/30 text-xs transition-all disabled:opacity-50"
              title="Save to your history"
            >
              {savingCopy ? "Saving…" : savedCopy ? "✅ Saved!" : "💾 Save Copy"}
            </button>

            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs transition-all"
            >
              {copied ? "✅ Copied!" : "🔗 Copy Link"}
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 text-xs transition-all"
              title="Fullscreen [F]"
            >
              ⛶ Full Screen
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50"
            >
              {downloading ? "Generating…" : "⬇ Download"}
            </button>
          </div>
        </div>
      )}

      {/* ── Body: Sidebar + Main ── */}
      <div className="flex-1 flex min-h-0">

        {/* Thumbnail Sidebar */}
        {!isFullscreen && (
          <div ref={thumbRef} className="hidden md:flex flex-col gap-2 p-2 bg-slate-900/80 border-r border-slate-800 overflow-y-auto w-40 lg:w-48 shrink-0">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 px-1 py-1">{total} Slides</div>
            {slides.map((s, i) => (
              <button
                key={i}
                data-thumb={i}
                onClick={() => setCurrentIndex(i)}
                className={`group w-full text-left rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  i === currentIndex ? "border-indigo-500 ring-2 ring-indigo-500/20 scale-[1.02]" : "border-transparent hover:border-slate-700"
                }`}
              >
                {/* Mini preview */}
                <div className="aspect-video w-full relative overflow-hidden" style={{ background: `#${tmpl.bg}` }}>
                  <SlideView slide={s} tmpl={tmpl} small={true} />
                </div>
                {/* Badge */}
                <div className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest truncate ${
                  i === currentIndex ? "bg-indigo-600 text-white" : "bg-slate-800/80 text-slate-500"
                }`}>
                  {i + 1}. {(s.type || "content").replace("-", " ")}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Slide area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Slide canvas */}
          <div className={`flex-1 flex items-center justify-center min-h-0 ${isFullscreen ? "bg-black p-0" : "bg-slate-950/60 p-3 sm:p-5"}`}>
            <div
              className="relative overflow-hidden shadow-2xl"
              style={{
                aspectRatio: "16/9",
                width: "100%",
                maxWidth: isFullscreen ? "100vw" : "calc(100% - 8px)",
                maxHeight: isFullscreen ? "100vh" : "calc(100vh - 180px)",
                borderRadius: isFullscreen ? 0 : "16px",
                boxShadow: isFullscreen ? "none" : "0 0 0 1px rgba(255,255,255,0.08)",
              }}
              onDoubleClick={() => setShowEditor(true)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity:0, x:40 }}
                  animate={{ opacity:1, x:0 }}
                  exit={{ opacity:0, x:-40 }}
                  transition={{ duration:0.22, ease:"easeOut" }}
                  style={{ position:"absolute", inset:0 }}
                >
                  {slide && <SlideView slide={slide} tmpl={tmpl} small={false} index={currentIndex} total={total} />}
                </motion.div>
              </AnimatePresence>

              {/* Fullscreen edit hint */}
              {isFullscreen && (
                <div className="absolute top-3 right-3 flex gap-2">
                  <button onClick={() => setShowEditor(true)} className="px-3 py-1 bg-black/50 hover:bg-black/80 text-white text-xs font-bold rounded-lg backdrop-blur-sm">✏️ Edit</button>
                  <button onClick={toggleFullscreen} className="px-3 py-1 bg-black/50 hover:bg-black/80 text-white text-xs font-bold rounded-lg backdrop-blur-sm">✕ Exit</button>
                </div>
              )}

              {/* Prev/Next click zones */}
              {!isFullscreen && currentIndex > 0 && (
                <button onClick={() => setCurrentIndex(p => p - 1)} className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-black/20 to-transparent group">
                  <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white font-black group-hover:scale-110 transition-transform">‹</div>
                </button>
              )}
              {!isFullscreen && currentIndex < total - 1 && (
                <button onClick={() => setCurrentIndex(p => p + 1)} className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-black/20 to-transparent group">
                  <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white font-black group-hover:scale-110 transition-transform">›</div>
                </button>
              )}
            </div>
          </div>

          {/* Nav footer */}
          {!isFullscreen && (
            <div className="flex-none flex items-center justify-between px-4 py-2.5 bg-slate-900 border-t border-slate-800 gap-3">
              <button
                onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl transition-all disabled:opacity-30 font-bold text-xs"
              >← Prev</button>

              {/* Dot nav */}
              <div className="flex-1 flex items-center justify-center gap-1.5 overflow-hidden">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    title={slides[i]?.title || `Slide ${i + 1}`}
                    className="rounded-full transition-all"
                    style={{ width: i === currentIndex ? "10px" : "6px", height: i === currentIndex ? "10px" : "6px", background: i === currentIndex ? `#${tmpl.accent}` : "#475569", border:"none", cursor:"pointer", outline:"none", flexShrink:0 }}
                  />
                ))}
              </div>

              <div className="text-xs font-bold text-slate-500 shrink-0">{currentIndex + 1} / {total}</div>

              <button
                onClick={() => setCurrentIndex(p => Math.min(total - 1, p + 1))}
                disabled={currentIndex === total - 1}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl transition-all disabled:opacity-30 font-bold text-xs"
              >Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard hint bar */}
      {!isFullscreen && (
        <div className="text-center text-[10px] font-bold text-slate-700 py-1 bg-slate-950 shrink-0">
          ← → navigate &nbsp;·&nbsp; F = fullscreen &nbsp;·&nbsp; E = edit slide &nbsp;·&nbsp; Double-click slide to edit
        </div>
      )}
    </div>
  );
}
