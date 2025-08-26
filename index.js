const express = require('express');
const app = express();
const { engine } = require('express-handlebars');
const path = require('path');
const mysql = require('mysql2');
const multer = require('multer');
const fs = require('fs');
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.files) {
        console.log('Files:', Object.keys(req.files));
    }
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', req.body);
    }
    next();
});

// DB Connection - Use Railway's environment variables
const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.MYSQLHOST || 'mysql-ersc.railway.internal',
    port: process.env.MYSQLPORT || 3306,
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || 'yLHmjSDMFoIvgZASnnffMgYyIBEgVbsC',
    database: process.env.MYSQLDATABASE || 'applicants_db'
});

// Test connection with better error handling
db.getConnection((err, connection) => {
    if (err) {
        console.error('MySQL connection error:', err);
        console.error('Connection details:', {
            host: process.env.MYSQLHOST,
            port: process.env.MYSQLPORT,
            user: process.env.MYSQLUSER,
            database: process.env.MYSQLDATABASE
        });
    } else {
        console.log('MySQL Connected successfully to database:', process.env.MYSQLDATABASE);
        connection.release();
    }
});

// Handlebars setup
app.engine('handlebars', engine({
    defaultLayout: 'app',
    helpers: {
        formatDate: function(date) {
            if (!date) return 'N/A';
            const d = new Date(date);
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        },
        currentDate: function() {
            return new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
}));
app.set('view engine', 'handlebars');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage
const tempStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const tempDir = path.join(__dirname, 'temp_uploads');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: tempStorage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'candidate_photo') {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed for candidate photo'), false);
            }
        } else {
            cb(null, true);
        }
    },
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB limit
    }
});

// Routes
app.get('/', (req, res) => res.render('form'));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Handle form submit (keep your existing code but add better error handling)
app.post('/submit', upload.fields([
    { name: 'candidate_photo', maxCount: 1 },
    { name: 'photos', maxCount: 2 },
    { name: 'documents', maxCount: 10 }
]), (req, res, next) => {
    console.log('=== MULTER UPLOAD COMPLETE ===');
    next();
}, (req, res) => {
    // Your existing form handling code...
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('Something went wrong!');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`App is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
