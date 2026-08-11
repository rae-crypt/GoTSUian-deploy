const express = require('express');
const http = require('http');
const cors = require('cors');
const db = require('./config/db');
const { initSocket } = require('./socket');
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const adminRoutes = require('./routes/adminRoutes');
const profileRoutes = require('./routes/profileRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const otpRoutes = require('./routes/otpRoutes');
const messageRoutes = require('./routes/messageRoutes');


const app = express();
const PORT = 3000;

// Allow the frontend (served separately by Live Server, a different origin)
// to call this API. Without this, the browser blocks the preflight request
// before it ever reaches the routes below.
app.use(cors());

// Middleware para ma-parse yung JSON na papasok sa requests
app.use(express.json());

app.get('/', (req, res) => {
  res.send('GoTSUian backend is running! 🚗');
});

// Auth routes
app.use('/api/auth', authRoutes);

// Ride booking routes
app.use('/api/rides', rideRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Profile routes
app.use('/api/profile', profileRoutes);

// Review routes
app.use('/api/reviews', reviewRoutes);

// Complaint / violation routes
app.use('/api/complaints', complaintRoutes);

// Registration email OTP routes
app.use('/api/otp', otpRoutes);

// Per-ride chat between a passenger and their assigned driver
app.use('/api/messages', messageRoutes);

// Catches multer errors (bad file type, over the size limit) and anything
// else passed to next(err) — without this, Express's default HTML error
// page would reach the frontend where it expects JSON (the exact bug seen
// earlier with the complaints routes before nodemon was set up).
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Request failed' });
  }
  next();
});

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});