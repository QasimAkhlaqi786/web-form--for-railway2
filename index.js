const express = require('express');
const app = express();
const { engine } = require('express-handlebars');
const path = require('path');
const mysql = require('mysql2');
const multer = require('multer');
const fs = require('fs');
const port = 36138;

app.use(express.static(path.join(__dirname, 'public')));
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

// In your server code
app.use(express.static(path.join(__dirname, 'public')));

// This means:
// /js/form.js -> serves public/js/form.js
// /css/style.css -> serves public/css/style.css

// DB Connection
const db = mysql.createConnection({
    host: 'nozomi.proxy.rlwy.net',
    user: 'root',
    password: 'yLHmjSDMFoIvgZASnnffMgYyIBEgVbsC',
    database: 'applicants_db'
});

db.connect(err => {
    if (err) throw err;
    console.log('MySQL Connected...');
});

// Handlebars setup with helpers
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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage - initially save to temp location
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
        fileSize: 2 * 1024 * 1024 // 2MB limit for candidate photo
    }
});

// Routes
app.get('/', (req, res) => res.render('form'));

// Handle form submit
app.post('/submit', upload.fields([
    { name: 'candidate_photo', maxCount: 1 },
    { name: 'photos', maxCount: 2 },
    { name: 'documents', maxCount: 10 }
]), (req, res, next) => {
    console.log('=== MULTER UPLOAD COMPLETE ===');
    console.log('Request files keys:', Object.keys(req.files));
    
    if (req.files['candidate_photo']) {
        console.log('Candidate photo found:', req.files['candidate_photo'][0].filename);
    } else {
        console.log('NO CANDIDATE PHOTO FOUND - checking if simple field exists');
        // Check if it's uploaded with a different field name
        Object.keys(req.files).forEach(key => {
            console.log('Found field:', key);
        });
    }
    
    next();
}, (req, res) => {
    console.log('Files received:', req.files);
    console.log('Body received:', req.body);

    const {
        applicant_name,
        father_name,
        religion,
        cnic,
        dob,
        domicile,
        caste,
        cnic_expiry,
        application_form
    } = req.body;

    // First insert the application to get the serial number
    const insertSql = `INSERT INTO applicants 
        (applicant_name, father_name, religion, cnic, dob, domicile, caste, cnic_expiry, application_form)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(insertSql, [
        applicant_name, father_name, religion, cnic, dob, domicile, caste, cnic_expiry, application_form
    ], (err, result) => {
        if (err) {
            console.error('Database insert error:', err);
            // Clean up temp files if error occurs
            if (req.files) {
                Object.values(req.files).flat().forEach(file => {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
            }
            return res.status(500).send('Database error: ' + err.message);
        }

        const applicationId = result.insertId;
        const serialNo = `APP${String(applicationId).padStart(6, '0')}`;

        // Create directory for this application
        const appDir = path.join(uploadsDir, serialNo);
        if (!fs.existsSync(appDir)) {
            fs.mkdirSync(appDir, { recursive: true });
            console.log('Created application directory:', appDir);
        }

        // Process and move files
        const processFiles = () => {
            const filePromises = [];

            console.log('Available files:', Object.keys(req.files));

            // Process candidate photo
            if (req.files['candidate_photo'] && req.files['candidate_photo'][0]) {
                const file = req.files['candidate_photo'][0];
                console.log('Processing candidate photo:', file.filename);
                const fileExtension = path.extname(file.originalname);
                const newFilename = `candidate_photo${fileExtension}`;
                const newPath = path.join(appDir, newFilename);
                
                filePromises.push(
                    fs.promises.rename(file.path, newPath)
                        .then(() => {
                            console.log('Moved candidate photo to:', newPath);
                            return {
                                filename: newFilename,
                                type: 'candidate_photo'
                            };
                        })
                        .catch(error => {
                            console.error('Error moving candidate photo:', error);
                            return fs.promises.copyFile(file.path, newPath)
                                .then(() => {
                                    console.log('Copied candidate photo to:', newPath);
                                    return {
                                        filename: newFilename,
                                        type: 'candidate_photo'
                                    };
                                })
                                .catch(copyError => {
                                    console.error('Error copying candidate photo:', copyError);
                                    return null;
                                });
                        })
                );
            } else {
                console.log('No candidate photo found in request');
            }

            // Process other files
            ['photos', 'documents'].forEach(field => {
                if (req.files[field]) {
                    req.files[field].forEach((file, index) => {
                        console.log('Processing', field, index + 1, ':', file.filename);
                        const fileExtension = path.extname(file.originalname);
                        const newFilename = `${field}_${index + 1}${fileExtension}`;
                        const newPath = path.join(appDir, newFilename);
                        
                        filePromises.push(
                            fs.promises.rename(file.path, newPath)
                                .then(() => {
                                    console.log('Moved', field, 'to:', newPath);
                                    return {
                                        filename: newFilename,
                                        type: field
                                    };
                                })
                                .catch(error => {
                                    console.error('Error moving', field, ':', error);
                                    return fs.promises.copyFile(file.path, newPath)
                                        .then(() => {
                                            console.log('Copied', field, 'to:', newPath);
                                            return {
                                                filename: newFilename,
                                                type: field
                                            };
                                        })
                                        .catch(copyError => {
                                            console.error('Error copying', field, ':', copyError);
                                            return null;
                                        });
                                })
                        );
                    });
                }
            });

            return Promise.all(filePromises);
        };

        processFiles()
            .then((savedFiles) => {
                const validFiles = savedFiles.filter(file => file !== null);
                
                const candidatePhoto = validFiles.find(f => f.type === 'candidate_photo');
                const photos = validFiles.filter(f => f.type === 'photos').map(f => f.filename);
                const documents = validFiles.filter(f => f.type === 'documents').map(f => f.filename);

                console.log('Processed files:', { candidatePhoto, photos, documents });

                // Update the database
                const updateSql = `UPDATE applicants 
                    SET candidate_photo = ?, photos = ?, documents = ?, serial_no = ?, status = 'submitted'
                    WHERE id = ?`;

                db.query(updateSql, [
                    candidatePhoto ? candidatePhoto.filename : null,
                    photos.join(','),
                    documents.join(','),
                    serialNo,
                    applicationId
                ], (err) => {
                    if (err) {
                        console.error('Database update error:', err);
                        return res.status(500).send('Error updating application');
                    }
                    
                    console.log('Application saved successfully:', serialNo);
                    
                    res.render('success', {
                        serialNo: serialNo,
                        applicant_name: applicant_name,
                        candidate_photo: candidatePhoto ? candidatePhoto.filename : null,
                        message: 'Application submitted successfully!',
                        currentDate: new Date().toLocaleString()
                    });
                });
            })
            .catch(error => {
                console.error('Error processing files:', error);
                res.status(500).send('Error processing files');
            });
    });
});

// Route to view application details
app.get('/application/:serialNo', (req, res) => {
    const { serialNo } = req.params;
    
    const sql = `SELECT * FROM applicants WHERE serial_no = ?`;
    db.query(sql, [serialNo], (err, results) => {
        if (err) throw err;
        
        if (results.length > 0) {
            const application = results[0];
            res.render('application-details', {
                application: application,
                candidate_photo: application.candidate_photo,
                photos: application.photos ? application.photos.split(',') : [],
                documents: application.documents ? application.documents.split(',') : [],
                currentDate: new Date().toLocaleString()
            });
        } else {
            res.status(404).send('Application not found');
        }
    });
});

// Print route with photo data URL
app.get('/print/:serialNo', (req, res) => {
    const { serialNo } = req.params;
    
    const sql = `SELECT * FROM applicants WHERE serial_no = ?`;
    db.query(sql, [serialNo], (err, results) => {
        if (err) throw err;
        
        if (results.length > 0) {
            const application = results[0];
            let photoDataURL = null;
            
            // Convert photo to base64 for printing
            if (application.candidate_photo) {
                const photoPath = path.join(uploadsDir, application.serial_no, application.candidate_photo);
                if (fs.existsSync(photoPath)) {
                    try {
                        const imageBuffer = fs.readFileSync(photoPath);
                        const base64Image = imageBuffer.toString('base64');
                        const mimeType = 'image/jpeg'; // Assuming JPEG
                        photoDataURL = `data:${mimeType};base64,${base64Image}`;
                    } catch (error) {
                        console.error('Error reading photo:', error);
                    }
                }
            }
            
            res.render('print-application', {
                application: application,
                candidate_photo: application.candidate_photo,
                photo_data_url: photoDataURL,
                photos: application.photos ? application.photos.split(',') : [],
                documents: application.documents ? application.documents.split(',') : [],
                currentDate: new Date().toLocaleString()
            });
        } else {
            res.status(404).send('Application not found');
        }
    });
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

app.listen(port, () => {
    console.log(`App is running at http://localhost:${port}`);
});
