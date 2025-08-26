const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// ngrok URL from your local PC
const LOCAL_FORWARD_URL = "https://<your-ngrok-id>.ngrok.io/receive";

async function forwardFile(filePath) {
    try {
        const form = new FormData();
        form.append("file", fs.createReadStream(filePath));

        await axios.post(LOCAL_FORWARD_URL, form, {
            headers: form.getHeaders(),
        });

        console.log("✅ File forwarded to local PC:", path.basename(filePath));
    } catch (err) {
        console.error("❌ Error forwarding file:", err.message);
    }
}

module.exports = forwardFile;
