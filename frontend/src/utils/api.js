// All API calls — uses Vite proxy locally (/api → http://localhost:5000/api), or Render URL in prod
let BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

// Auto-fix if the user forgot to add /api/v1 to the end of their Render URL in Vercel
if (BASE.startsWith("http") && !BASE.endsWith("/api/v1")) {
  BASE = BASE.replace(/\/+$/, "") + "/api/v1";
}

function getSessionId() {
  let sid = localStorage.getItem("visiontext_session_id");
  if (!sid) {
    sid = "sess_" + Math.random().toString(36).substring(2, 15) + Date.now();
    localStorage.setItem("visiontext_session_id", sid);
  }
  return sid;
}

const getHeaders = (isJson = true) => {
  const headers = {
    "x-session-id": getSessionId()
  };
  const token = localStorage.getItem("token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
};

// Utility to safely parse JSON or return better error metadata
async function handleResponse(res, context = "API call") {
  const contentType = res.headers.get("content-type");
  if (!res.ok) {
    let errorMsg = "Failed";
    try {
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        errorMsg = data.error || data.message || "Unknown error";
      } else {
        errorMsg = `Server returned ${res.status} ${res.statusText}. Check if VITE_API_BASE_URL is correct.`;
      }
    } catch (e) {
      errorMsg = `Unexpected response format from server (${res.status})`;
    }
    throw new Error(`${context}: ${errorMsg}`);
  }
  
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`${context}: Expected JSON response but received ${contentType || "nothing"}. Check if your backend URL is correct.`);
  }
  
  return await res.json();
}

export async function extractTextFromImages(files) {
  const fd = new FormData();
  files.forEach((f) => fd.append("photos", f));
  const res = await fetch(`${BASE}/convert`, { method: "POST", body: fd });
  return await handleResponse(res, "Extraction");
}

export async function aiSummarize(text) {
  const res = await fetch(`${BASE}/ai/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await handleResponse(res, "Summarize");
  return data.summary;
}

export async function aiTranslate(text, targetLanguage) {
  const res = await fetch(`${BASE}/ai/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLanguage }),
  });
  const data = await handleResponse(res, "Translate");
  return data.translated;
}

export async function aiFixGrammar(text) {
  const res = await fetch(`${BASE}/ai/fix-grammar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await handleResponse(res, "Grammar fix");
  return data.fixed;
}

export async function aiExtractInfo(text) {
  const res = await fetch(`${BASE}/ai/extract-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await handleResponse(res, "Extract info");
  return data.info;
}

/**
 * Send prompt + optional image to backend → returns slides JSON array
 */
export async function generatePptData({ prompt, image, slideCount = 8, structure = null }) {
  const fd = new FormData();
  fd.append("prompt", prompt);
  fd.append("slideCount", String(slideCount));
  if (structure) fd.append("structure", structure);
  if (image) fd.append("image", image);
  const res = await fetch(`${BASE}/ai/generate-ppt`, { 
    method: "POST", 
    headers: { "x-session-id": getSessionId() },
    body: fd 
  });
  const data = await handleResponse(res, "PPT Generation");
  return data.slides;
}

export async function generatePptOutline(prompt, slideCount, styleGuide = null, structure = null) {
  const res = await fetch(`${BASE}/ai/generate-outline`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ prompt, slideCount, styleGuide, structure }),
  });
  const data = await handleResponse(res, "Outline Generation");
  return data.outline;
}

export async function generatePptSlide(topic, outline, slideIndex, styleGuide = null) {
  const res = await fetch(`${BASE}/ai/generate-slide`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ topic, outline, slideIndex, styleGuide }),
  });
  const data = await handleResponse(res, "Slide Generation");
  return data.slide;
}

export async function analyzeReferencePpt(file) {
  const fd = new FormData();
  fd.append("reference", file);
  const res = await fetch(`${BASE}/ai/analyze-reference`, { method: "POST", body: fd });
  const data = await handleResponse(res, "Reference Analysis");
  return data.data;
}

export async function generateInsertedSlideData(topic, currentSlides, insertIndex, styleGuide = null) {
  const res = await fetch(`${BASE}/ai/generate-inserted-slide`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ topic, currentSlides, insertIndex, styleGuide }),
  });
  const data = await handleResponse(res, "Inserted Slide Generation");
  return data.slide;
}

/**
 * Edit existing PPT data using a natural language prompt
 */
export async function editPptData(prompt, currentSlides) {
  const res = await fetch(`${BASE}/ai/edit-ppt`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ prompt, currentSlides }),
  });
  const data = await handleResponse(res, "PPT Edit");
  return data.slides;
}

/**
 * Upload a .pptx Blob to backend → returns an ImageKit public URL
 */
