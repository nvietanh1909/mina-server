const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const User = require('../models/userModel');

test('Tạo người dùng mới', async (t) => {
  const userData = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'securePassword123'
  };

  const user = await User.create(userData);

  assert.strictEqual(user.name);
  assert.strictEqual(user.email);
  assert.strictEqual(user.password);
});

test('Không tạo được user với email không hợp lệ', async (t) => {
  const userData = {
    name: 'Invalid User',
    email: 'invalid-email',
    password: 'password123'
  };

  await assert.rejects(async () => {
    await User.create(userData);
  }, (err) => {
    assert(err instanceof mongoose.Error.ValidationError);
    return true;
  });
});