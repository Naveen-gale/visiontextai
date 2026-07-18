import pptxgen from "pptxgenjs";
import { compileSlideToElements } from "./templateCompiler";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export const TEMPLATES = {
  // ── Original 16 ──────────────────────────────────────────────────────────────
  corporate: {
    name: "Corporate Blue", emoji: "🏢",
    bg: "f8fafc", accent: "3b82f6", title: "0f172a", body: "334155", sub: "64748b", highlight: "2563eb",
  },
  modern: {
    name: "Modern Minimal", emoji: "✨",
    bg: "ffffff", accent: "10b981", title: "18181b", body: "3f3f46", sub: "71717a", highlight: "059669",
  },
  dark: {
    name: "Dark Tech", emoji: "🌙",
    bg: "0f172a", accent: "8b5cf6", title: "f8fafc", body: "cbd5e1", sub: "94a3b8", highlight: "a78bfa",
  },
  creative: {
    name: "Creative Studio", emoji: "🎨",
    bg: "fff1f2", accent: "f43f5e", title: "4c0519", body: "881337", sub: "9f1239", highlight: "e11d48",
  },
  elegant: {
    name: "Elegant Serif", emoji: "🖋️",
    bg: "fdfbf7", accent: "b45309", title: "451a03", body: "78350f", sub: "92400e", highlight: "d97706",
  },
  nature: {
    name: "Organic Green", emoji: "🌿",
    bg: "f0fdf4", accent: "22c55e", title: "064e3b", body: "0f766e", sub: "115e59", highlight: "16a34a",
  },
  cyber: {
    name: "Cyberpunk", emoji: "🤖",
    bg: "000000", accent: "06b6d4", title: "f0fdfa", body: "a5f3fc", sub: "67e8f9", highlight: "22d3ee",
  },
  sunset: {
    name: "Warm Sunset", emoji: "🌅",
    bg: "fff7ed", accent: "ea580c", title: "7c2d12", body: "9a3412", sub: "c2410c", highlight: "f97316",
  },
  ocean: {
    name: "Deep Ocean", emoji: "🌊",
    bg: "ecfeff", accent: "0891b2", title: "164e63", body: "155e75", sub: "0e7490", highlight: "06b6d4",
  },
  startup: {
    name: "Startup Pink", emoji: "🚀",
    bg: "fdf2f8", accent: "ec4899", title: "831843", body: "be185d", sub: "f472b6", highlight: "db2777",
  },
  academic: {
    name: "Scholar Paper", emoji: "📜",
    bg: "f5f5f4", accent: "57534e", title: "1c1917", body: "44403c", sub: "78716c", highlight: "292524",
  },
  future: {
    name: "Abstract Glass", emoji: "💎",
    bg: "172554", accent: "6366f1", title: "ffffff", body: "bfdbfe", sub: "818cf8", highlight: "a5b4fc",
  },
  bold: {
    name: "High Impact", emoji: "💥",
    bg: "000000", accent: "ef4444", title: "ffffff", body: "d1d5db", sub: "f87171", highlight: "fca5a5",
  },
  premium_dark: {
    name: "Luxury Obsidian", emoji: "🖤",
    bg: "0a0a0a", accent: "fbbf24", title: "ffffff", body: "d4d4d8", sub: "9ca3af", highlight: "fcd34d",
  },
  neon_glow: {
    name: "Neon Nights", emoji: "🟣",
    bg: "0f0c29", accent: "00f2fe", title: "ffffff", body: "e0e7ff", sub: "a5b4fc", highlight: "4facfe",
  },
  glassmorphism: {
    name: "Glassmorphism Blur", emoji: "🧊",
    bg: "cbd5e1", accent: "3b82f6", title: "1e293b", body: "334155", sub: "475569", highlight: "2563eb",
  },
  earthy: {
    name: "Earthy Neutrals", emoji: "🍂",
    bg: "fafaf9", accent: "a8a29e", title: "44403c", body: "57534e", sub: "78716c", highlight: "a8a29e",
  },
  // ── New 15 ───────────────────────────────────────────────────────────────
  pure_white: {
    name: "Clean White", emoji: "🤍",
    bg: "ffffff", accent: "1a1a1a", title: "111111", body: "333333", sub: "888888", highlight: "000000",
  },
  pure_black: {
    name: "Pure Black", emoji: "🖤",
    bg: "000000", accent: "eeeeee", title: "ffffff", body: "cccccc", sub: "888888", highlight: "ffffff",
  },
  dark_mode: {
    name: "Dark Mode", emoji: "🌙",
    bg: "1a1a2e", accent: "e94560", title: "eaeaea", body: "a8a8b8", sub: "6c6c7a", highlight: "e94560",
  },
  blue_corporate: {
    name: "Blue Corporate", emoji: "🏢",
    bg: "f0f4ff", accent: "1d4ed8", title: "1e3a5f", body: "374151", sub: "6b7280", highlight: "1d4ed8",
  },
  green_fresh: {
    name: "Green Fresh", emoji: "🌱",
    bg: "f0fdf4", accent: "16a34a", title: "14532d", body: "374151", sub: "6b7280", highlight: "15803d",
  },
  purple_dream: {
    name: "Purple Dream", emoji: "💜",
    bg: "1e1033", accent: "a855f7", title: "f3e8ff", body: "d8b4fe", sub: "9333ea", highlight: "c084fc",
  },
  modern_gradient_theme: {
    name: "Modern Gradient", emoji: "🌊",
    bg: "0f0c29", accent: "fc00ff", title: "ffffff", body: "e0e0ff", sub: "cc00cc", highlight: "00dbde",
  },
  minimal_clean: {
    name: "Minimal Clean", emoji: "✨",
    bg: "fafafa", accent: "374151", title: "111827", body: "4b5563", sub: "9ca3af", highlight: "1f2937",
  },
  creative_burst: {
    name: "Creative Burst", emoji: "🎨",
    bg: "1a0a2e", accent: "ff6b6b", title: "ffffff", body: "ffd93d", sub: "ff9f43", highlight: "ff6b6b",
  },
  business_pro: {
    name: "Business Pro", emoji: "📊",
    bg: "1f2937", accent: "6366f1", title: "f9fafb", body: "d1d5db", sub: "6b7280", highlight: "818cf8",
  },
  tech_dark: {
    name: "Tech Dark", emoji: "💻",
    bg: "0d1117", accent: "00ff41", title: "ffffff", body: "8b949e", sub: "3c4043", highlight: "00ff41",
  },
  education_blue: {
    name: "Education Blue", emoji: "📚",
    bg: "eff6ff", accent: "2563eb", title: "1e3a5f", body: "374151", sub: "6b7280", highlight: "1d4ed8",
  },
  startup_purple: {
    name: "Startup Purple", emoji: "🚀",
    bg: "13111c", accent: "8b5cf6", title: "ffffff", body: "c4b5fd", sub: "7c3aed", highlight: "a78bfa",
  },
  medical_clean: {
    name: "Medical Clean", emoji: "⚕️",
    bg: "f8fafc", accent: "0891b2", title: "0c4a6e", body: "374151", sub: "64748b", highlight: "0e7490",
  },
  finance_gold: {
    name: "Finance Gold", emoji: "💰",
    bg: "0f0e0a", accent: "d4af37", title: "f5f0e0", body: "b8a06a", sub: "7a6a3a", highlight: "f0c040",
  },
};

