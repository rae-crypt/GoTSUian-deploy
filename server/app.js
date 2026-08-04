const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const adminRoutes = require('./routes/adminRoutes');

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


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});