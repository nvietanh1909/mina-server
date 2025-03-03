const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/mongo-config');
const cors = require('cors');

// Import routes
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const walletRoutes = require('./routes/walletRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const otpRoutes = require('./routes/otpRoutes');
const billScanRoutes = require('./routes/billScanRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Thêm middleware cors
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Connect to MongoDB
connectDB();

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/bills', billScanRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('Welcome to Mina API');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});