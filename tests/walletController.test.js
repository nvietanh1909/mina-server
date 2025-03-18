const request = require('supertest');
const mongoose = require('mongoose');
const Wallet = require('../models/walletModel');
const User = require('../models/userModel');
const app = require('./testServer');

require('dotenv').config();

jest.setTimeout(30000);

describe('Wallet Controller Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://your_mongodb_uri');
      await Wallet.deleteMany({});
      await User.deleteMany({});
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await Wallet.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    } catch (error) {
      console.error('Error cleaning up:', error);
    }
  });

  beforeEach(async () => {
    try {
      await Wallet.deleteMany({});
      await User.deleteMany({});

      // Create test user and get auth token
      testUser = await User.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

      const loginResponse = await request(app)
        .post('/api/users/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      authToken = loginResponse.body.data.token;
    } catch (error) {
      console.error('Error setting up test:', error);
    }
  });

  describe('POST /api/wallets', () => {
    it('should create a new wallet successfully', async () => {
      const walletData = {
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(walletData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.wallet).toHaveProperty('name', walletData.name);
      expect(response.body.data.wallet).toHaveProperty('description', walletData.description);
      expect(response.body.data.wallet).toHaveProperty('currency', walletData.currency);
      expect(response.body.data.wallet).toHaveProperty('userId', testUser._id.toString());
      expect(response.body.data.wallet).toHaveProperty('isDefault', true); // First wallet should be default
    });

    it('should not create wallet without authentication', async () => {
      const walletData = {
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'USD'
      };

      const response = await request(app)
        .post('/api/wallets')
        .send(walletData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Không tìm thấy token xác thực');
    });

    it('should not create wallet with missing required fields', async () => {
      const walletData = {
        name: 'Test Wallet'
        // Missing currency
      };

      const response = await request(app)
        .post('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(walletData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  describe('GET /api/wallets', () => {
    it('should get all wallets for authenticated user', async () => {
      // Create some test wallets
      await Wallet.create([
        {
          name: 'Wallet 1',
          description: 'Description 1',
          currency: 'USD',
          userId: testUser._id,
          isDefault: true
        },
        {
          name: 'Wallet 2',
          description: 'Description 2',
          currency: 'EUR',
          userId: testUser._id,
          isDefault: false
        }
      ]);

      const response = await request(app)
        .get('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.wallets).toHaveLength(2);
      expect(response.body.data.wallets[0]).toHaveProperty('name', 'Wallet 1');
      expect(response.body.data.wallets[1]).toHaveProperty('name', 'Wallet 2');
    });

    it('should not get wallets without authentication', async () => {
      const response = await request(app)
        .get('/api/wallets');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Không tìm thấy token xác thực');
    });
  });

  describe('PATCH /api/wallets/:id', () => {
    it('should update wallet successfully', async () => {
      // Create a test wallet
      const wallet = await Wallet.create({
        name: 'Original Wallet',
        description: 'Original Description',
        currency: 'USD',
        userId: testUser._id,
        isDefault: false
      });

      const updateData = {
        name: 'Updated Wallet',
        description: 'Updated Description'
      };

      const response = await request(app)
        .patch(`/api/wallets/${wallet._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.wallet).toHaveProperty('name', updateData.name);
      expect(response.body.data.wallet).toHaveProperty('description', updateData.description);
    });

    it('should not update wallet without authentication', async () => {
      const wallet = await Wallet.create({
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'USD',
        userId: testUser._id,
        isDefault: false
      });

      const updateData = {
        name: 'Updated Wallet'
      };

      const response = await request(app)
        .patch(`/api/wallets/${wallet._id}`)
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Không tìm thấy token xác thực');
    });

    it('should not update non-existent wallet', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = {
        name: 'Updated Wallet'
      };

      const response = await request(app)
        .patch(`/api/wallets/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Không tìm thấy ví');
    });
  });

  describe('DELETE /api/wallets/:id', () => {
    it('should delete wallet successfully', async () => {
      const wallet = await Wallet.create({
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'USD',
        userId: testUser._id,
        isDefault: false
      });

      const response = await request(app)
        .delete(`/api/wallets/${wallet._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Xóa ví thành công');

      // Verify wallet is deleted
      const deletedWallet = await Wallet.findById(wallet._id);
      expect(deletedWallet).toBeNull();
    });

    it('should not delete wallet without authentication', async () => {
      const wallet = await Wallet.create({
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'USD',
        userId: testUser._id,
        isDefault: false
      });

      const response = await request(app)
        .delete(`/api/wallets/${wallet._id}`);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Không tìm thấy token xác thực');
    });

    it('should not delete non-existent wallet', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/wallets/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Không tìm thấy ví');
    });

    it('should not delete default wallet', async () => {
      const wallet = await Wallet.create({
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'USD',
        userId: testUser._id,
        isDefault: true
      });

      const response = await request(app)
        .delete(`/api/wallets/${wallet._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Không thể xóa ví mặc định');
    });
  });
}); 