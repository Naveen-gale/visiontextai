export function compileSlideToElements(slide, tmpl) {
  if (slide.elements && slide.elements.length > 0) return slide.elements;

  const titleClr = tmpl.title;
  const bodyClr  = tmpl.body;
  const hlClr    = tmpl.highlight || tmpl.title;
  const subClr   = tmpl.sub;
  const accent   = tmpl.accent;

  const elements = [];
  const add = (el) => elements.push({ id: Math.random().toString(36).substr(2, 9), ...el });

  // Helpers to safely get text
  const title = slide.title || "";
  const sub = slide.subtitle || "";
  const bullets = slide.bullets || [];

  switch (slide.type) {
    case "title":
      add({ type:"shape", shape:"circle", x: 90, y: -10, w: 30, h: 53.33 /* w*16/9 for circle */, color: accent, opacity: 0.07 });
      add({ type:"shape", shape:"circle", x: -10, y: 90, w: 20, h: 35.55, color: accent, opacity: 0.05 });
      add({ type:"text", text: title, x: 10, y: 35, w: 80, h: 20, fontSize: 58, color: titleClr, align: "center", bold: true });
      add({ type:"shape", shape:"rect", x: 40, y: 56, w: 20, h: 0.5, color: accent });
      if (sub) add({ type:"text", text: sub, x: 10, y: 60, w: 80, h: 15, fontSize: 26, color: subClr, align: "center" });
      break;

    case "section":
      add({ type:"shape", shape:"rect", x: 0, y: 28, w: 100, h: 44, color: accent, opacity: 0.09 });
      if (slide.sectionNumber) add({ type:"text", text: slide.sectionNumber, x: 5, y: 10, w: 30, h: 20, fontSize: 82, color: accent, opacity: 0.13, bold: true, align:"left" });
      add({ type:"text", text: title, x: 10, y: 40, w: 80, h: 20, fontSize: 44, color: titleClr, align: "center", bold: true });
      if (sub) add({ type:"text", text: sub, x: 10, y: 62, w: 80, h: 10, fontSize: 24, color: subClr, align: "center" });
      break;

    case "agenda":
      add({ type:"text", text: title, x: 5, y: 8, w: 90, h: 12, fontSize: 38, color: hlClr, bold: true, align:"left" });
      add({ type:"shape", shape:"rect", x: 5, y: 21, w: 90, h: 0.3, color: accent, opacity: 0.4 });
      (slide.agendaItems || bullets).slice(0, 7).forEach((item, i) => {
        const y = 28 + (i * 10);
        add({ type:"shape", shape:"circle", x: 5, y, w: 2.5, h: 2.5 * (16/9), color: accent });
        add({ type:"text", text: String(i + 1), x: 5, y: y+0.5, w: 2.5, h: 3, fontSize: 16, color: tmpl.bg, align:"center", bold: true });
        add({ type:"text", text: item, x: 9, y: y, w: 85, h: 8, fontSize: 24, color: bodyClr, align:"left", bold: true });
      });
      break;

    case "quote":
    case "callout":
      add({ type:"text", text: "\"", x: 3, y: 5, w: 15, h: 20, fontSize: 120, color: accent, opacity: 0.13, bold:true, align:"left" });
      add({ type:"text", text: slide.quote || title, x: 15, y: 35, w: 70, h: 30, fontSize: 32, color: titleClr, align:"center", italic: true, bold:true });
      if (slide.author) add({ type:"text", text: `— ${slide.author}`, x: 15, y: 70, w: 70, h: 10, fontSize: 16, color: subClr, align:"center", bold:true });
      break;

    case "image-full":
      if (slide.image) add({ type:"image", src: slide.image, x: 0, y: 0, w: 100, h: 100 });
      add({ type:"shape", shape:"rect", x: 0, y: 70, w: 100, h: 30, color: "000000", opacity: 0.8 });
      add({ type:"text", text: title, x: 5, y: 75, w: 90, h: 15, fontSize: 42, color: "FFFFFF", bold: true, align:"left" });
      if (sub) add({ type:"text", text: sub, x: 5, y: 88, w: 90, h: 8, fontSize: 20, color: "DDDDDD", align:"left" });
      break;

    case "thank-you":
      add({ type:"shape", shape:"circle", x: 90, y: -10, w: 30, h: 53.33, color: accent, opacity: 0.07 });
      add({ type:"text", text: title || "Thank You!", x: 10, y: 35, w: 80, h: 20, fontSize: 52, color: titleClr, align: "center", bold: true });
      add({ type:"shape", shape:"rect", x: 45, y: 58, w: 10, h: 0.5, color: accent });
      if (sub) add({ type:"text", text: sub, x: 10, y: 65, w: 80, h: 10, fontSize: 26, color: subClr, align: "center" });
      if (slide.contact) add({ type:"text", text: slide.contact, x: 10, y: 78, w: 80, h: 10, fontSize: 20, color: accent, align: "center", bold:true });
      break;

    case "two-column":
    case "twocolumn":
      add({ type:"text", text: title, x: 5, y: 8, w: 90, h: 12, fontSize: 38, color: hlClr, bold: true, align:"left" });
      add({ type:"shape", shape:"rect", x: 5, y: 21, w: 90, h: 0.3, color: accent, opacity: 0.4 });
      
      const left = slide.leftColumn || {};
      const right = slide.rightColumn || {};
      
      add({ type:"text", text: left.heading || "Left", x: 5, y: 26, w: 42, h: 8, fontSize: 28, color: accent, bold:true, align:"left" });
      (left.bullets || []).slice(0, 5).forEach((b, i) => {
        add({ type:"text", text: "•", x: 5, y: 36 + (i*9), w: 2, h: 8, fontSize: 20, color: accent, bold: true, align:"left" });
        add({ type:"text", text: b, x: 7, y: 36 + (i*9), w: 40, h: 8, fontSize: 20, color: bodyClr, align:"left" });
      });

      add({ type:"shape", shape:"rect", x: 49.5, y: 26, w: 0.2, h: 60, color: accent, opacity:0.2 });

      add({ type:"text", text: right.heading || "Right", x: 52, y: 26, w: 42, h: 8, fontSize: 28, color: accent, bold:true, align:"left" });
      (right.bullets || []).slice(0, 5).forEach((b, i) => {
        add({ type:"text", text: "•", x: 52, y: 36 + (i*9), w: 2, h: 8, fontSize: 20, color: accent, bold: true, align:"left" });
        add({ type:"text", text: b, x: 54, y: 36 + (i*9), w: 40, h: 8, fontSize: 20, color: bodyClr, align:"left" });
      });
      break;

    case "timeline":
      add({ type:"text", text: title, x: 5, y: 8, w: 90, h: 12, fontSize: 38, color: hlClr, bold: true, align:"left" });
      add({ type:"shape", shape:"rect", x: 5, y: 21, w: 90, h: 0.3, color: accent, opacity: 0.4 });
      (slide.timelineItems || []).slice(0, 5).forEach((item, i) => {
        const y = 28 + (i * 12);
        add({ type:"shape", shape:"circle", x: 5, y: y+1, w: 1.5, h: 1.5*(16/9), color: accent });
        add({ type:"text", text: item.year, x: 8, y, w: 15, h: 8, fontSize: 22, color: accent, bold:true, align:"left" });
        add({ type:"text", text: item.event, x: 23, y, w: 70, h: 8, fontSize: 22, color: bodyClr, align:"left" });
      });
      break;

    case "stats":
    case "chart":
      add({ type:"text", text: title, x: 5, y: 8, w: 90, h: 12, fontSize: 38, color: hlClr, bold: true, align:"left" });
      add({ type:"shape", shape:"rect", x: 5, y: 21, w: 90, h: 0.3, color: accent, opacity: 0.4 });
      
      const stats = (slide.stats || []).slice(0, 6);
      stats.forEach((s, i) => {
        const cols = stats.length <= 4 ? 2 : 3;
        const w = (90 / cols) - 2;
        const x = 5 + (i % cols) * (w + 2);
        const y = 28 + Math.floor(i / cols) * 32;
        
        add({ type:"shape", shape:"rect", x, y, w, h: 28, color: accent, opacity:0.1 });
        add({ type:"text", text: s.value, x, y: y+4, w, h: 12, fontSize: 48, color: accent, bold:true, align:"center" });
        add({ type:"text", text: s.label, x, y: y+18, w, h: 8, fontSize: 16, color: bodyClr, align:"center" });
      });
      break;

    case "comparison":
    case "table":
      add({ type:"text", text: title, x: 5, y: 8, w: 90, h: 12, fontSize: 38, color: hlClr, bold: true, align:"left" });
      add({ type:"shape", shape:"rect", x: 5, y: 21, w: 90, h: 0.3, color: accent, opacity: 0.4 });
      
      const headers = slide.tableHeaders || ["Feature", "A", "B"];
      const rows = (slide.tableData || []).slice(0, 5);
      
      headers.slice(0,3).forEach((h, i) => {
        const w = 90 / Math.min(3, headers.length);
        add({ type:"shape", shape:"rect", x: 5 + (i*w), y: 26, w: w-1, h: 10, color: accent, opacity:0.8 });
        add({ type:"text", text: h, x: 5 + (i*w), y: 27, w: w-1, h: 8, fontSize: 22, color: tmpl.bg, bold:true, align:"center" });
      });

      rows.forEach((r, ri) => {
        const row = Array.isArray(r) ? r : [r];
        row.slice(0,3).forEach((cell, ci) => {
          const w = 90 / Math.min(3, headers.length);
          add({ type:"shape", shape:"rect", x: 5 + (ci*w), y: 38 + (ri*11), w: w-1, h: 10, color: accent, opacity: ri%2===0 ? 0.1 : 0 });
          add({ type:"text", text: cell, x: 5 + (ci*w), y: 39 + (ri*11), w: w-1, h: 8, fontSize: 18, color: bodyClr, align:"center" });
        });
      });
      break;

    case "swot":
      add({ type:"text", text: title, x: 5, y: 8, w: 90, h: 12, fontSize: 38, color: hlClr, bold: true, align:"left" });
      add({ type:"shape", shape:"rect", x: 5, y: 21, w: 90, h: 0.3, color: accent, opacity: 0.4 });
      
      const swot = slide.swotItems || {};
      const quads = [
        { label: "Strengths", items: swot.strengths || [], x: 5, y: 26, c: "16a34a" },
        { label: "Weaknesses", items: swot.weaknesses || [], x: 52, y: 26, c: "dc2626" },
        { label: "Opportunities", items: swot.opportunities || [], x: 5, y: 62, c: "2563eb" },
        { label: "Threats", items: swot.threats || [], x: 52, y: 62, c: "d97706" }
      ];

      quads.forEach(q => {
        add({ type:"shape", shape:"rect", x: q.x, y: q.y, w: 43, h: 32, color: q.c, opacity:0.05 });
        add({ type:"text", text: q.label, x: q.x+2, y: q.y+2, w: 39, h: 8, fontSize: 24, color: q.c, bold:true, align:"left" });
        q.items.slice(0,3).forEach((item, i) => {
          add({ type:"text", text: "•", x: q.x+2, y: q.y+12+(i*6), w: 2, h: 6, fontSize: 16, color: q.c, bold: true, align:"left" });
          add({ type:"text", text: item, x: q.x+4, y: q.y+12+(i*6), w: 37, h: 6, fontSize: 16, color: bodyClr, align:"left" });
        });
      });
      break;

    case "process":
    case "flow":
      add({ type:"text", text: title, x: 5, y: 8, w: 90, h: 12, fontSize: 38, color: hlClr, bold: true, align:"left" });
      add({ type:"shape", shape:"rect", x: 5, y: 21, w: 90, h: 0.3, color: accent, opacity: 0.4 });
      
      const steps = (slide.processSteps || slide.bullets || []).slice(0, 4);
      steps.forEach((step, i) => {
        const w = 90 / Math.max(1, steps.length);
        add({ type:"shape", shape:"rect", x: 5 + (i*w), y: 45, w: w-2, h: 30, color: accent, opacity:0.1 });
        add({ type:"text", text: String(i+1), x: 5 + (i*w), y: 35, w: w-2, h: 10, fontSize: 40, color: accent, bold:true, align:"center" });
        add({ type:"text", text: step, x: 7 + (i*w), y: 48, w: w-6, h: 25, fontSize: 18, color: bodyClr, align:"center" });
      });
      break;

    default: {
      // content, image, two-column (fallback to simple content)
      add({ type:"text", text: title, x: 5, y: 8, w: 90, h: 12, fontSize: 38, color: hlClr, bold: true, align:"left" });
      add({ type:"shape", shape:"rect", x: 5, y: 21, w: 90, h: 0.3, color: accent, opacity: 0.4 });
      
      const hasImg = !!slide.image;
      const tW = hasImg ? 45 : 90;
      
      bullets.slice(0, 7).forEach((b, i) => {
        const y = 28 + (i * 9);
        add({ type:"text", text: "•", x: 5, y, w: 2, h: 8, fontSize: 24, color: accent, bold: true, align:"left" });
        add({ type:"text", text: b, x: 7.5, y, w: tW - 7.5, h: 8, fontSize: 24, color: bodyClr, align:"left" });
      });

      if (!bullets.length && sub) {
        add({ type:"text", text: sub, x: 5, y: 28, w: tW, h: 60, fontSize: 24, color: subClr, align:"left" });
      }

      if (hasImg) {
        add({ type:"image", src: slide.image, x: 55, y: 26, w: 40, h: 60 });
      }
      break;
    }
  }

  // Accent bars
  add({ type:"shape", shape:"rect", x: 0, y: 0, w: 100, h: 0.8, color: accent });
  add({ type:"shape", shape:"rect", x: 0, y: 99.2, w: 100, h: 0.8, color: accent, opacity: 0.5 });

  return elements;
}
