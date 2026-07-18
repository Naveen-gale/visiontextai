import mongoose from 'mongoose';

const pptHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, index: true }, // Legacy
    prompt: { type: String, required: true },
    slideCount: { type: Number, required: true },
    template: { type: String, required: true },
    fontStyle: { type: String, required: true },
    slides: { type: Array, required: true },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('PptHistory', pptHistorySchema);
