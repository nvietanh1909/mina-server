const request = require('supertest');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const Wallet = require('../models/walletModel');
const app = require('./testServer');

require('dotenv').config();

// Increase timeout for all tests
jest.setTimeout(30000);

describe('User Controller Tests', () => {
  beforeAll(async () => {
    try {
      // Connect to MongoDB
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://your_mongodb_uri');
      // Clear database before all tests
      await User.deleteMany({});
      await Wallet.deleteMany({});
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up and close connection
      await User.deleteMany({});
      await Wallet.deleteMany({});
      await mongoose.connection.close();
    } catch (error) {
      console.error('Error cleaning up:', error);
    }
  });

  beforeEach(async () => {
    try {
      // Clear database before each test
      await User.deleteMany({});
      await Wallet.deleteMany({});
    } catch (error) {
      console.error('Error clearing database:', error);
    }
  });

  describe('POST /api/users/signup', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/users/signup')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email', userData.email);
      expect(response.body.data.user).toHaveProperty('name', userData.name);
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data).toHaveProperty('token');
    });

    it('should not register user with existing email', async () => {
      // First create a user
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      await User.create(userData);

      // Try to register with same email
      const response = await request(app)
        .post('/api/users/signup')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Email is already in use');
    });

    it('should not register user with missing required fields', async () => {
      const userData = {
        email: 'test@example.com'
        // Missing password and name
      };

      const response = await request(app)
        .post('/api/users/signup')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Please provide email, password and name');
    });
  });
}); 