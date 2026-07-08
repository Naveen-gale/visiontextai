import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { History as HistoryIcon, Rocket, Sparkles, Presentation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generatePptData, uploadPptFile, savePptHistory, generatePptOutline, generatePptSlide, analyzeReferencePpt, generateInsertedSlideData, saveAiCorrection, predictTheme, predictStructure } from "../utils/api";
import { generatePptx, TEMPLATES, FONT_STYLES } from "../utils/pptGenerator";
import EditableText from "../components/EditableText";
import HistoryModal from "../components/modals/HistoryModal";

// ─── Constants ───────────────────────────────────────────────────────────────
const SLIDE_COUNTS = [0, 4, 6, 8, 10, 12, 15]; // 0 is Auto

const LEARNING_BADGE = (
  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
    </span>
    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Auto-Learning AI Active</span>
  </div>
);

// ─── Slide Preview component ─────────────────────────────────────────────────
function SlidePreview({ slide, template, index, isActive, onClick }) {
  const tmpl = TEMPLATES[template] || TEMPLATES.corporate;
  const fmtCol = (c) => c ? (c.startsWith("#") ? c : `#${c}`) : "#000000";

  const renderContent = () => {
    if (slide.type === "title") {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <div className="text-xl sm:text-2xl font-black mb-2" style={{ color: `#${tmpl.title}`, lineHeight: 1.2 }}>{slide.title}</div>
          {slide.subtitle && <div className="text-[10px] sm:text-xs font-bold opacity-80" style={{ color: `#${tmpl.sub}` }}>{slide.subtitle}</div>}
        </div>
      );
    }
    if (slide.type === "quote") {
      return (
        <div className="flex flex-col justify-center h-full p-6">
          <div className="text-4xl font-serif leading-none mb-2" style={{ color: `#${tmpl.accent}` }}>"</div>
          <div className="text-sm sm:text-base font-bold italic mb-4" style={{ color: `#${tmpl.title}` }}>{slide.quote || slide.title}</div>
          {slide.author && <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-right" style={{ color: `#${tmpl.sub}` }}>— {slide.author}</div>}
        </div>
      );
    }
    if (slide.type === "stats") {
      return (
        <div className="flex flex-col h-full p-4">
          <div className="text-sm sm:text-base font-black mb-4 border-b pb-2" style={{ color: `#${tmpl.highlight}`, borderColor: `#${tmpl.accent}33` }}>{slide.title}</div>
          <div className="grid grid-cols-2 gap-2 flex-grow content-start">
            {(slide.stats || []).slice(0, 4).map((s, i) => (
              <div key={i} className="flex flex-col p-2 rounded-lg border bg-white/5" style={{ borderColor: `#${tmpl.accent}55` }}>
                <div className="text-lg sm:text-xl font-black" style={{ color: `#${tmpl.accent}` }}>{s.value}</div>
                <div className="text-[8px] sm:text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1" style={{ color: `#${tmpl.text}` }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (slide.type === "two-column") {
      return (
        <div className="flex flex-col h-full p-4">
          <div className="text-sm sm:text-base font-black mb-4 border-b pb-2" style={{ color: `#${tmpl.highlight}`, borderColor: `#${tmpl.accent}33` }}>{slide.title}</div>
          <div className="flex flex-1 gap-4">
            <div className="flex-1 flex flex-col gap-2">
              <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1" style={{ color: `#${tmpl.accent}` }}>{slide.leftColumn?.heading}</div>
              {(slide.leftColumn?.bullets || []).slice(0, 3).map((b, i) => (
                <div key={i} className="text-[8px] sm:text-[10px] font-medium leading-relaxed flex gap-2" style={{ color: `#${tmpl.text}` }}>
                  <span style={{ color: `#${tmpl.accent}` }}>•</span> <span>{b}</span>
                </div>
              ))}
            </div>
            <div className="w-px h-full" style={{ background: `#${tmpl.accent}44` }} />
            <div className="flex-1 flex flex-col gap-2">
              <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest mb-1" style={{ color: `#${tmpl.accent}` }}>{slide.rightColumn?.heading}</div>
              {(slide.rightColumn?.bullets || []).slice(0, 3).map((b, i) => (
                <div key={i} className="text-[8px] sm:text-[10px] font-medium leading-relaxed flex gap-2" style={{ color: `#${tmpl.text}` }}>
                  <span style={{ color: `#${tmpl.accent}` }}>•</span> <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (slide.type === "timeline") {
      return (
        <div className="flex flex-col h-full p-4">
          <div className="text-sm sm:text-base font-black mb-4 border-b pb-2" style={{ color: `#${tmpl.highlight}`, borderColor: `#${tmpl.accent}33` }}>{slide.title}</div>
          <div className="flex flex-col gap-3 flex-grow justify-center relative pl-2">
            <div className="absolute left-3 top-0 bottom-0 w-px" style={{ background: `#${tmpl.accent}44` }} />
            {(slide.timelineItems || []).slice(0, 5).map((t, i) => (
              <div key={i} className="flex gap-4 relative z-10">
                <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: `#${tmpl.accent}` }} />
                <div className="flex flex-col pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: `#${tmpl.accent}` }}>{t.year}</span>
                  <span className="text-[8px] sm:text-[10px] font-medium mt-0.5" style={{ color: `#${tmpl.text}` }}>{t.event}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    // Default: content with bullets
    return (
      <div className="flex flex-col h-full p-4">
        <div className="text-sm sm:text-base font-black mb-4 border-b pb-2" style={{ color: `#${tmpl.highlight}`, borderColor: `#${tmpl.accent}33` }}>{slide.title}</div>
        <div className="flex gap-4 flex-1">
          <ul className="flex-1 flex flex-col gap-2">
            {(slide.bullets || []).slice(0, 5).map((b, i) => (
              <li key={i} className="text-[8px] sm:text-[10px] font-medium leading-relaxed flex gap-2" style={{ color: `#${tmpl.text}` }}>
                 <span style={{ color: `#${tmpl.accent}` }}>•</span> <span>{b}</span>
              </li>
            ))}
            {!slide.bullets?.length && slide.subtitle && (
              <div className="text-[10px] sm:text-xs font-bold opacity-80" style={{ color: `#${tmpl.sub}` }}>{slide.subtitle}</div>
            )}
          </ul>
          {slide.image && (
            <div className="w-1/3 flex items-center justify-center">
              <img src={slide.image} alt="Slide topic" className="w-full h-auto object-cover rounded shadow-md border border-white/10 max-h-full" />
            </div>
          )}
        </div>
        
        {/* Extra Text (Full Control) */}
        {slide.extraText?.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {slide.extraText.map((txt, i) => (
              <div key={i} className="text-[8px] sm:text-[10px] font-medium opacity-70" style={{ color: fmtCol(tmpl.body) }}>{txt}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const isFirstSlide = index === 0;

  return (
    <div
      className={`relative w-full aspect-[16/9] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
        isActive ? "ring-4 ring-offset-2 ring-offset-slate-900 shadow-2xl scale-[1.02]" : "ring-1 ring-white/10"
      }`}
      style={{
        background: fmtCol(tmpl.bg),
        ['--tw-ring-color']: isActive ? fmtCol(tmpl.accent) : undefined
      }}
      onClick={onClick}
      role="button"
      aria-label={`Slide ${index + 1}: ${slide.title}`}
    >
      <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: fmtCol(tmpl.accent) }} />
      
      {/* Delete button (Full Control) */}
      <button 
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 border border-red-500/30"
        onClick={(e) => { e.stopPropagation(); slide.onDelete?.(); }}
        title="Delete Slide"
      >
        🗑️
      </button>

      <div className="absolute inset-0 overflow-hidden">
        {renderContent()}
      </div>
      <div className="absolute bottom-2 right-3 text-[8px] font-black opacity-50" style={{ color: fmtCol(tmpl.body) }}>{index + 1}</div>

    </div>
  );
}

// ─── Full-screen preview modal ────────────────────────────────────────────────
function FullPreviewModal({ slides, currentIndex, onUpdateSlide, onUpdateAllSlides, onClose, onPrev, onNext, template, customColors, fontStyle }) {
  const tmpl = customColors || TEMPLATES[template] || TEMPLATES.corporate;
  const slide = slides[currentIndex];
  const fmtCol = (c) => c ? (c.startsWith("#") ? c : `#${c}`) : "#000000";
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [editPrompt, setEditPrompt] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);

    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "Escape" && !isFullscreen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onNext, onPrev, onClose, isFullscreen]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editPrompt.trim()) return;
    setIsEditing(true);
    setEditError("");
    try {
      const { editSingleSlideData } = await import("../utils/api");
      const updatedSlide = await editSingleSlideData(editPrompt, slide);
      
      // Preserve custom styles if AI missed them
      if (!updatedSlide.customStyles && slide.customStyles) {
        updatedSlide.customStyles = slide.customStyles;
      }
      
      onUpdateSlide(currentIndex, updatedSlide);
      
      // Learn from the prompt/result if possible
      saveAiCorrection({
        originalValue: slide.title + " " + (slide.bullets?.join(" ") || ""),
        correctedValue: updatedSlide.title + " " + (updatedSlide.bullets?.join(" ") || ""),
        type: "style",
        slideTopic: updatedSlide.title
      });
      
      setEditPrompt("");
    } catch (err) {
      setEditError(err.message);
    } finally {
      setIsEditing(false);
    }
  };

  const handleInsertBlank = () => {
    const newSlide = {
      type: "content",
      title: "New Slide",
      bullets: ["New point..."]
    };
    const newSlides = [...slides];
    newSlides.splice(currentIndex + 1, 0, newSlide);
    onUpdateAllSlides(newSlides);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (!slide) return null;

  const updateField = (field, newText) => {
    const originalValue = slide[field];
    if (originalValue && newText && originalValue !== newText) {
      saveAiCorrection({
        originalValue,
        correctedValue: newText,
        type: field,
        slideTopic: slide.title,
        slideType: slide.type
      });
    }
    onUpdateSlide(currentIndex, { ...slide, [field]: newText });
  };

  const updatePos = (field, pos) => {
    onUpdateSlide(currentIndex, {
      ...slide,
      layout: {
        ...slide.layout,
        text: {
          ...slide.layout?.text,
          [field]: pos
        }
      }
    });
  };

  const updateCustomSize = (field, size) => {
    onUpdateSlide(currentIndex, { 
      ...slide, 
      customStyles: { ...slide.customStyles, [field]: { ...slide.customStyles?.[field], fontSize: size } }
    });
  };

  const updateArrayField = (field, arrIndex, newText) => {
    const arr = [...(slide[field] || [])];
    const originalValue = arr[arrIndex];
    if (originalValue && newText && originalValue !== newText) {
      saveAiCorrection({
        originalValue,
        correctedValue: newText,
        type: field,
        slideTopic: slide.title,
        slideType: slide.type
      });
    }
    arr[arrIndex] = newText;
    onUpdateSlide(currentIndex, { ...slide, [field]: arr });
  };

  const updateArrayPos = (field, arrIndex, pos) => {
    const textLayout = slide.layout?.text || {};
    const arr = { ...(textLayout[field] || {}) };
    arr[arrIndex] = pos;
    onUpdateSlide(currentIndex, {
      ...slide,
      layout: {
        ...slide.layout,
        text: {
          ...textLayout,
          [field]: arr
        }
      }
    });
  };

  const updateArraySize = (field, arrIndex, size) => {
    const arrStyles = { ...(slide.customStyles?.[field] || {}) };
    arrStyles[arrIndex] = { fontSize: size };
    onUpdateSlide(currentIndex, {
      ...slide,
      customStyles: { ...slide.customStyles, [field]: arrStyles }
    });
  };

  // Helper object field updater (e.g. stats, timeline)
  const updateObjArrayField = (field, arrIndex, attr, newText) => {
    const arr = [...(slide[field] || [])];
    const originalValue = arr[arrIndex]?.[attr];
    if (originalValue && newText && originalValue !== newText) {
      saveAiCorrection({
        originalValue: String(originalValue),
        correctedValue: String(newText),
        type: field,
        slideTopic: slide.title,
        slideType: slide.type
      });
    }
    arr[arrIndex] = { ...arr[arrIndex], [attr]: newText };
    onUpdateSlide(currentIndex, { ...slide, [field]: arr });
  };
  // Helper for two-column
  const updateColField = (colName, attr, newText, arrIndex = null) => {
    const col = { ...slide[colName] };
    if (arrIndex !== null) {
      const arr = [...(col[attr] || [])];
      const originalValue = arr[arrIndex];
      if (originalValue && newText && originalValue !== newText) {
         saveAiCorrection({ originalValue, correctedValue: newText, type: "bullet", slideTopic: slide.title, slideType: slide.type });
      }
      if (newText === null) {
        arr.splice(arrIndex, 1);
      } else {
        arr[arrIndex] = newText;
      }
      col[attr] = arr;
    } else {
      const originalValue = col[attr];
      if (originalValue && newText && originalValue !== newText) {
         saveAiCorrection({ originalValue, correctedValue: newText, type: "general", slideTopic: slide.title, slideType: slide.type });
      }
      col[attr] = newText;
    }
    onUpdateSlide(currentIndex, { ...slide, [colName]: col });
  };

  const addItem = (field, defaultValue) => {
    const arr = [...(slide[field] || [])];
    arr.push(defaultValue);
    onUpdateSlide(currentIndex, { ...slide, [field]: arr });
  };

  const removeItem = (field, index) => {
    const arr = [...(slide[field] || [])];
    arr.splice(index, 1);
    onUpdateSlide(currentIndex, { ...slide, [field]: arr });
  };

  const handleUploadImage = () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const { uploadImageFile } = await import("../utils/api");
        const url = await uploadImageFile(file);
        if (url) {
           onUpdateSlide(currentIndex, { ...slide, image: url });
        }
      } catch (err) {
        console.error(err);
        alert("Upload error.");
      }
    };
    fileInput.click();
  };

  const handleImageUrl = () => {
    const defaultUrl = slide.image || ("https://loremflickr.com/800/600/" + encodeURIComponent(slide.title || "presentation"));
    const action = window.prompt("Enter an image URL:", defaultUrl);
    
    if (action === null) return;
    if (action.trim() === "") {
      onUpdateSlide(currentIndex, { ...slide, image: null });
    } else {
      onUpdateSlide(currentIndex, { ...slide, image: action.trim() });
    }
  };

  const handleRemoveImage = () => {
    onUpdateSlide(currentIndex, { ...slide, image: null });
  };

  const removeImage = (idx) => {
    const arr = [...(slide.images || [])];
    arr.splice(idx, 1);
    onUpdateSlide(currentIndex, { ...slide, images: arr });
  };

  const updateBgColor = (col) => {
    onUpdateSlide(currentIndex, { ...slide, bgColor: col });
  };

  const addExtraText = () => {
    const arr = [...(slide.extraText || [])];
    arr.push("New text block...");
    onUpdateSlide(currentIndex, { ...slide, extraText: arr });
  };

  const removeExtraText = (i) => {
    const arr = [...(slide.extraText || [])];
    arr.splice(i, 1);
    onUpdateSlide(currentIndex, { ...slide, extraText: arr });
  };

  const updateExtraText = (i, val) => {
    const arr = [...(slide.extraText || [])];
    const originalValue = arr[i];
    if (originalValue && val && originalValue !== val) {
      saveAiCorrection({
        originalValue,
        correctedValue: val,
        type: "extraText",
        slideTopic: slide.title
      });
    }
    arr[i] = val;
    onUpdateSlide(currentIndex, { ...slide, extraText: arr });
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-950 animate-in fade-in duration-300" role="dialog" aria-modal="true" ref={containerRef}>
      <div className="w-full h-full flex flex-col overflow-hidden relative">
        <div className={`absolute top-0 left-0 w-full flex items-center justify-between p-4 sm:p-6 z-50 pointer-events-none transition-opacity duration-300 ${isFullscreen ? "opacity-0 hover:opacity-100" : "opacity-100"}`}>
          <div className="flex items-center gap-4 pointer-events-auto">
            <span className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md text-slate-300 text-xs font-black uppercase tracking-widest rounded-lg border border-slate-700/50 shadow-lg">{currentIndex + 1} / {slides.length}</span>
          </div>
           <div className="flex items-center gap-3 pointer-events-auto">
             <div className="flex items-center bg-slate-800 rounded-full px-1 py-1 border border-slate-700">
                <input 
                  type="color" 
                  value={fmtCol(slide.bgColor || tmpl.bg)}
                  onChange={(e) => updateBgColor(e.target.value)}
                  className="w-8 h-8 rounded-full bg-transparent border-none cursor-pointer p-0 overflow-hidden"
                  title="Slide Background Override"
                />
                <button 
                  onClick={() => updateBgColor(null)}
                  className="text-[10px] px-2 py-1 text-slate-400 hover:text-white"
                  title="Reset Background"
                >
                  Reset
                </button>
              </div>
              <button 
                onClick={handleInsertBlank}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-all active:scale-95"
              >
                <span>➕</span> New Slide
              </button>
             <select 
               className="bg-slate-900/80 backdrop-blur-md text-slate-300 text-xs font-black uppercase tracking-widest rounded-lg border border-slate-700/50 px-3 py-2 outline-none"
               value={slide.type}
               onChange={(e) => onUpdateSlide(currentIndex, { ...slide, type: e.target.value })}
             >
               {["title", "content", "image", "two-column", "quote", "timeline", "stats"].map(t => (
                 <option key={t} value={t}>{t.toUpperCase()}</option>
               ))}
             </select>

             <button className="w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-all font-bold shadow-lg border border-slate-700/50" onClick={toggleFullscreen} title="Toggle Fullscreen">
               {isFullscreen ? "🗗" : "⛶"}
             </button>
             <button className="w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-slate-300 hover:bg-red-500 hover:text-white transition-all font-bold shadow-lg border border-slate-700/50" onClick={onClose} aria-label="Close preview">✕</button>
          </div>
        </div>

        {/* Floating AI Edit Command Bar */}
        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4 pointer-events-auto transition-opacity duration-300 ${isFullscreen ? "opacity-0 hover:opacity-100" : "opacity-100"}`}>
           <form onSubmit={handleEditSubmit} className="flex flex-col sm:flex-row w-full gap-2 items-center relative p-2 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-full shadow-2xl">
               <div className="absolute left-6 top-1/2 -translate-y-1/2 text-purple-400 text-xl pointer-events-none">✨</div>
               <input
                 type="text"
                 className="flex-1 bg-transparent !border-0 !ring-0 focus:outline-none pl-12 pr-4 py-3 text-sm font-bold text-white w-full placeholder-slate-400"
                 placeholder="e.g. 'Make this slide more professional' or 'Add a slide about pricing'"
                 value={editPrompt}
                 onChange={(e) => setEditPrompt(e.target.value)}
                 disabled={isEditing}
               />
               <button 
                 type="submit" 
                 disabled={isEditing || !editPrompt.trim()}
                 className="px-6 py-3 w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-full transition-all shadow-lg active:scale-95"
               >
                 {isEditing ? "Editing..." : "Update AI"}
               </button>
           </form>
           {editError && <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl">⚠️ {editError}</div>}
        </div>

        <div
          className="flex-1 relative overflow-hidden flex items-center justify-center bg-slate-950 p-1 sm:p-2 mb-4"
          style={{ fontFamily: FONT_STYLES[fontStyle]?.body || "Calibri, sans-serif" }}
        >
          <button 
            className={`absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-800/50 hover:bg-slate-700 text-white flex items-center justify-center z-20 backdrop-blur-md transition-all shadow-xl border border-slate-700 disabled:opacity-30 ${isFullscreen ? "opacity-0 hover:opacity-100" : "opacity-100"}`}
            onClick={onPrev} disabled={currentIndex === 0}
          >
            ←
          </button>
          
          <button 
            className={`absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-800/50 hover:bg-slate-700 text-white flex items-center justify-center z-20 backdrop-blur-md transition-all shadow-xl border border-slate-700 disabled:opacity-30 ${isFullscreen ? "opacity-0 hover:opacity-100" : "opacity-100"}`}
            onClick={onNext} disabled={currentIndex === slides.length - 1}
          >
            →
          </button>

          <AnimatePresence mode="wait">
            {isEditing && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center text-white"
              >
                <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
                <div className="text-xl font-black tracking-widest uppercase animate-pulse">AI is thinking...</div>
                <div className="text-slate-400 text-sm mt-2">Updating your presentation deck</div>
              </motion.div>
            )}

            <motion.div
              key={currentIndex}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="relative w-full max-w-[100vw] sm:max-w-[98vw] aspect-[16/9] max-h-[100vh] sm:max-h-[90vh] shadow-[0_0_100px_rgba(0,0,0,0.8)] sm:rounded-3xl overflow-hidden ring-1 ring-white/10 flex flex-col"
              style={{ background: fmtCol(tmpl.bg) }}
            >
              <div className="absolute top-0 left-0 w-full h-2 z-10" style={{ background: fmtCol(tmpl.accent) }} />

          {/* Empty State / Dashboard (Pro Builder) */}
          {((!slide.title && !slide.quote && !slide.bullets?.length && !slide.stats?.length && !slide.timelineItems?.length) || slide.type === "blank") ? (
             <div className="flex flex-col items-center justify-center h-full p-20 animate-in zoom-in duration-500">
                <div className="text-4xl mb-4" style={{ color: fmtCol(tmpl.accent) }}>🏗️</div>
                <h2 className="text-3xl font-black mb-2" style={{ color: fmtCol(tmpl.title) }}>Empty Slide</h2>
                <p className="text-sm opacity-60 mb-12 text-center max-w-md" style={{ color: fmtCol(tmpl.sub) }}>Start building your manual slide by selecting a layout or adding elements below.</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full max-w-4xl">
                  {[
                    { id: 'title', icon: '📝', label: 'Title Slide' },
                    { id: 'content', icon: '📄', label: 'List Content' },
                    { id: 'stats', icon: '📊', label: 'Data Stats' },
                    { id: 'timeline', icon: '⏳', label: 'Timeline' },
                    { id: 'image', icon: '🖼️', label: 'Visual Image' },
                    { id: 'two-column', icon: '👥', label: 'Conversion' },
                    { id: 'quote', icon: '💬', label: 'Quote' }
                  ].map(l => (
                    <button 
                      key={l.id}
                      onClick={() => onUpdateSlide(currentIndex, { ...slide, type: l.id, title: "New Heading", bullets: l.id === 'content' ? ["Point 1"] : [] })}
                      className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border-2 border-white/5 hover:border-purple-500/50 hover:bg-white/10 transition-all group"
                    >
                      <span className="text-3xl group-hover:scale-125 transition-transform">{l.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: fmtCol(tmpl.accent) }}>{l.label}</span>
                    </button>
                  ))}
                </div>
                
                <button 
                  onClick={addExtraText}
                  className="mt-12 group flex items-center gap-3 px-8 py-4 bg-slate-900 border border-slate-700 rounded-2xl hover:bg-slate-800 transition-all"
                >
                  <span className="text-xl group-hover:rotate-12 transition-transform">➕</span>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Add Individual Text Block</span>
                </button>
             </div>
          ) : slide.type === "title" ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4 sm:p-8 overflow-hidden">
              <EditableText 
                value={slide.title} onChange={(v) => updateField("title", v)}
                pos={slide.layout?.text?.title} onPosChange={(p) => updatePos("title", p)}
                baseSize={56} fontSize={slide.customStyles?.title?.fontSize} onSizeChange={(s) => updateCustomSize("title", s)}
                className="font-black mb-6 w-full text-center flex-shrink-0" style={{ color: fmtCol(tmpl.title), lineHeight: 1.2, fontFamily: "'Space Grotesk', sans-serif" }} 
              />
              <EditableText 
                value={slide.subtitle || ""} onChange={(v) => updateField("subtitle", v)}
                pos={slide.layout?.text?.subtitle} onPosChange={(p) => updatePos("subtitle", p)}
                baseSize={30} fontSize={slide.customStyles?.subtitle?.fontSize} onSizeChange={(s) => updateCustomSize("subtitle", s)}
                className="font-bold opacity-80 w-full text-center" style={{ color: fmtCol(tmpl.sub) }} 
              />
            </div>
          ) : slide.type === "quote" ? (
            <div className="flex flex-col justify-center h-full p-12 xs:p-20 relative">
              <div className="text-[120px] font-serif leading-none absolute top-12 left-12 opacity-20" style={{ color: fmtCol(tmpl.accent) }}>"</div>
              <EditableText 
                value={slide.quote || slide.title || ""} onChange={(v) => updateField("quote", v)}
                pos={slide.layout?.text?.quote} onPosChange={(p) => updatePos("quote", p)}
                baseSize={40} fontSize={slide.customStyles?.quote?.fontSize} onSizeChange={(s) => updateCustomSize("quote", s)}
                className="font-bold italic relative z-10 w-full" style={{ color: fmtCol(tmpl.title), lineHeight: 1.4 }} 
              />
              <div className="mt-8 text-right relative z-10">
                <EditableText 
                  value={slide.author || ""} onChange={(v) => updateField("author", v)}
                  pos={slide.layout?.text?.author} onPosChange={(p) => updatePos("author", p)}
                  baseSize={24} fontSize={slide.customStyles?.author?.fontSize} onSizeChange={(s) => updateCustomSize("author", s)}
                  className="font-black uppercase tracking-[0.2em] inline-block text-right" style={{ color: fmtCol(tmpl.sub) }} placeholder="Author name"
                />
              </div>
            </div>
          ) : slide.type === "stats" ? (
            <div className="flex flex-col h-full p-4 sm:p-8 overflow-hidden">
              <EditableText 
                value={slide.title} onChange={(v) => updateField("title", v)}
                pos={slide.layout?.text?.title} onPosChange={(p) => updatePos("title", p)}
                baseSize={48} fontSize={slide.customStyles?.title?.fontSize} onSizeChange={(s) => updateCustomSize("title", s)}
                component="h2" className="font-black mb-8 border-b-2 pb-4 w-full flex justify-between items-center" 
                style={{ color: tmpl.highlight.startsWith("#") ? tmpl.highlight : `#${tmpl.highlight}`, borderColor: (tmpl.accent.startsWith("#") ? tmpl.accent : `#${tmpl.accent}`) + "33" }} 
              >
                <div className="flex gap-2">
                  <button onClick={addExtraText} title="Add own text/copy-paste" className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">+ Add Text</button>
                  <button onClick={() => addItem("stats", { value: "0", label: "New Stat" })} className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">+</button>
                  <button onClick={handleUploadImage} className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">
                    🖼️ Upload Image
                  </button>
                  <button onClick={handleImageUrl} className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">
                    🌐 Image URL
                  </button>
                  {slide.image && (
                    <button onClick={handleRemoveImage} className="text-[10px] bg-slate-800 text-red-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">
                      🗑️ Remove Image
                    </button>
                  )}
                </div>
              </EditableText>
              <div className="grid grid-cols-2 gap-6 flex-grow content-start">
                {(slide.stats || []).map((s, i) => (
                  <div key={i} className="flex flex-col p-6 rounded-2xl border-2 bg-white/5 relative group" style={{ borderColor: fmtCol(tmpl.accent) + "66" }}>
                     <button onClick={() => removeItem("stats", i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500">✕</button>
                     <EditableText 
                        value={s.value} onChange={(v) => updateObjArrayField("stats", i, "value", v)}
                        pos={slide.layout?.text?.stats_val?.[i]} onPosChange={(p) => updateArrayPos("stats_val", i, p)}
                        baseSize={64} fontSize={slide.customStyles?.stats_val?.[i]?.fontSize} onSizeChange={(sz) => updateArraySize("stats_val", i, sz)}
                        className="font-black w-full" style={{ color: fmtCol(tmpl.accent), lineHeight: 1 }} 
                     />
                     <div className="mt-2">
                       <EditableText 
                          value={s.label} onChange={(v) => updateObjArrayField("stats", i, "label", v)}
                          baseSize={20} fontSize={slide.customStyles?.stats_lbl?.[i]?.fontSize} onSizeChange={(sz) => updateArraySize("stats_lbl", i, sz)}
                          className="font-bold opacity-80 uppercase tracking-widest w-full" style={{ color: fmtCol(tmpl.body) }} 
                       />
                     </div>
                  </div>
                ))}
              </div>
            </div>
          ) : slide.type === "two-column" ? (
            <div className="flex flex-col h-full p-4 sm:p-8 overflow-hidden">
              <EditableText 
                value={slide.title} onChange={(v) => updateField("title", v)}
                pos={slide.layout?.text?.title} onPosChange={(p) => updatePos("title", p)}
                baseSize={48} fontSize={slide.customStyles?.title?.fontSize} onSizeChange={(s) => updateCustomSize("title", s)}
                component="h2" className="font-black mb-8 border-b-2 pb-4 w-full" style={{ color: fmtCol(tmpl.highlight), borderColor: fmtCol(tmpl.accent) + "33" }} 
              />
              <div className="flex flex-1 gap-8">
                <div className="flex-1 flex flex-col gap-4">
                  <EditableText 
                    className="font-black uppercase tracking-widest w-full mb-2" style={{ color: tmpl.accent.startsWith("#") ? tmpl.accent : `#${tmpl.accent}` }} 
                    value={slide.leftColumn?.heading} onChange={(v) => updateColField("leftColumn", "heading", v)}
                    pos={slide.layout?.text?.leftHead} onPosChange={(p) => updatePos("leftHead", p)}
                    baseSize={24} fontSize={slide.customStyles?.leftHead?.fontSize} onSizeChange={(s) => updateCustomSize("leftHead", s)}
                  />
                  {(slide.leftColumn?.bullets || []).map((b, i) => (
                    <div key={i} className="flex gap-4 group relative">
                      <button onClick={() => updateColField("leftColumn", "bullets", null, i)} className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 text-red-500 hover:scale-110 transition-all font-bold">✕</button>
                      <span className="text-2xl font-black mt-[-4px]" style={{ color: tmpl.accent.startsWith("#") ? tmpl.accent : `#${tmpl.accent}` }}>•</span>
                      <EditableText 
                        className="font-medium leading-relaxed w-full" style={{ color: tmpl.body.startsWith("#") ? tmpl.body : `#${tmpl.body}` }} 
                        value={b} onChange={(v) => updateColField("leftColumn", "bullets", v, i)}
                        pos={slide.layout?.text?.leftBullets?.[i]} onPosChange={(p) => updateArrayPos("leftBullets", i, p)}
                        baseSize={24} fontSize={slide.customStyles?.leftBullets?.[i]?.fontSize} onSizeChange={(s) => updateArraySize("leftBullets", i, s)}
                      />
                    </div>
                  ))}
                  <button onClick={() => updateColField("leftColumn", "bullets", [...(slide.leftColumn?.bullets || []), "New point"], null)} className="text-xs text-slate-500">+ Add Point</button>
                </div>
                <div className="w-0.5 h-full opacity-30" style={{ background: tmpl.accent.startsWith("#") ? tmpl.accent : `#${tmpl.accent}` }} />
                <div className="flex-1 flex flex-col gap-4">
                  <EditableText 
                    className="font-black uppercase tracking-widest w-full mb-2" style={{ color: tmpl.accent.startsWith("#") ? tmpl.accent : `#${tmpl.accent}` }} 
                    value={slide.rightColumn?.heading} onChange={(v) => updateColField("rightColumn", "heading", v)}
                    pos={slide.layout?.text?.rightHead} onPosChange={(p) => updatePos("rightHead", p)}
                    baseSize={24} fontSize={slide.customStyles?.rightHead?.fontSize} onSizeChange={(s) => updateCustomSize("rightHead", s)}
                  />
                  {(slide.rightColumn?.bullets || []).map((b, i) => (
                    <div key={i} className="flex gap-4 group relative">
                      <button onClick={() => updateColField("rightColumn", "bullets", null, i)} className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 text-red-500 hover:scale-110 transition-all font-bold">✕</button>
                      <span className="text-2xl font-black mt-[-4px]" style={{ color: tmpl.accent.startsWith("#") ? tmpl.accent : `#${tmpl.accent}` }}>•</span>
                      <EditableText 
                        className="font-medium leading-relaxed w-full" style={{ color: tmpl.body.startsWith("#") ? tmpl.body : `#${tmpl.body}` }} 
                        value={b} onChange={(v) => updateColField("rightColumn", "bullets", v, i)}
                        pos={slide.layout?.text?.rightBullets?.[i]} onPosChange={(p) => updateArrayPos("rightBullets", i, p)}
                        baseSize={24} fontSize={slide.customStyles?.rightBullets?.[i]?.fontSize} onSizeChange={(s) => updateArraySize("rightBullets", i, s)}
                      />
                    </div>
                  ))}
                  <button onClick={() => updateColField("rightColumn", "bullets", [...(slide.rightColumn?.bullets || []), "New point"], null)} className="text-xs text-slate-500">+ Add Point</button>
                </div>
              </div>
            </div>
          ) : slide.type === "timeline" ? (
            <div className="flex flex-col h-full p-4 sm:p-8 overflow-hidden">
              <EditableText 
                value={slide.title} onChange={(v) => updateField("title", v)}
                pos={slide.layout?.text?.title} onPosChange={(p) => updatePos("title", p)}
                baseSize={48} fontSize={slide.customStyles?.title?.fontSize} onSizeChange={(s) => updateCustomSize("title", s)}
                component="h2" className="font-black mb-8 border-b-2 pb-4 w-full" style={{ color: fmtCol(tmpl.highlight), borderColor: fmtCol(tmpl.accent) + "33" }} 
              />
              <button onClick={() => addItem("timelineItems", { year: "2025", event: "New event" })} className="text-xs text-slate-500 mb-4">+ Add Event</button>
              <div className="flex flex-col gap-6 flex-grow justify-center relative pl-8">
                <div className="absolute left-10 top-4 bottom-4 w-1 hidden sm:block opacity-30" style={{ background: fmtCol(tmpl.accent) }} />
                {(slide.timelineItems || []).map((t, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10 w-full pr-8 group">
                    <button onClick={() => removeItem("timelineItems", i)} className="absolute -left-6 opacity-0 group-hover:opacity-100 text-red-500">✕</button>
                    <div className="hidden sm:block w-5 h-5 rounded-full flex-shrink-0" style={{ background: fmtCol(tmpl.accent) }} />
                    <EditableText 
                       className="font-black uppercase tracking-widest w-full sm:w-[120px] flex-shrink-0" style={{ color: fmtCol(tmpl.accent) }}
                       value={t.year} onChange={(v) => updateObjArrayField("timelineItems", i, "year", v)}
                       pos={slide.layout?.text?.tl_year?.[i]} onPosChange={(p) => updateArrayPos("tl_year", i, p)}
                       baseSize={28} fontSize={slide.customStyles?.tl_year?.[i]?.fontSize} onSizeChange={(s) => updateArraySize("tl_year", i, s)}
                    />
                    <EditableText 
                       className="font-medium w-full" style={{ color: fmtCol(tmpl.body) }}
                       value={t.event} onChange={(v) => updateObjArrayField("timelineItems", i, "event", v)}
                       pos={slide.layout?.text?.tl_evt?.[i]} onPosChange={(p) => updateArrayPos("tl_evt", i, p)}
                       baseSize={24} fontSize={slide.customStyles?.tl_evt?.[i]?.fontSize} onSizeChange={(s) => updateArraySize("tl_evt", i, s)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full p-4 sm:p-8 overflow-hidden">
              <EditableText 
                value={slide.title} onChange={(v) => updateField("title", v)}
                pos={slide.layout?.text?.title} onPosChange={(p) => updatePos("title", p)}
                baseSize={48} fontSize={slide.customStyles?.title?.fontSize} onSizeChange={(s) => updateCustomSize("title", s)}
                component="h2" className="font-black mb-8 border-b-2 pb-4 w-full flex justify-between items-center" style={{ color: tmpl.highlight.startsWith("#") ? tmpl.highlight : `#${tmpl.highlight}`, borderColor: (tmpl.accent.startsWith("#") ? tmpl.accent : `#${tmpl.accent}`) + "33" }} 
              >
                <div className="flex gap-2">
                  <button onClick={() => addItem("bullets", "New point")} className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">+</button>
                  <button onClick={handleUploadImage} className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">
                    🖼️ Upload Image
                  </button>
                  <button onClick={handleImageUrl} className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">
                    🌐 Image URL
                  </button>
                  {slide.image && (
                    <button onClick={handleRemoveImage} className="text-[10px] bg-slate-800 text-red-400 px-3 py-1 rounded-full border border-slate-700 hover:text-white transition-all">
                      🗑️ Remove Image
                    </button>
                  )}
                </div>
              </EditableText>
              <div className="flex gap-8 flex-1 w-full">
                <div className="flex-1 flex flex-col gap-4 justify-center overflow-y-auto pr-2 custom-scrollbar">
                  {(slide.bullets && slide.bullets.length > 0) ? (
                    slide.bullets.map((b, i) => (
                      <div key={i} className="flex gap-4 items-start group relative">
                        <button 
                          onClick={() => removeItem("bullets", i)}
                          className="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 text-red-500 hover:scale-110 transition-all text-xs"
                        >
                          ✕
                        </button>
                        <span className="text-2xl font-black mt-1 leading-none transition-transform group-hover:scale-125" style={{ color: fmtCol(tmpl.accent) }}>•</span>
                        <EditableText 
                          value={b} onChange={(v) => updateArrayField("bullets", i, v)}
                          pos={slide.layout?.text?.bullets?.[i]} onPosChange={(p) => updateArrayPos("bullets", i, p)}
                          baseSize={24} fontSize={slide.customStyles?.bullets?.[i]?.fontSize} onSizeChange={(s) => updateArraySize("bullets", i, s)}
                          className="font-medium leading-relaxed w-full" style={{ color: fmtCol(tmpl.body) }}
                        />
                      </div>
                    ))
                  ) : slide.subtitle ? (
                    <div className="flex flex-col gap-4">
                      <EditableText 
                        value={slide.subtitle} onChange={(v) => updateField("subtitle", v)}
                        pos={slide.layout?.text?.subtitle} onPosChange={(p) => updatePos("subtitle", p)}
                        baseSize={28} fontSize={slide.customStyles?.subtitle?.fontSize} onSizeChange={(s) => updateCustomSize("subtitle", s)}
                        className="font-bold opacity-80 w-full" style={{ color: fmtCol(tmpl.sub) }} 
                      />
                      <button onClick={() => updateField("bullets", [slide.subtitle])} className="text-[10px] text-indigo-400">Convert Subtitle to Bullet</button>
                    </div>
                  ) : (
                    slide.title ? null : <div className="opacity-40 italic text-2xl font-medium" style={{ color: fmtCol(tmpl.body) }}>Adding detailed content...</div>
                  )}
                </div>
                {slide.image && (
                  <motion.div 
                    drag 
                    dragMomentum={false} 
                    onDragEnd={(e, info) => {
                      const layout = slide.layout || {};
                      onUpdateSlide(currentIndex, {
                        ...slide,
                        layout: {
                          ...layout,
                          image: {
                            ...(layout.image || {}),
                            x: (layout.image?.x || 0) + info.offset.x,
                            y: (layout.image?.y || 0) + info.offset.y
                          }
                        }
                      });
                    }}
                    onMouseUp={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const layout = slide.layout || {};
                      // Only update if dimensions actually changed significantly (resize)
                      if (!layout.image?.width || Math.abs(rect.width - layout.image.width) > 2 || Math.abs(rect.height - layout.image.height) > 2) {
                        onUpdateSlide(currentIndex, {
                          ...slide,
                          layout: {
                            ...layout,
                            image: {
                              ...(layout.image || {}),
                              width: rect.width,
                              height: rect.height
                            }
                          }
                        });
                      }
                    }}
                    style={{ 
                      x: slide.layout?.image?.x || 0,
                      y: slide.layout?.image?.y || 0,
                      width: slide.layout?.image?.width || '45%',
                      height: slide.layout?.image?.height || 'auto',
                      resize: 'both', 
                      overflow: 'hidden', 
                      minWidth: '160px', 
                      minHeight: '120px' 
                    }} 
                    className="cursor-grab active:cursor-grabbing flex flex-col items-center justify-center p-3 rounded-[2rem] border-2 bg-slate-900/60 border-white/10 backdrop-blur-md self-stretch relative group hover:z-50 shadow-2xl hover:border-indigo-500/30 transition-colors"
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                       <div className="w-16 h-16 border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                    <img 
                      src={slide.image} 
                      alt={slide.title} 
                      className="relative z-10 w-full h-full object-contain rounded-[1.5rem] shadow-xl pointer-events-none select-none" 
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.onerror = null;
                        const topic = encodeURIComponent(slide.imageKeyword || slide.title || "technology");
                        e.target.src = `https://loremflickr.com/800/600/${topic}`;
                      }}
                    />
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 cursor-nwse-resize flex items-center justify-center z-50 shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all scale-75 group-hover:scale-100">
                      <span className="text-white text-base">↘</span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

              {/* Extra Custom Text Rendering Section (Full Control) */}
              <div className="absolute bottom-16 left-8 right-8 flex flex-col gap-2 z-20 pointer-events-auto">
                {(slide.extraText || []).map((txt, i) => (
                  <motion.div 
                    key={i} 
                    drag
                    dragMomentum={false}
                    onDragEnd={(e, info) => {
                      const layout = slide.layout || {};
                      const extraTextLayout = [...(layout.extraText || [])];
                      const current = extraTextLayout[i] || { x: 0, y: 0 };
                      extraTextLayout[i] = { x: current.x + info.offset.x, y: current.y + info.offset.y };
                      onUpdateSlide(currentIndex, {
                        ...slide,
                        layout: { ...layout, extraText: extraTextLayout }
                      });
                    }}
                    style={{
                      x: slide.layout?.extraText?.[i]?.x || 0,
                      y: slide.layout?.extraText?.[i]?.y || 0,
                    }}
                    className="group/extra relative bg-slate-900/40 p-2 rounded-lg border border-white/5 backdrop-blur-sm cursor-grab active:cursor-grabbing"
                  >
                    <button 
                      onClick={() => removeExtraText(i)}
                      className="absolute -right-2 -top-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover/extra:opacity-100 transition-all shadow-lg"
                    >
                      ✕
                    </button>
                    <EditableText 
                      value={txt} 
                      onChange={(v) => updateExtraText(i, v)}
                      baseSize={20}
                      className="font-medium"
                      style={{ color: fmtCol(tmpl.body) }}
                    />
                  </motion.div>
                ))}
              </div>

            <div className="absolute bottom-6 right-8 text-sm font-black opacity-30" style={{ color: fmtCol(tmpl.body) }}>{currentIndex + 1}</div>

          </motion.div>
        </AnimatePresence>
      </div>
     </div>
    </div>,
    document.body
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Aippt() {
  // Step states: "input" → "generating" → "preview"
  // Persistence: Initial load from localStorage
  const getSavedState = () => {
    try {
      const saved = localStorage.getItem("ai_ppt_state");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  };
  const savedState = getSavedState();

  // Step states: "input" → "generating" → "preview"
  const [step, setStep] = useState(savedState.slides?.length ? "preview" : "input"); // input, selection, generating, preview
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [prompt, setPrompt] = useState(savedState.prompt || "");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [referenceFile, setReferenceFile] = useState(null);
  const [styleGuide, setStyleGuide] = useState(null);
  const [template, setTemplate] = useState(savedState.template || "modern");
  const [fontStyle, setFontStyle] = useState(savedState.fontStyle || "modern");
  const [slideCount, setSlideCount] = useState(savedState.slideCount || 8);
  const [customColors, setCustomColors] = useState(savedState.customColors || null); // { bg, accent, title, body, sub, highlight }
  const [isPredictingTheme, setIsPredictingTheme] = useState(false);
  const [suggestedThemeName, setSuggestedThemeName] = useState(null);
  const [suggestedThemeKey, setSuggestedThemeKey] = useState(null);

  // Result state
  const [slides, setSlides] = useState(savedState.slides || []);
  const [activeSlide, setActiveSlide] = useState(savedState.activeSlide || 0);
  const [showFullPreview, setShowFullPreview] = useState(savedState.showFullPreview || false);
  const [lastSavedId, setLastSavedId] = useState(savedState.lastSavedId || null);

  // Progress state
  const [genStatus, setGenStatus] = useState({ current: 0, total: 0, msg: "" });

  // Action states
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [error, setError] = useState("");
  const [showRefineModal, setShowRefineModal] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");

  const fileInputRef = useRef(null);
  const pptBlobRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Persistence: Load
  useEffect(() => {
    if (location.state?.initialPrompt) {
      setPrompt(location.state.initialPrompt);
      setStep("input");
      setSlides([]);
      setLastSavedId(null);
      localStorage.removeItem("ai_ppt_state");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Persistence: Save
  useEffect(() => {
    if (step === "generating") return; // Don't save while generating
    const saveState = () => {
      const state = { prompt, slides, template, fontStyle, slideCount, activeSlide, showFullPreview, lastSavedId, customColors };
      localStorage.setItem("ai_ppt_state", JSON.stringify(state));
    };

    saveState();

    // Force save on page unload
    window.addEventListener("beforeunload", saveState);
    return () => window.removeEventListener("beforeunload", saveState);
  }, [prompt, slides, template, fontStyle, slideCount, step, activeSlide, showFullPreview, lastSavedId, customColors]);

  // Handle Fullscreen during generation
  useEffect(() => {
    if (step === "preview" && !showFullPreview) {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (err) {}
    }
  }, [step, showFullPreview]);

  // ── Image upload ────────────────────────────────────────────────────────────
  const handleImageDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  }, []);

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePredictTheme = async () => {
    if (!prompt.trim()) { setError("Please enter a topic or description."); return; }
    setError("");
    setIsPredictingTheme(true);
    try {
      const themeName = await predictTheme(prompt); // e.g. "Eco Nature"
      
      // Find matching key in TEMPLATES
      let matchedKey = null;
      for (const [key, tmpl] of Object.entries(TEMPLATES)) {
        if (tmpl.name.toLowerCase() === themeName.toLowerCase()) {
          matchedKey = key;
          break;
        }
      }
      
      if (matchedKey) {
        setSuggestedThemeName(themeName);
        setSuggestedThemeKey(matchedKey);
        setStep("theme_suggestion");
      } else {
        // Fallback if not found
        setStep("selection");
      }
    } catch (err) {
      console.warn("Theme prediction failed:", err);
      // Fallback to manual selection
      setStep("selection");
    } finally {
      setIsPredictingTheme(false);
    }
  };

  // ── Generate PPT Sequential ───────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) { setError("Please enter a topic or description."); return; }
    setError("");
    setStep("generating");
    setSlides([]);
    pptBlobRef.current = null;
    setShareUrl(null);

    try {
      // 1. Analyze reference if provided
      let currentStyleGuide = styleGuide;
      if (referenceFile && !currentStyleGuide) {
        setGenStatus({ current: 0, total: 1, msg: "Analyzing reference style..." });
        const analysis = await analyzeReferencePpt(referenceFile);
        currentStyleGuide = analysis.style;
        setStyleGuide(currentStyleGuide);
        
        // If it was an import, maybe we want to use the slides? 
        // For now, only style extraction is used for 'Generate'.
      }

      // Predict Structure
      setGenStatus({ current: 0, total: slideCount, msg: "Predicting optimal structure..." });
      let predictedStructure = null;
      try {
        predictedStructure = await predictStructure(prompt);
      } catch (err) {
        console.warn("Structure prediction failed:", err);
      }

      // 2. Generate Outline
      setGenStatus({ current: 0, total: slideCount, msg: "Architecting presentation outline..." });
      const outline = await generatePptOutline(prompt, slideCount, currentStyleGuide, predictedStructure);
      
      if (!outline?.length) throw new Error("AI failed to create an outline. Please try again.");

      // 3. Generate Slides one-by-one
      const generatedSlides = [];
      const totalSteps = outline.length;

      let contextImageUrl = null;
      if (image) {
         setGenStatus({ current: 0, total: slideCount, msg: "Uploading context image..." });
         try {
            const { uploadImageFile } = await import("../utils/api");
            contextImageUrl = await uploadImageFile(image);
         } catch (e) {
            console.warn("Failed to upload context image", e);
         }
      }

      for (let i = 0; i < totalSteps; i++) {
        setGenStatus({ current: i + 1, total: totalSteps, msg: `Crafting slide ${i+1}: ${outline[i].title}...` });
        
        const slide = await generatePptSlide(prompt, outline, i, currentStyleGuide);
        
        if (i === 0 && contextImageUrl) {
            slide.image = contextImageUrl;
        }

        generatedSlides.push(slide);
        setSlides([...generatedSlides]); // Update UI live

        // 4.5-second delay to absolutely prevent hitting 15 Requests-Per-Minute Gemini Free Quota limits
        if (i < totalSteps - 1) {
          await new Promise(r => setTimeout(r, 4500));
        }
      }

      setSlides(generatedSlides);
      setActiveSlide(0);
      setStep("preview");
      setShowFullPreview(true);
      
      savePptHistory({
        prompt,
        slideCount,
        template,
        fontStyle,
        slides: generatedSlides
      }).then(res => setLastSavedId(res._id)).catch(err => console.error("History save failed:", err));
      
      // Auto-generate and upload PPT for testing in backend uploads folder
      try {
        const tempBlob = await generatePptx(generatedSlides, customColors || template, fontStyle);
        uploadPptFile(tempBlob, "testing_auto_gen.pptx").catch(e => console.warn("Auto upload failed", e));
      } catch (err) {
        console.warn("Failed to generate test PPT automatically", err);
      }
      
    } catch (err) {
      setError(err.message);
      setStep("input");
    }
  };

  const handleInsertSlide = async (index) => {
    setActiveSlide(index);
    setStep("generating");
    setGenStatus({ current: 1, total: 1, msg: `Inserting contextual slide at position ${index + 1}...` });
    try {
      const newSlide = await generateInsertedSlideData(prompt, slides, index, styleGuide);
      const newSlides = [...slides];
      newSlides.splice(index, 0, newSlide);
      setSlides(newSlides);
      pptBlobRef.current = null;
      setStep("preview");
    } catch (err) {
      setError(err.message);
      setStep("preview");
    }
  };

  const handleDeleteSlide = (index) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    if (activeSlide >= newSlides.length) setActiveSlide(newSlides.length - 1);
    pptBlobRef.current = null;
  };

  const handleRefineEntirePpt = async () => {
    if (!refinePrompt.trim()) return;
    setShowRefineModal(false);
    setStep("generating");
    setGenStatus({ current: 0, total: 1, msg: "Refining entire presentation with AI..." });
    setError("");
    try {
      const { editPptData } = await import("../utils/api");
      const updatedSlides = await editPptData(refinePrompt, slides);
      if (updatedSlides && updatedSlides.length > 0) {
        setSlides(updatedSlides);
        pptBlobRef.current = null;
        setStep("preview");
        setShowFullPreview(true);
        setRefinePrompt("");
      } else {
        throw new Error("AI returned empty slides.");
      }
    } catch (err) {
      setError(err.message);
      setStep("preview");
    }
  };

  const handleMoveSlide = (from, to) => {
    if (to < 0 || to >= slides.length) return;
    const newSlides = [...slides];
    const [moved] = newSlides.splice(from, 1);
    newSlides.splice(to, 0, moved);
    setSlides(newSlides);
    setActiveSlide(to);
    pptBlobRef.current = null;
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStep("generating");
    setGenStatus({ current: 0, total: 1, msg: "Importing your presentation..." });
    try {
      const data = await analyzeReferencePpt(file);
      if (data.slides && data.slides.length > 0) {
        setSlides(data.slides);
        
        const fileName = file.name.replace(".pptx", "");
        setPrompt(fileName);

        setActiveSlide(0);
        setStep("preview");
        setShowFullPreview(true);
        setError("");

        // Save imported PPT to history so it can be shared
        savePptHistory({
          prompt: fileName,
          slideCount: data.slides.length,
          template,
          fontStyle,
          slides: data.slides
        }).then(res => setLastSavedId(res._id)).catch(err => console.error("History save failed:", err));
      } else {
        throw new Error("No slides found in this PPTX.");
      }
    } catch (err) {
      setError(err.message);
      setStep("input");
    }
  };

  // ── Download PPT ────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    let defaultPrefix = (prompt || "Presentation").slice(0, 15).replace(/[^a-z0-9]/gi, "_");
    const requestedName = window.prompt("Enter a filename for your presentation:", defaultPrefix);
    if (requestedName === null) return;
    const finalName = requestedName.trim() || defaultPrefix;

    setDownloading(true);
    setError("");
    try {
      let blob = pptBlobRef.current;
      if (!blob) {
        blob = await generatePptx(slides, customColors || template, fontStyle);
        pptBlobRef.current = blob;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${finalName}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Download failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ── Share PPT online ────────────────────────────────────────────────────────
  const handleShare = async () => {
    setSharing(true);
    setError("");
    try {
      let finalId = lastSavedId;
      
      // If not saved yet, save now
      if (!finalId) {
        const res = await savePptHistory({
          prompt,
          slideCount,
          template,
          fontStyle,
          slides
        });
        finalId = res._id;
        setLastSavedId(finalId);
      }

      if (finalId) {
        setShareUrl(`${window.location.origin}/share-ppt/${finalId}`);
      } else {
        throw new Error("Failed to generate a shareable ID. Please try again.");
      }
    } catch (err) {
      setError("Share failed: " + err.message);
    } finally {
      setSharing(false);
    }
  };

  const handleReset = () => {
    removeImage();
    setPrompt("");
    setSlides([]);
    setActiveSlide(0);
    pptBlobRef.current = null;
    setShareUrl(null);
    setError("");
    setStep("input");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Back navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-all font-bold text-sm">
            ← Back
          </Link>
          <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-xs font-black uppercase tracking-widest leading-none flex items-center gap-2">
            <span className="text-sm">📊</span> AI Presentation Studio
          </div>
        </div>
        <button 
          onClick={() => setShowHistory(true)} 
          className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-xl border border-slate-800 transition-all shadow-xl"
        >
          <HistoryIcon className="w-4 h-4 text-purple-400" />
          History
        </button>
      </div>

      {/* ── STEP 1: Input Form ── */}
      {step === "input" && (
        <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3 mb-8">
                <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">Create Presentation</h2>
                {LEARNING_BADGE}
              </div>
              
              <div className="bg-slate-900/50 border border-indigo-500/20 rounded-xl p-3 mb-6 flex items-center justify-center gap-3">
                <span className="text-lg">🔄</span>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  System evolves with user interaction
                </p>
              </div>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight">
              Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Stunning Presentations</span><br />with AI
            </h1>
            <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">
              Describe your topic, upload a reference image, choose your style — let artificial intelligence do the heavy lifting.
            </p>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 sm:p-10 space-y-10 shadow-2xl">
            {/* Prompt */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500" htmlFor="ppt-prompt">
                📝 Presentation Topic / Description
              </label>
              <textarea
                id="ppt-prompt"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-slate-200 text-lg focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all outline-none min-h-[160px]"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. 'The Future of Renewable Energy — solar, wind, and battery storage trends for 2025'"
                maxLength={6000}
              />
              <div className="flex justify-end uppercase font-black text-[10px] tracking-widest text-slate-600">
                {prompt.length} / 6000
              </div>
            </div>

            {/* Image & Reference Uploads */}
            <div className="grid md:grid-cols-2 gap-10">
              <div className="space-y-3 font-[Space_Grotesk]">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">🖼️ Context Image (Optional)</label>
                {imagePreview ? (
                  <div className="flex items-center gap-6 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                    <img src={imagePreview} alt="Reference" className="w-20 h-20 object-cover rounded-xl border border-slate-800" />
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-slate-400 truncate max-w-[200px]">{image?.name}</span>
                      <button className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors" onClick={removeImage}>✕ Remove</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="group cursor-pointer border-2 border-dashed border-slate-800 hover:border-purple-500/50 bg-slate-950/50 hover:bg-purple-500/5 rounded-2xl p-8 text-center transition-all"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleImageDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-3xl mb-3 opacity-50 group-hover:scale-110 transition-transform group-hover:opacity-100">📤</div>
                    <div className="text-sm font-bold text-slate-400 mb-1 group-hover:text-slate-300 transition-colors">Context image</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">JPG, PNG, WebP</div>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageDrop} />
              </div>

              <div className="space-y-3 font-[Space_Grotesk]">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">📄 Reference PPTX (Optional)</label>
                {referenceFile ? (
                  <div className="flex items-center gap-6 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                    <div className="w-20 h-20 flex items-center justify-center bg-slate-900 rounded-xl border border-slate-800 text-3xl">📊</div>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-slate-400 truncate max-w-[200px]">{referenceFile.name}</span>
                      <button className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors" onClick={() => {setReferenceFile(null); setStyleGuide(null);}}>✕ Remove</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="group cursor-pointer border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 hover:bg-indigo-500/5 rounded-2xl p-8 text-center transition-all"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".pptx";
                      input.onchange = (e) => setReferenceFile(e.target.files[0]);
                      input.click();
                    }}
                  >
                    <div className="text-3xl mb-3 opacity-50 group-hover:scale-110 transition-transform group-hover:opacity-100">📂</div>
                    <div className="text-sm font-bold text-slate-400 mb-1 group-hover:text-slate-300 transition-colors">Style guide (.pptx)</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">Extract theme & fonts</div>
                  </div>
                )}
              </div>
            </div>

            {/* Settings Row */}
            <div className="space-y-8 pt-4 border-t border-slate-800">
              {/* Template Selection */}
              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">🎨 Template Design</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                    <button
                      key={key}
                      className={`relative flex flex-col p-4 rounded-xl border-2 transition-all overflow-hidden ${template === key ? 'ring-4 ring-purple-500/20' : 'hover:scale-[1.02]'}`}
                      style={{
                        borderColor: template === key ? `#${tmpl.accent}` : `#1e293b`,
                        background: `#${tmpl.bg}`
                      }}
                      onClick={() => { setTemplate(key); pptBlobRef.current = null; }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{tmpl.emoji}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">{tmpl.name}</span>
                      </div>
                      <div className="w-full h-1" style={{ background: `#${tmpl.accent}` }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Style + Slide Count */}
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500" htmlFor="font-style">✍️ Typography Style</label>
                  <select
                    id="font-style"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm font-bold focus:ring-2 focus:ring-purple-500/50 transition-all outline-none appearance-none"
                    value={fontStyle}
                    onChange={(e) => { setFontStyle(e.target.value); pptBlobRef.current = null; }}
                  >
                    {Object.entries(FONT_STYLES).map(([key]) => (
                      <option key={key} value={key}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">📑 Slide Count</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {SLIDE_COUNTS.map(count => (
                      <button
                        key={count}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          slideCount === count 
                            ? "bg-purple-600 border-purple-500 text-white" 
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                        onClick={() => setSlideCount(count)}
                      >
                        {count === 0 ? "Auto" : count}
                      </button>
                    ))}
                    <div className="flex items-center gap-2 ml-2">
                       <span className="text-xs font-bold text-slate-500">Custom:</span>
                       <input 
                         type="number" 
                         min="1" max="50"
                         className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500/50 outline-none text-center"
                         value={SLIDE_COUNTS.includes(slideCount) ? "" : slideCount}
                         onChange={(e) => setSlideCount(parseInt(e.target.value) || 0)}
                         placeholder="#"
                       />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">✨ Custom Brand Identity</label>
                  <button 
                    onClick={() => setCustomColors(customColors ? null : { bg: "0f172a", accent: "38bdf8", title: "f8fafc", body: "94a3b8", sub: "64748b", highlight: "0ea5e9" })}
                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${customColors ? "bg-purple-600 border-purple-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400"}`}
                  >
                    {customColors ? "Custom ON" : "Use Template"}
                  </button>
                </div>
                
                {customColors && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 duration-300">
                    {Object.keys(customColors).map(key => (
                      <div key={key} className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{key}</label>
                        <div className="flex gap-2 items-center bg-slate-950 border border-slate-800 rounded-lg p-2">
                          <input 
                            type="color" 
                            value={customColors[key].startsWith("#") ? customColors[key] : `#${customColors[key]}`} 
                            onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                          />
                          <input 
                            type="text" 
                            value={customColors[key]} 
                            onChange={(e) => setCustomColors({ ...customColors, [key]: e.target.value })}
                            className="bg-transparent text-xs font-mono text-slate-300 w-full focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-bold rounded-xl flex items-center gap-2">⚠️ {error}</div>}

            <div className="grid sm:grid-cols-2 gap-4">
              <button
                className="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                onClick={handlePredictTheme}
                disabled={!prompt.trim() || isPredictingTheme}
              >
                {isPredictingTheme ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Prompt...</span>
                  </>
                ) : "✨ Generate AI Theme Recommendation"}
              </button>
              <button
                className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-lg rounded-2xl border border-slate-700 transition-all active:scale-[0.99]"
                onClick={() => {
                   const input = document.createElement("input");
                   input.type = "file";
                   input.accept = ".pptx";
                   input.onchange = handleImport;
                   input.click();
                }}
              >
                📥 Import Existing .pptx
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: Theme Suggestion ── */}
      {step === "theme_suggestion" && createPortal(
        <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col items-center justify-center font-[Outfit] animate-in fade-in zoom-in-95 duration-500 p-4">
          <div className="bg-slate-900 border border-purple-500/30 rounded-[2rem] p-8 max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent pointer-events-none" />
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2">Theme Suggested!</h2>
            <p className="text-slate-400 mb-8">
              Based on your prompt, our AI recommends the <strong className="text-purple-400">{suggestedThemeName}</strong> theme for this presentation.
            </p>
            <div className="flex flex-col gap-4 relative z-10">
              <button
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-lg rounded-2xl shadow-xl hover:scale-[1.02] transition-all"
                onClick={() => {
                  setTemplate(suggestedThemeKey);
                  handleGenerate();
                }}
              >
                Accept & Generate
              </button>
              <button
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black text-lg rounded-2xl border border-slate-700 transition-all hover:scale-[1.02]"
                onClick={() => setStep("selection")}
              >
                Choose My Own
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
 
      {/* ── STEP: Design Selection (Full Screen) ── */}
      {step === "selection" && createPortal(
        <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col font-[Outfit] animate-in fade-in zoom-in-95 duration-500 h-screen w-screen overflow-hidden">
           <div className="flex-none flex items-center justify-between p-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
              <div>
                <h2 className="text-3xl font-black text-white">Choose Your <span className="text-purple-400">Atmosphere</span></h2>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Select a premium template for your {slideCount} slides</p>
              </div>
              <button onClick={() => setStep("input")} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-800 text-white text-xl hover:bg-red-500 transition-all">✕</button>
           </div>
           
           <div className="flex-1 overflow-y-auto min-h-0 p-10 custom-scrollbar" data-lenis-prevent="true">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-20">
                {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                  <button
                    key={key}
                    onClick={() => { setTemplate(key); handleGenerate(); }}
                    className="group relative flex flex-col rounded-[2rem] overflow-hidden border-2 border-slate-800 transition-all hover:scale-[1.03] hover:shadow-[0_0_50px_rgba(168,85,247,0.2)] bg-slate-900"
                    style={{ borderColor: template === key ? `#${tmpl.accent}` : undefined }}
                  >
                    <div className="aspect-[16/10] w-full p-4 relative" style={{ background: `#${tmpl.bg}` }}>
                        <div className="absolute top-0 left-0 w-full h-2" style={{ background: `#${tmpl.accent}` }} />
                        <div className="flex flex-col gap-2 mt-4">
                           <div className="w-2/3 h-4 rounded-full" style={{ background: `#${tmpl.title}44` }} />
                           <div className="w-1/2 h-2 rounded-full" style={{ background: `#${tmpl.body}44` }} />
                           <div className="w-1/3 h-2 rounded-full" style={{ background: `#${tmpl.body}44` }} />
                        </div>
                        <div className="absolute bottom-4 right-4 text-4xl opacity-20">{tmpl.emoji}</div>
                    </div>
                    <div className="p-6 flex items-center justify-between">
                       <div className="text-left">
                          <div className="text-lg font-black text-white">{tmpl.name}</div>
                          <div className="flex gap-1 mt-2">
                             {[tmpl.accent, tmpl.title, tmpl.bg].map((c, idx) => (
                               <div key={idx} className="w-4 h-4 rounded-full border border-white/10" style={{ background: `#${c}` }} />
                             ))}
                          </div>
                       </div>
                       <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Rocket className="w-5 h-5 text-white" />
                       </div>
                    </div>
                  </button>
                ))}
              </div>
           </div>
        </div>,
        document.body
      )}
 
      {/* ── STEP 2: Generating Loader (Sequential) ── */}
      {step === "generating" && createPortal(
        <div className="fixed inset-0 z-[120] bg-slate-950 flex flex-col font-[Outfit] animate-in fade-in duration-500 h-screen w-screen overflow-hidden">
           {/* Top Navigation & Status Bar */}
           <div className="flex-none flex flex-col sm:flex-row items-center justify-between p-6 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-xl gap-4">
              <div className="flex items-center gap-4">
                 <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-xs font-black uppercase tracking-widest leading-none flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                    </span>
                    <span>AI Presentation Studio</span>
                 </div>
                 <div className="text-slate-400 text-xs font-bold truncate max-w-[200px] sm:max-w-xs">
                    Topic: <span className="text-slate-200">"{prompt}"</span>
                 </div>
              </div>
 
              {/* Progress Tracker Bar */}
              <div className="flex items-center gap-6 w-full sm:w-auto">
                 <div className="flex-1 sm:w-64 bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800 relative shadow-inner">
                    <motion.div 
                       className="bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 h-full rounded-full"
                       initial={{ width: 0 }}
                       animate={{ width: `${(genStatus.current / (genStatus.total || 1)) * 100}%` }}
                       transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                 </div>
                 <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-sm font-black text-white">
                       {Math.round((genStatus.current / (genStatus.total || 1)) * 100) || 0}%
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                       ({genStatus.current} / {genStatus.total} slides)
                    </span>
                 </div>
              </div>
           </div>
 
           {/* Live Generation Stage */}
           <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center p-6 bg-slate-950/40">
              {/* Dynamic scanline visual effect */}
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:100%_8px] pointer-events-none" />
              
              <div className="max-w-4xl w-full flex flex-col items-center justify-center gap-4 relative z-10">
                 {/* Live Status Subtitle */}
                 <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 px-5 py-2.5 rounded-2xl shadow-xl backdrop-blur-md mb-2">
                    <div className="w-4 h-4 rounded-full border-2 border-slate-700 border-t-purple-500 animate-spin" />
                    <AnimatePresence mode="wait">
                       <motion.span 
                          key={genStatus.msg} 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -10 }} 
                          className="text-slate-300 text-sm font-bold tracking-wide"
                       >
                          {genStatus.msg || "Initializing Layout..."}
                       </motion.span>
                    </AnimatePresence>
                 </div>
 
                 {/* Center Active Slide Canvas */}
                 <div className="relative w-full aspect-[16/9] max-w-3xl rounded-xl sm:rounded-[2rem] overflow-hidden border border-purple-500/20 shadow-[0_0_80px_rgba(168,85,247,0.1)] bg-slate-900 flex items-center justify-center">
                    {/* Scanning animation line overlay */}
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-purple-500/80 to-transparent shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-scanline z-50 pointer-events-none" style={{
                       animation: 'scan 4s linear infinite'
                    }} />
 
                    <style>{`
                       @keyframes scan {
                          0% { top: 0%; opacity: 0; }
                          5% { opacity: 1; }
                          95% { opacity: 1; }
                          100% { top: 100%; opacity: 0; }
                       }
                    `}</style>
 
                    <AnimatePresence mode="wait">
                       {slides.length > 0 ? (
                          <motion.div 
                             key={slides.length}
                             initial={{ opacity: 0, scale: 0.95 }}
                             animate={{ opacity: 1, scale: 1 }}
                             exit={{ opacity: 0, scale: 1.02 }}
                             transition={{ duration: 0.4 }}
                             className="w-full h-full"
                          >
                             <SlidePreview 
                                slide={slides[slides.length - 1]}
                                template={template}
                                customColors={customColors}
                                index={slides.length - 1}
                                isActive={true}
                             />
                          </motion.div>
                       ) : (
                          /* Initial Skeleton Template Loading Card */
                          <div className="w-full h-full flex flex-col items-center justify-center p-12 space-y-6 bg-slate-950/20">
                             <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-[1.5rem] flex items-center justify-center animate-pulse">
                                <Sparkles className="w-8 h-8 text-purple-400" />
                             </div>
                             <div className="space-y-3 w-2/3 flex flex-col items-center">
                                <div className="h-6 w-full bg-slate-800/80 rounded-full animate-pulse" />
                                <div className="h-4 w-5/6 bg-slate-800/50 rounded-full animate-pulse" />
                                <div className="h-4 w-4/6 bg-slate-800/30 rounded-full animate-pulse" />
                             </div>
                          </div>
                       )}
                    </AnimatePresence>
                 </div>
              </div>
           </div>
 
           {/* Bottom Real-Time Horizontal Thumbnail Rail */}
           <div className="flex-none bg-slate-900/60 border-t border-slate-800/80 p-6 backdrop-blur-xl">
              <div className="max-w-6xl mx-auto flex flex-col gap-3">
                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Presentation Deck Outline ({slides.length} of {genStatus.total || slideCount} active)
                 </div>
                 
                 <div className="flex items-center gap-4 overflow-x-auto py-2 px-1 custom-scrollbar scroll-smooth">
                    {Array.from({ length: genStatus.total || slideCount }).map((_, idx) => {
                       const isGenerated = idx < slides.length;
                       const isGenerating = idx === slides.length;
                       const isPending = idx > slides.length;
 
                       return (
                          <div 
                             key={idx} 
                             className={`relative w-40 aspect-[16/9] flex-shrink-0 rounded-xl overflow-hidden border transition-all duration-300 ${
                                isGenerated 
                                   ? "border-slate-800 hover:border-purple-500/40 bg-slate-950/40" 
                                   : isGenerating 
                                      ? "border-purple-500/80 ring-2 ring-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)] bg-slate-950/80" 
                                      : "border-slate-800/40 border-dashed bg-slate-950/10"
                             }`}
                          >
                             {isGenerated ? (
                                <div className="w-full h-full flex flex-col relative group">
                                   <div className="absolute top-0 left-0 w-full h-1" style={{ background: `#${(customColors || TEMPLATES[template] || TEMPLATES.corporate).accent}` }} />
                                   <div className="flex-1 p-2.5 flex flex-col justify-between">
                                      <div className="text-[8px] font-black text-slate-200 line-clamp-2 leading-tight">
                                         {slides[idx]?.title || `Slide ${idx + 1}`}
                                      </div>
                                      <div className="flex justify-between items-center text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                         <span>Type: {slides[idx]?.type || "content"}</span>
                                         <span>#{idx + 1}</span>
                                      </div>
                                   </div>
                                </div>
                             ) : isGenerating ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-900/50 relative">
                                   <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 animate-pulse" />
                                   <div className="w-5 h-5 border-2 border-slate-700 border-t-purple-500 rounded-full animate-spin mb-1.5" />
                                   <div className="text-[8px] font-black text-purple-400 uppercase tracking-widest">
                                      Crafting Slide
                                   </div>
                                   <div className="text-[7px] font-bold text-slate-500 mt-0.5">
                                      #{idx + 1}
                                   </div>
                                </div>
                             ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-950/20">
                                   <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                                      Pending
                                   </div>
                                   <div className="text-[7px] font-bold text-slate-700 mt-1">
                                      Slide #{idx + 1}
                                   </div>
                                </div>
                             )}
                          </div>
                       );
                    })}
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* ── STEP 3: Preview & Export ── */}
      {step === "preview" && slides.length > 0 && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                <span className="text-4xl">🎉</span> Your Presentation is Ready!
              </h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2 ml-1">
                {slides.length} slides generated · {TEMPLATES[template]?.name} theme · {fontStyle} font
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button 
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 transition-all text-sm active:scale-95" 
                onClick={handleReset} 
                title="Return to input screen"
              >
                🔄 Reset
              </button>
              <button 
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 font-bold rounded-xl border border-amber-500/30 transition-all text-sm active:scale-95" 
                onClick={handleGenerate} 
                title="Generate again with the same prompt"
              >
                ♻️ Regenerate
              </button>
              <button 
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 font-bold rounded-xl border border-purple-500/30 transition-all text-sm active:scale-95" 
                onClick={() => setShowRefineModal(true)} 
              >
                ✨ Edit All Slides
              </button>
              <button 
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl border border-indigo-500 shadow-lg shadow-indigo-500/20 transition-all text-sm active:scale-95" 
                onClick={() => setShowFullPreview(true)} 
              >
                👁️ Full Preview
              </button>
            </div>
          </div>

          {/* Slide Grid with inter-slide buttons */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6 bg-slate-900/50 border border-slate-800 rounded-3xl">
              {slides.map((slide, i) => (
                <motion.div 
                  key={i} 
                  drag
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, info) => {
                    // Logic to swap slides based on drag distance
                    if (info.offset.x > 150) handleMoveSlide(i, i + 1);
                    else if (info.offset.x < -150) handleMoveSlide(i, i - 1);
                    else if (info.offset.y > 150) handleMoveSlide(i, i + 3); // Approx next row
                    else if (info.offset.y < -150) handleMoveSlide(i, i - 3); // Approx prev row
                  }}
                  className="group relative flex flex-col gap-3 z-10 hover:z-20"
                >
                  <SlidePreview
                    slide={{ ...slide, onDelete: () => handleDeleteSlide(i) }}
                    template={template}
                    customColors={customColors}
                    index={i}
                    isActive={activeSlide === i}
                    onClick={() => { setActiveSlide(i); setShowFullPreview(true); }}
                  />
                  
                  {/* Reorder controls directly on grid */}
                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleMoveSlide(i, i - 1)} className="p-1 px-2 bg-slate-800 rounded-md text-[10px] text-slate-400 hover:text-white" disabled={i === 0}>←</button>
                    <button onClick={() => handleMoveSlide(i, i + 1)} className="p-1 px-2 bg-slate-800 rounded-md text-[10px] text-slate-400 hover:text-white" disabled={i === slides.length - 1}>→</button>
                  </div>

                  {/* Add button between items */}
                  {i < slides.length - 1 && (
                    <div className="absolute -right-[1.5rem] top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                        onClick={() => handleInsertSlide(i + 1)}
                        className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:scale-110 shadow-lg border-2 border-slate-900"
                        title="Add slide here"
                       >
                        +
                       </button>
                    </div>
                  )}
                </motion.div>
              ))}
              
              {/* Add button at the very end */}
              <button 
                onClick={() => handleInsertSlide(slides.length)}
                className="w-full aspect-video border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-all font-black text-sm group"
              >
                <span className="group-hover:scale-110 transition-transform">+ Add Final Slide</span>
              </button>
            </div>
          </div>

          {/* Selected slide detail */}
          <div className="flex items-center gap-3 text-sm p-4 bg-slate-950 border border-slate-800 rounded-xl justify-center font-bold">
            <span className="text-slate-500 uppercase tracking-widest text-xs">Currently viewing:</span>
            <span className="text-white bg-slate-800 px-3 py-1 rounded-md">{slides[activeSlide]?.title}</span>
            <span className="text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-md text-xs uppercase tracking-widest border border-indigo-500/20">[{slides[activeSlide]?.type}]</span>
          </div>

          {/* Export Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className="text-2xl font-black text-white mb-2">📥 Export Your Presentation</div>
            <div className="text-sm font-bold text-slate-500 mb-8">💡 Open the downloaded file in PowerPoint, Google Slides, or Keynote.</div>

            {error && <div className="mb-6 p-4 w-full bg-red-500/10 border border-red-500/30 text-red-500 text-sm font-bold rounded-xl flex items-center justify-center gap-2">⚠️ {error}</div>}

            <div className="grid sm:grid-cols-2 gap-4 w-full">
              <button
                className="flex items-center justify-center gap-2 py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 text-white font-black text-lg rounded-2xl shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 border border-purple-500  transition-all active:scale-[0.98] relative overflow-hidden"
                onClick={handleDownload}
                disabled={downloading}
                id="download-ppt-btn"
              >
                {downloading ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating file…</>
                ) : (
                  <>⬇️ Download .pptx</>
                )}
              </button>

              <button
                className="flex items-center justify-center gap-2 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-400 hover:text-indigo-300 disabled:text-slate-500 font-black text-lg rounded-2xl border-2 border-indigo-500/30 hover:border-indigo-500/60 disabled:border-slate-800 transition-all active:scale-[0.98]"
                onClick={handleShare}
                disabled={sharing || !!shareUrl}
                id="share-ppt-btn"
              >
                {sharing ? (
                  <><div className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> Uploading…</>
                ) : shareUrl ? (
                  <>✅ Link Ready!</>
                ) : (
                  <>🔗 Get Shareable Link</>
                )}
              </button>
            </div>

            {shareUrl && (
              <div className="mt-8 w-full p-6 bg-slate-950 border border-slate-800 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">🌐 Your presentation is live at:</div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="flex-1 bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl text-indigo-400 font-mono text-sm hover:text-indigo-300 hover:border-indigo-500/50 transition-colors w-full sm:w-auto truncate block overflow-hidden text-ellipsis whitespace-nowrap text-left">
                    {shareUrl}
                  </a>
                  <button
                    className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95"
                    onClick={() => { navigator.clipboard.writeText(shareUrl); }}
                    title="Copy to clipboard"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {showFullPreview && slides.length > 0 && (
        <FullPreviewModal
          slides={slides}
          currentIndex={activeSlide}
          template={template}
          customColors={customColors}
          fontStyle={fontStyle}
          onUpdateSlide={(idx, updatedSlide) => {
            const newArray = [...slides];
            newArray[idx] = updatedSlide;
            setSlides(newArray);
            setLastSavedId(null); // Mark as dirty/needs re-save for share
            pptBlobRef.current = null; // Re-generate PPT on next download
          }}
          onUpdateAllSlides={(newSlides) => {
            setSlides(newSlides);
            pptBlobRef.current = null;
            // Prevent going out of bounds if slides were deleted
            if (activeSlide >= newSlides.length) {
                setActiveSlide(Math.max(0, newSlides.length - 1));
            }
          }}
          onClose={() => setShowFullPreview(false)}
          onPrev={() => setActiveSlide((p) => Math.max(0, p - 1))}
          onNext={() => setActiveSlide((p) => Math.min(slides.length - 1, p + 1))}
        />
      )}
      
      {showRefineModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-xl font-black text-white mb-4">✨ Edit All Slides</h3>
            <p className="text-sm text-slate-400 mb-4">Enter a prompt to modify the entire presentation.</p>
            <textarea
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none min-h-[120px] mb-4"
              placeholder="e.g. 'Make it more professional', 'Add more details', 'Simplify the language'"
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button 
                className="px-5 py-2 rounded-xl font-bold text-slate-300 hover:bg-slate-800 transition-all"
                onClick={() => setShowRefineModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-5 py-2 rounded-xl font-black text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
                onClick={handleRefineEntirePpt}
                disabled={!refinePrompt.trim()}
              >
                Apply to All Slides
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <HistoryModal 
           onClose={() => setShowHistory(false)}
           onLoadHistoryItem={(item) => {
             setPrompt(item.prompt);
             setTemplate(item.template);
             setFontStyle(item.fontStyle);
             setSlideCount(item.slideCount);
             setSlides(item.slides);
             setActiveSlide(0);
             setStep("preview");
             setShowHistory(false);
           }}
        />
      )}
    </div>
  );
}
