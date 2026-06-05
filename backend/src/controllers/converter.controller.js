import { extractTextFromImage, summarizeText, translateText, fixGrammar, extractKeyInfo, generatePPTContent, generatePPTOutline, generateSingleSlideContent, generateNewInsertedSlide, editSingleSlideContent, editPPTContent, askQuestion, simplifyConcept, generateKnowledgeGraph, suggestionEngine, predictThemeAi, predictStructureAi } from "../services/groq.service.js";
import { uploadToImageKit } from "../services/imagekit.service.js";
import { extractDocumentText, formatDocumentTextWithAI } from "../services/document.service.js";
import { analyzePPTX } from "../services/pptAnalysis.service.js";
import AiLearning from "../models/AiLearning.js";
import fs from "fs/promises";

/**
 * POST /api/v1/convert
 * Upload images or docs → extract text
 */
export const convertImages = async (req, res) => {
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({
            success: false,
            error: "No files received. Use 'photos' as the field name with form-data."
        });
    }

    console.log(`[Convert] Processing ${files.length} file(s)...`);

    try {
        const results = await Promise.all(
            files.map(async (file) => {
                let imagekitData = null;
                try {
                    const ext = file.originalname.split(".").pop().toLowerCase();
                    const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);

                    // 1. Upload to ImageKit (only doing this for images visually, to avoid heavy PDF hosting)
                    if (isImage) {
                        try {
                            imagekitData = await uploadToImageKit(file.path, file.originalname);
                        } catch (uploadErr) {
                            console.warn(`ImageKit upload failed for ${file.originalname}:`, uploadErr.message);
                        }
                    }

                    // 2. Extract Text Based on Document Type
                    let extractedText = "";
                    if (isImage) {
                        extractedText = await extractTextFromImage(file.path);
                    } else {
                        // Extract plain text locally first from PDF/DOC/PPT
                        const rawText = await extractDocumentText(file.path, file.originalname);
                        // Send through AI formatter 
                        extractedText = await formatDocumentTextWithAI(rawText);
                    }

                    return {
                        success: true,
                        fileName: file.originalname,
                        text: extractedText || "[NO TEXT FOUND]",
                        wordCount: (extractedText || "").split(/\s+/).filter(Boolean).length,
                        charCount: (extractedText || "").length,
                        imageUrl: imagekitData?.url || null,
                        imageFileId: imagekitData?.fileId || null,
                        thumbnailUrl: imagekitData?.thumbnailUrl || null,
                    };
                } catch (err) {
                    console.error(`Error processing ${file.originalname}:`, err.message);
                    return {
                        success: false,
                        fileName: file.originalname,
                        text: "",
                        error: err.message,
                        imageUrl: imagekitData?.url || null,
                    };
                } finally {
                    // Clean up temp file
                    try { await fs.unlink(file.path); } catch {}
                }
            })
        );

        return res.status(200).json({
            success: true,
            count: results.length,
            results,
        });

    } catch (error) {
        console.error("[Convert] Fatal error:", error);
        for (const file of files) {
            try { await fs.unlink(file.path); } catch {}
        }
        return res.status(500).json({
            success: false,
            error: "Critical error during processing",
            details: error.message
        });
    }
};

/**
 * POST /api/v1/ai/summarize
 */
