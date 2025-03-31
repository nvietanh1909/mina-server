const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Wallet',
  },
  amount: {
    type: Number,
    required: true,
  },
  notes: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    required: true,
    default: '💰'
  },
  date: {
    type: Date,
    default: Date.now,
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true,
  },
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