// ─── Font Styles ──────────────────────────────────────────────────────────────
export const FONT_STYLES = {
  modern:    { heading: "Calibri",          body: "Calibri" },
  classic:   { heading: "Times New Roman",  body: "Georgia" },
  tech:      { heading: "Courier New",      body: "Courier New" },
  elegant:   { heading: "Garamond",         body: "Garamond" },
  bold:      { heading: "Arial Black",      body: "Arial" },
  premium:   { heading: "Montserrat",       body: "Open Sans" },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────
function col(colorString) {
  if (!colorString) return "000000";
  return colorString.replace("#", "").toUpperCase();
}

export function validateSlides(slides) {
  const warnings = [];
  slides.forEach((slide, idx) => {
    if (!slide.title) warnings.push(`Slide ${idx + 1} is missing a title.`);
    if (slide.title && slide.title.length > 90) warnings.push(`Slide ${idx + 1} title is very long.`);
    if (slide.bullets && slide.bullets.length > 8) warnings.push(`Slide ${idx + 1} has too many bullets (${slide.bullets.length}).`);
    if (slide.type === "stats" && (!slide.stats || slide.stats.length === 0)) warnings.push(`Slide ${idx + 1} (Stats) is missing data.`);
    if (slide.type === "timeline" && (!slide.timelineItems || slide.timelineItems.length === 0)) warnings.push(`Slide ${idx + 1} (Timeline) is missing events.`);
    if (slide.image && !slide.image.startsWith("http")) warnings.push(`Slide ${idx + 1} image URL is invalid.`);
  });
  return warnings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export async function generatePptx(slides, templateKey = "corporate", fontStyleKey = "modern") {
  const tmpl  = typeof templateKey === "object"
    ? templateKey
    : (TEMPLATES[templateKey] || TEMPLATES.corporate);
  const fonts = FONT_STYLES[fontStyleKey] || FONT_STYLES.modern;

  const prs = new pptxgen();
  prs.layout  = "LAYOUT_WIDE"; // 13.33" × 7.5"
  prs.author  = "AI Presentation Studio";
  prs.company = "VisionText AI";
  prs.subject = slides[0]?.title || "Presentation";
  prs.title   = slides[0]?.title || "Presentation";

  slides.forEach((slide, idx) => {
    const sl = prs.addSlide();
    const slideNum = idx + 1;

    // Background
    const bgColor = slide.bgColor ? col(slide.bgColor) : col(tmpl.bg);
    sl.background = { color: bgColor };

    // Get absolute elements (compile them if the user didn't edit this slide)
    const elements = slide.elements && slide.elements.length > 0 
        ? slide.elements 
        : compileSlideToElements(slide, tmpl);

    elements.forEach(el => {
      // Convert percentages (0-100) to inches (13.33 x 7.5)
      const x = (el.x / 100) * 13.33;
      const y = (el.y / 100) * 7.5;
      const w = (el.w / 100) * 13.33;
      const h = (el.h / 100) * 7.5;
      const color = col(el.color);
      const opacity = el.opacity !== undefined ? (1 - el.opacity) * 100 : 0; // pptxgenjs uses transparency 0-100%

      if (el.type === "shape") {
        sl.addShape(el.shape === "circle" ? prs.ShapeType.ellipse : prs.ShapeType.rect, {
          x, y, w, h,
          fill: { color, transparency: opacity },
          line: { width: 0 }
        });
      } else if (el.type === "image") {
        sl.addImage({
          path: el.src,
          x, y, w, h,
          sizing: { type: "crop" } // Simulates objectFit: "cover"
        });
      } else {
        // Text
        sl.addText(el.text, {
          x, y, w, h,
          fontSize: el.fontSize * 0.75, // Scale down slightly to match HTML rendering sizes
          color,
          bold: !!el.bold,
          italic: !!el.italic,
          fontFace: el.bold ? fonts.heading : fonts.body,
          align: el.align || "left",
          valign: "top",
          transparency: opacity,
          margin: 4 // Give a tiny margin so it doesn't touch the edge of the invisible bounding box
        });
      }
    });

    if (slide.speaker_notes || slide.speakerNotes) {
      sl.addNotes(slide.speaker_notes || slide.speakerNotes);
    }
    
    // Slide Number (if not first slide)
    if (slideNum > 1) {
      sl.addText(String(slideNum), {
        x: 12.8, y: 7.1, w: 0.5, h: 0.3,
        fontSize: 10, color: col(tmpl.sub), align: "right", transparency: 50
      });
    }
  });

  return await prs.write("blob");
}
