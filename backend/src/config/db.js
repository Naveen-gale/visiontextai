import mongoose from "mongoose";

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI is missing in your environment variables. Please add it to your Render dashboard!");
        }
        
        mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected."));
        mongoose.connection.on("reconnected", () => console.log("MongoDB reconnected."));

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Initial Connection Error: ${error.message}`);
        console.warn("Server is continuing without MongoDB connection to allow testing offline features.");
        // process.exit(1); // Removed so backend can start without DB
    }
};

export default connectDB;
