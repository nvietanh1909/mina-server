const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Transaction = require('../models/transactionModel');

test('Tạo giao dịch thu nhập', async (t) => {
  const transactionData = {
    userId: new mongoose.Types.ObjectId(),
    walletId: new mongoose.Types.ObjectId(),
    amount: 5000,
    type: 'income',
    category: 'salary',
    date: new Date(),
    notes: 'Lương tháng'
  };

  const transaction = await Transaction.create(transactionData);

  assert.strictEqual(transaction.amount, 5000);
  assert.strictEqual(transaction.type, 'income');
});

test('Không tạo được giao dịch với số tiền âm', async (t) => {
  const transactionData = {
    userId: new mongoose.Types.ObjectId(),
    walletId: new mongoose.Types.ObjectId(),
    amount: -1000,
    type: 'expense',
    category: 'shopping'
  };

  await assert.rejects(async () => {
    await Transaction.create(transactionData);
  }, (err) => {
    assert(err instanceof mongoose.Error.ValidationError);
    return true;
  });
});