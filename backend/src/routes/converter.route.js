import { uploadImages } from "../services/uploadImage.service.js";
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
    convertImages,
    summarize,
    translate,
    grammar,
    extractInfo,
    generatePPT,
    uploadPPT,
    improveSlideText,
    editPPT,
    editSingleSlide,
    generateOutline,
    generateSlide,
    analyzeReference,
    generateInsertedSlide,
    answerQuestion,
    simplify,
    knowledgeGraph,
    getSuggestions,
    saveLearningData,
    predictTheme,
    predictStructure
} from "../controllers/converter.controller.js";

const router = Router();

// Single-image multer for PPT generation and upload
const uploadsDir = "uploads/";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const pptImageUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `ppt-img-\${Date.now()}\${ext}`);
        },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only images allowed for PPT context"), false);
    },
}).single("image");

const pptFileUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => cb(null, `share-ppt-${Date.now()}.pptx`),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
}).single("file");

const genericImageUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname);
            cb(null, `img-${Date.now()}${ext}`);
        },
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
}).single("image");

const pptReferenceUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => cb(null, `ref-ppt-${Date.now()}.pptx`),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
}).single("reference");

// Image upload & text extraction
router.post("/convert", uploadImages, convertImages);

// AI Features (JSON body)
router.post("/ai/summarize", summarize);
router.post("/ai/translate", translate);
router.post("/ai/fix-grammar", grammar);
router.post("/ai/extract-info", extractInfo);
router.post("/ai/answer-question", answerQuestion);
router.post("/ai/learn", saveLearningData);
router.post("/ai/simplify", simplify);
router.post("/ai/knowledge-graph", knowledgeGraph);
router.post("/ai/suggestions", getSuggestions);
router.post("/ai/predict-theme", predictTheme);
router.post("/ai/predict-structure", predictStructure);

// AI PPT Generation
router.post("/ai/generate-ppt", pptImageUpload, generatePPT);
router.post("/ai/generate-outline", generateOutline);
router.post("/ai/generate-slide", generateSlide);
router.post("/ai/generate-inserted-slide", generateInsertedSlide);
router.post("/ai/analyze-reference", pptReferenceUpload, analyzeReference);
router.post("/ai/edit-ppt", editPPT);
router.post("/ai/edit-slide", editSingleSlide);

// Upload generated PPT to ImageKit for sharing
router.post("/upload-ppt", pptFileUpload, uploadPPT);

// Upload generic image to ImageKit
router.post("/upload-image", genericImageUpload, uploadPPT); // we can reuse uploadPPT since it just takes req.file and uploads to ImageKit

// AI Text Improvement
router.post("/ai/improve-text", improveSlideText);

export default router;