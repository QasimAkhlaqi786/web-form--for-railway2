const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

// ngrok URL (make sure your backend has a POST /upload endpoint)
const LOCAL_FORWARD_URL = "https://33d5859621a6.ngrok-free.app/upload";

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

// Example usage
forwardFile("E:\\shopifyproject\\shopyfi-clone\\secondtry\\uploads\\test.jpg");

module.exports = forwardFile;
