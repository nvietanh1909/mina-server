const express = require('express');
const cors = require('cors');
const userRoutes = require('../routes/userRoutes');
const walletRoutes = require('../routes/walletRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/wallets', walletRoutes);

module.exports = app; 