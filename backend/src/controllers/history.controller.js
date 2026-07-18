import PptHistory from "../models/PptHistory.js";

export const saveHistory = async (req, res) => {
    try {
        const history = new PptHistory({ ...req.body, userId: req.user._id });
        await history.save();
        res.status(201).json({ success: true, data: history });
    } catch (error) {
        if (error.message.includes("buffering timed out")) {
            return res.status(503).json({ success: false, message: "Database connection failed. Please check your MongoDB IP whitelist or network connection." });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getHistory = async (req, res) => {
    try {
        const history = await PptHistory.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        if (error.message.includes("buffering timed out")) {
            return res.status(503).json({ success: false, message: "Database connection failed. Please check your MongoDB IP whitelist or network connection." });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getHistoryById = async (req, res) => {
    try {
        const historyItem = await PptHistory.findById(req.params.id);
        if (!historyItem) {
            return res.status(404).json({ success: false, message: "History item not found" });
        }
        res.status(200).json({ success: true, data: historyItem });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteHistoryItem = async (req, res) => {
    try {
        await PptHistory.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Item deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateHistory = async (req, res) => {
    try {
        const historyItem = await PptHistory.findOne({ _id: req.params.id });
        if (!historyItem) {
            return res.status(404).json({ success: false, message: "History item not found" });
        }
        
        // Ensure permission (owner or it's a legacy anonymous presentation)
        if (historyItem.userId && historyItem.userId.toString() !== req.user._id.toString()) {
             return res.status(403).json({ success: false, message: "You don't have permission to edit this item" });
        }
        
        // Only allow updating slides, prompt, template, fontStyle
        if (req.body.slides) historyItem.slides = req.body.slides;
        if (req.body.template) historyItem.template = req.body.template;
        if (req.body.fontStyle) historyItem.fontStyle = req.body.fontStyle;
        if (req.body.prompt) historyItem.prompt = req.body.prompt;
        
        // If it was a legacy item, we can now claim it for this user!
        if (!historyItem.userId) {
            historyItem.userId = req.user._id;
        }

        await historyItem.save();
        res.status(200).json({ success: true, data: historyItem });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const clearHistory = async (req, res) => {
    try {
        await PptHistory.deleteMany({ userId: req.user._id });
        res.status(200).json({ success: true, message: "All user history cleared" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