export async function uploadPptFile(blob, fileName = "presentation.pptx") {
  const fd = new FormData();
  fd.append("file", blob, fileName);
  const res = await fetch(`${BASE}/upload-ppt`, { method: "POST", body: fd });
  const data = await handleResponse(res, "PPT Upload");
  return data.url;
}

/**
 * Call AI Text Improvement
 */
export async function improveTextApi(text, action) {
  const res = await fetch(`${BASE}/ai/improve-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, action }),
  });
  const data = await handleResponse(res, "Text Improve");
  return data.text;
}

export async function savePptHistory(historyData) {
  const res = await fetch(`${BASE}/history`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(historyData),
  });
  const data = await handleResponse(res, "Save History");
  return data.data;
}

export async function getPptHistory() {
  const res = await fetch(`${BASE}/history`, { headers: getHeaders(false) });
  const data = await handleResponse(res, "Get History");
  return data.data;
}

export async function deletePptHistoryItem(id) {
  const res = await fetch(`${BASE}/history/${id}`, { method: "DELETE", headers: getHeaders(false) });
  await handleResponse(res, "Delete History Item");
}

export async function clearAllPptHistory() {
  const res = await fetch(`${BASE}/history/clear`, { method: "DELETE", headers: getHeaders(false) });
  await handleResponse(res, "Clear History");
}

export async function getPptHistoryById(id) {
  const res = await fetch(`${BASE}/history/${id}`, { headers: getHeaders(false) });
  const data = await handleResponse(res, "Get PPT by ID");
  return data.data;
}

export async function saveExtractHistory(historyData) {
  const res = await fetch(`${BASE}/extract-history`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(historyData),
  });
  const data = await handleResponse(res, "Save Extract History");
  return data.data;
}

export async function getExtractHistory() {
  const res = await fetch(`${BASE}/extract-history`, { headers: getHeaders(false) });
  const data = await handleResponse(res, "Get Extract History");
  return data.data;
}

export async function deleteExtractHistoryItem(id) {
  const res = await fetch(`${BASE}/extract-history/${id}`, { method: "DELETE", headers: getHeaders(false) });
  await handleResponse(res, "Delete Extract History Item");
}

export async function clearAllExtractHistory() {
  const res = await fetch(`${BASE}/extract-history/clear`, { method: "DELETE", headers: getHeaders(false) });
  await handleResponse(res, "Clear Extract History");
}

export async function editSingleSlideData(prompt, slide) {
  const res = await fetch(`${BASE}/ai/edit-slide`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ prompt, slide }),
  });
  const data = await handleResponse(res, "Slide Refinement");
  return data.slide;
}

export async function aiAnswerQuestion(text, question) {
  const res = await fetch(`${BASE}/ai/answer-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, question }),
  });
  const data = await handleResponse(res, "Question Answering");
  return data.answer;
}

export async function aiSimplify(text) {
  const res = await fetch(`${BASE}/ai/simplify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await handleResponse(res, "Concept Simplifier");
  return data.result;
}

export async function aiKnowledgeGraph(text) {
  const res = await fetch(`${BASE}/ai/knowledge-graph`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await handleResponse(res, "Knowledge Graph");
  return data.result;
}

export async function aiSuggestions(text) {
  const res = await fetch(`${BASE}/ai/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await handleResponse(res, "Suggestions Engine");
  return data.result;
}

/**
 * NEW: Save user correction for Auto-Learning AI
 */
export async function saveAiCorrection({ originalValue, correctedValue, type, slideTopic, slideType }) {
  try {
    const res = await fetch(`${BASE}/ai/learn`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ originalValue, correctedValue, type, slideTopic, slideType }),
    });
    return await handleResponse(res, "Correction Learning");
  } catch (err) {
    console.warn("Learning auto-save failed:", err.message);
    return null;
  }
}

/**
 * NEW: Predict Theme based on user prompt
 */
export async function predictTheme(prompt) {
  const res = await fetch(`${BASE}/ai/predict-theme`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-id": getSessionId() },
    body: JSON.stringify({ prompt }),
  });
  const data = await handleResponse(res, "Predict Theme");
  return data.theme;
}

/**
 * NEW: Predict Structure based on user prompt
 */
export async function predictStructure(prompt) {
  const res = await fetch(`${BASE}/ai/predict-structure`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-id": getSessionId() },
    body: JSON.stringify({ prompt }),
  });
  const data = await handleResponse(res, "Predict Structure");
  return data.structure;
}

export async function apiSignup({ name, email, password }) {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return await handleResponse(res, "Signup");
}

export async function apiLogin({ email, password }) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return await handleResponse(res, "Login");
}
