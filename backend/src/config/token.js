import crypto from "crypto";

export const genToken = () => {
    return crypto.randomBytes(32).toString("hex");
};
