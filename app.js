const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });

// Connect to MySQL database
const connection = mysql.createConnection({
    host: 'twu9wy.h.filess.io',
    user: 'C237MusicList_likeflower',
    password: '8217794670d362b6c62f534935f47eb4ffedc331',
    database: 'C237MusicList_likeflower'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set view engine to EJS
app.set('view engine', 'ejs');

// Enable static files (e.g. uploaded images)
app.use(express.static('public'));

// Enable form data parsing
app.use(express.urlencoded({ extended: false }));

// Session middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));

// Flash messages middleware
app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is an admin
const checkAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/musiclist');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, role } = req.body;

    if (!username || !email || !password || !address || !role) {
        return res.status(400).send('All fields are required.');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

app.get('/register', (req, res) => {
  const formData = req.session.formData || {};
  req.session.formData = null; // Clear after using

  res.render('register', {
    messages: req.flash('error'),
    formData: formData
  });
});

app.post('/register', (req, res) => {
  const { username, email, password, address, role } = req.body;

  if (!username || !email || !password || !address || !role) {
    req.flash('error', 'All fields are required.');
    req.session.formData = req.body;
    return res.redirect('/register');
  }

  if (password.length < 6) {
    req.flash('error', 'Password should be at least 6 or more characters long');
    req.session.formData = req.body;
    return res.redirect('/register');
  }

  // Insert user into database with hashed password
  const sql = `INSERT INTO users (username, email, password, address, role) VALUES (?, ?, SHA1(?), ?, ?)`;
  const values = [username, email, password, address, role];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error(err);
      req.flash('error', 'Error registering user. Please try again.');
      req.session.formData = req.body;
      return res.redirect('/register');
    }

    req.session.formData = null; // Clear form data on success
    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/login');
  });
});

// Login page
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// Login submission
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// User dashboard
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

// Admin dashboard
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// music_id in connection.query( sql , [music_id], (error, results) has 3 dots at the m
app.get('/musicpage', (req,res) => {
    const sql = 'SELECT * FROM music_list';
    // Fetch data from MySQL
    connection.query( sql , (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving music list');
        }
        // Render HTML page with data
        res.render('musicpage', {music_list: results});
    });
});

app.get('/addmusic', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addmusic', {user: req.session.user } ); 
});

app.post('/addmusic', upload.single('image'),  (req, res) => {
    // Extract music data from the request body
    const { title, artist, genre, language, link } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO music_list (title, artist, genre, language, image, link) VALUES (?, ?, ?, ?, ?, ?)';
    // Insert the new music into the database
    connection.query(sql , [title, artist, genre, language, image, link], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding music:", error);
            res.status(500).send('Error adding music');
        } else {
            // Send a success response
            res.redirect('/');
        }
    });
});

//delete confirmation page
app.get('/deletemusic/:id/confirm', checkAuthenticated, checkAdmin, (req, res) => {
    const music_id = req.params.id;
    const sql = 'SELECT * FROM music WHERE music_id = ?';
    connection.query(sql, [music_id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).send('Music not found');
        }
        res.render('delete', { music: results[0] }); 
    });
});

app.get('/updatemusic/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const music_id = req.params.id;
    const sql = 'SELECT * FROM music_list WHERE music_id = ?';
    connection.query( sql , [music_id], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving music by ID');
        }

        if (results.length > 0) {
            res.render('updatemusic', {music: results[0]});
        } else {
            res.status(404).send('Product not found');
        }
    })
});

// Delete music by ID
app.get('/deletemusic/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const music_id = req.params.id;

    connection.query('DELETE FROM music_list WHERE music_id = ?', [music_id], (err, result) => {
        if (err) {
            console.error('Error deleting music:', err);
            res.status(500).send('Error deleting music');
        } else {
            res.redirect('/musicpage');
        }
    });
});

app.post('/updatemusic/:id', (req, res) => {
    const music_id = req.params.id;
    const { title, artist, genre, language, link } = req.body;
    let image  = req.body.currentImage; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    }

    const sql = 'UPDATE music_list SET title = ?, artist = ?, genre = ?, language = ?, image = ?, link = ? WHERE music_id = ?';

    connection.query( sql, [title, artist, genre, language, image, link, music_id], (error, results) => {
        if (error) {
            console.error('Error updating music:', error);
            return res.status(500).send('Error updating music');
        } else {
            res.redirect('/musicpage');
        }
    });
});

app.get('/userlist', (req,res) => {
    const sql = 'SELECT * FROM user';
    // Fetch data from MySQL
    connection.query( sql , (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving user list');
        }
        // Render HTML page with data
        res.render('userlist', {user: results});
    });
});
 

// DO NOT WRITE ANY CODE BELOW THIS LINE

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
