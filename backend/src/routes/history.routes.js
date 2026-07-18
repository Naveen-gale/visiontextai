import express from "express";
import { saveHistory, getHistory, deleteHistoryItem, clearHistory, getHistoryById, updateHistory } from "../controllers/history.controller.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", requireAuth, saveHistory);
router.get("/", requireAuth, getHistory);
router.get("/:id", getHistoryById); // Public for viewing shared presentations
router.put("/:id", requireAuth, updateHistory);
router.delete("/clear", requireAuth, clearHistory);
router.delete("/:id", requireAuth, deleteHistoryItem);

export default router;
