const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Wallet = require('../models/walletModel');

test('Tạo ví mới', async (t) => {
  const walletData = {
    userId: new mongoose.Types.ObjectId(),
    name: 'Ví chính',
    balance: 1000,
    currency: 'VND',
    monthlyLimit: 5000
  };

  const wallet = await Wallet.create(walletData);

  assert.strictEqual(wallet.name, 'Ví chính');
  assert.strictEqual(wallet.balance, 1000);
});

test('Không tạo được ví với số dư âm', async (t) => {
  const walletData = {
    userId: new mongoose.Types.ObjectId(),
    name: 'Ví lỗi',
    balance: -500,
    currency: 'VND'
  };

  await assert.rejects(async () => {
    await Wallet.create(walletData);
  }, (err) => {
    assert(err instanceof mongoose.Error.ValidationError);
    return true;
  });
});