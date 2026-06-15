import express from "express";
import cors from "cors";
import converterRouter from "./routes/converter.route.js";
import historyRouter from "./routes/history.routes.js";
import extractHistoryRouter from "./routes/extractHistory.routes.js";
import AuthRouter from "./routes/Authroute.js";
const app = express();

// Allow localhost and production Vercel frontend
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        
        // Allow custom frontend URL from env variables
        if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
            return callback(null, true);
        }
        
        // Allow any vercel domain just in case of preview deployments (optional but handy)
        if (origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        // Allow any localhost, 127.0.0.1, or local network IPs (192.168.x.x, 10.x.x.x, 172.x.x.x)
        if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        
        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-session-id"],
    credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});


app.use("/api/v1/auth",AuthRouter)
app.use("/api/v1", converterRouter);
app.use("/api/v1/history", historyRouter);
app.use("/api/v1/extract-history", extractHistoryRouter);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("[ERROR]", err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Something went wrong!",
    });
});

export default app;