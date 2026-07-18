import { User } from "../models/authmodel.js";

export const requireAuth = async (req, res, next) => {
    try {
        let token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
        }

        const user = await User.findOne({ token });
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid or expired token. Please log in again." });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: "Authentication failed", error: error.message });
    }
};