export const summarize = async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ success: false, error: "No text provided." });
    }
    try {
        const summary = await summarizeText(text);
        return res.status(200).json({ success: true, summary });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/translate
 */
export const translate = async (req, res) => {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
        return res.status(400).json({ success: false, error: "text and targetLanguage are required." });
    }
    try {
        const translated = await translateText(text, targetLanguage);
        return res.status(200).json({ success: true, translated, targetLanguage });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/fix-grammar
 */
export const grammar = async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ success: false, error: "No text provided." });
    }
    try {
        const fixed = await fixGrammar(text);
        return res.status(200).json({ success: true, fixed });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/extract-info
 */
export const extractInfo = async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ success: false, error: "No text provided." });
    }
    try {
        const info = await extractKeyInfo(text);
        return res.status(200).json({ success: true, info });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/answer-question
 */
export const answerQuestion = async (req, res) => {
    const { text, question } = req.body;
    if (!text || !question) {
        return res.status(400).json({ success: false, error: "Both text and question are required." });
    }
    try {
        const answer = await askQuestion(text, question);
        return res.status(200).json({ success: true, answer });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/simplify
 */
export const simplify = async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ success: false, error: "No text provided." });
    try {
        const result = await simplifyConcept(text);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/knowledge-graph
 */
export const knowledgeGraph = async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ success: false, error: "No text provided." });
    try {
        const result = await generateKnowledgeGraph(text);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/suggestions
 */
export const getSuggestions = async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ success: false, error: "No text provided." });
    try {
        const result = await suggestionEngine(text);
        return res.status(200).json({ success: true, result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/generate-ppt
 * Body (multipart/form-data): prompt, slideCount?, image (optional file)
 * Returns JSON array of slide objects.
 */
export const generatePPT = async (req, res) => {
    const prompt = req.body?.prompt?.trim();
    if (!prompt) {
        return res.status(400).json({ success: false, error: "prompt is required." });
    }
    const slideCount = Math.min(Math.max(parseInt(req.body?.slideCount || 8, 10), 4), 20);
    const structure = req.body?.structure?.trim();

    let base64Image = null;
    let mimeType = "image/jpeg";

    if (req.file) {
        try {
            const buffer = await fs.readFile(req.file.path);
            base64Image = buffer.toString("base64");
            mimeType = req.file.mimetype || "image/jpeg";
        } catch (e) {
            console.warn("Could not read uploaded image:", e.message);
        } finally {
            try { await fs.unlink(req.file.path); } catch {}
        }
    }

    try {
        const sessionId = req.headers["x-session-id"] || "anonymous";
        const slides = await generatePPTContent(prompt, base64Image, mimeType, slideCount, sessionId, structure);
        return res.status(200).json({ success: true, slides });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * NEW: Generate Outline
 */
export const generateOutline = async (req, res) => {
    const { prompt, slideCount, styleGuide, structure } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: "Prompt is required." });

    try {
        const sessionId = req.headers["x-session-id"] || "anonymous";
        const outline = await generatePPTOutline(prompt, slideCount || 8, styleGuide, sessionId, structure);
        return res.status(200).json({ success: true, outline });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * NEW: Generate Single Slide
 */
export const generateSlide = async (req, res) => {
    const { topic, outline, slideIndex, styleGuide } = req.body;
    if (!topic || !outline || slideIndex === undefined) {
        return res.status(400).json({ success: false, error: "Missing topic, outline, or slideIndex." });
    }

    try {
        const sessionId = req.headers["x-session-id"] || "anonymous";
        const slide = await generateSingleSlideContent(topic, outline, slideIndex, styleGuide, sessionId);
        return res.status(200).json({ success: true, slide });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * NEW: Analyze Reference PPTX
 */
export const analyzeReference = async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded." });

    try {
        const data = await analyzePPTX(req.file.path);
        const sessionId = req.headers["x-session-id"] || "anonymous";

        // 1. "Learn" from this presentation: Save key content to AiLearning
        // This helps the AI predict and adapt to the user's existing style/content
        if (data.slides && data.slides.length > 0) {
            try {
                const learningEntries = data.slides.slice(0, 5).map(s => ({
                    sessionId,
                    input: {
                        type: "reference",
                        topic: s.title || "N/A",
                        text: "Reference Presentation Style"
                    },
                    output: {
                        text: `Reference Slide - Title: "${s.title}", Content: "${(s.bullets || []).join('; ')}"`
                    },
                    context: {
                        slide_type: s.type || "content",
                        style: "reference_import",
                        max_words: 100
                    },
                    meta: {
                        source: "pptx_import",
                        confidence: 0.9
                    }
                }));
                await AiLearning.insertMany(learningEntries);
                console.log(`[Learning] Imported ${learningEntries.length} reference samples from PPTX.`);
            } catch (learnErr) {
                console.warn("[Learning] Failed to save reference samples:", learnErr.message);
            }
        }

        // 2. Return the data "as is" to satisfy "it must ope the existing ppt as it in real ppt"
        // If the user wants to AI-improve it, they can use the "Edit All Slides" feature.
        return res.status(200).json({ 
            success: true, 
            data: { 
                style: data.style, 
                slides: data.slides // Returning raw extraction to prevent text loss
            } 
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        try { await fs.unlink(req.file.path); } catch {}
    }
};

/**
 * NEW: Generate a contextual slide for insertion
 */
export const generateInsertedSlide = async (req, res) => {
    const { topic, currentSlides, insertIndex, styleGuide } = req.body;
    if (!topic || !currentSlides || insertIndex === undefined) {
        return res.status(400).json({ success: false, error: "Missing topic, currentSlides, or insertIndex." });
    }

    try {
        const sessionId = req.headers["x-session-id"] || "anonymous";
        const slide = await generateNewInsertedSlide(topic, currentSlides, insertIndex, styleGuide, sessionId);
        return res.status(200).json({ success: true, slide });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/upload-ppt
 * Body (multipart/form-data): file (the .pptx blob)
 * Returns ImageKit public URL.
 */
export const uploadPPT = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded." });
    }
    try {
        const result = await uploadToImageKit(req.file.path, req.file.originalname || "presentation.pptx");
        // We will keep the file in the `uploads/` folder for backend testing, 
        // so we DO NOT unlink it here.
        console.log(`[Testing] Saved generated PPT to: ${req.file.path}`);
        return res.status(200).json({ success: true, url: result.url, fileId: result.fileId });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/improve-text
 * Body: { text: "...", action: "spelling" | "autocomplete" | "improve" }
 */
export const improveSlideText = async (req, res) => {
    const { text, action } = req.body;
    if (!text || !action) return res.status(400).json({ success: false, error: "Missing text or action." });

    try {
        const { improveTextEngine } = await import("../services/groq.service.js");
        const result = await improveTextEngine(text, action);
        return res.status(200).json({ success: true, text: result });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/edit-ppt
 * Body: { prompt: "make it professional", currentSlides: [...] }
 */
export const editPPT = async (req, res) => {
    const { prompt, currentSlides } = req.body;
    if (!prompt || !currentSlides || !Array.isArray(currentSlides)) {
        return res.status(400).json({ success: false, error: "prompt and currentSlides array are required." });
    }

    try {
        const sessionId = req.headers["x-session-id"] || "anonymous";
        const slides = await editPPTContent(prompt, currentSlides, sessionId);
        return res.status(200).json({ success: true, slides });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/edit-slide
 * Body: { prompt: "add details", slide: { ... } }
 */
export const editSingleSlide = async (req, res) => {
    const { prompt, slide } = req.body;
    if (!prompt || !slide) {
        return res.status(400).json({ success: false, error: "prompt and slide object are required." });
    }

    try {
        const sessionId = req.headers["x-session-id"] || "anonymous";
        const updatedSlide = await editSingleSlideContent(prompt, slide, sessionId);
        return res.status(200).json({ success: true, slide: updatedSlide });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
/**
 * POST /api/v1/ai/learn
 * Body: { sessionId, originalValue, correctedValue, type, slideTopic }
 */
export const saveLearningData = async (req, res) => {
    const { originalValue, correctedValue, type, slideTopic, slideType } = req.body;
    const sessionId = req.headers["x-session-id"] || req.body.sessionId || "anonymous";

    if (!originalValue || !correctedValue) {
        return res.status(400).json({ success: false, error: "originalValue and correctedValue are required." });
    }

    try {
        // Only save if significant change
        if (originalValue.trim() === correctedValue.trim()) {
            return res.status(200).json({ success: true, message: "No change detected, skipping." });
        }

        const learning = new AiLearning({
            sessionId: sessionId || "anonymous",
            input: {
                type: type || "general",
                topic: slideTopic || "N/A",
                text: originalValue
            },
            output: {
                text: correctedValue
            },
            context: {
                slide_type: slideType || type || "general",
                style: "standard",
                max_words: correctedValue.split(/\s+/).length + 5
            },
            meta: {
                source: "user_edit",
                confidence: 1.0
            }
        });

        await learning.save();
        console.log(`[Learning] Saved correction in new format: "${originalValue}" -> "${correctedValue}"`);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/predict-theme
 * Body: { prompt: "..." }
 */
export const predictTheme = async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ success: false, error: "No prompt provided." });
    }
    
    try {
        const theme = await predictThemeAi(prompt);
        return res.status(200).json({ success: true, theme });
    } catch (error) {
        console.error("Theme prediction error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/v1/ai/predict-structure
 * Body: { prompt: "..." }
 */
export const predictStructure = async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ success: false, error: "No prompt provided." });
    }
    
    try {
        const structure = await predictStructureAi(prompt);
        return res.status(200).json({ success: true, structure });
    } catch (error) {
        console.error("Structure prediction error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};