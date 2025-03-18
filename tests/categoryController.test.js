const request = require('supertest');
const mongoose = require('mongoose');
const Category = require('../models/categoryModel');
const User = require('../models/userModel');
const app = require('./testServer');

require('dotenv').config();

jest.setTimeout(30000);

describe('Category Controller Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://your_mongodb_uri');
      await Category.deleteMany({});
      await User.deleteMany({});
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await Category.deleteMany({});
      await User.deleteMany({});
      await mongoose.connection.close();
    } catch (error) {
      console.error('Error cleaning up:', error);
    }
  });

  beforeEach(async () => {
    try {
      await Category.deleteMany({});
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

  describe('POST /api/categories', () => {
    it('should create a new category successfully', async () => {
      const categoryData = {
        name: 'Test Category',
        type: 'expense',
        icon: 'test-icon',
        color: '#FF0000'
      };

      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.data.category).toHaveProperty('name', categoryData.name);
      expect(response.body.data.category).toHaveProperty('type', categoryData.type);
      expect(response.body.data.category).toHaveProperty('icon', categoryData.icon);
      expect(response.body.data.category).toHaveProperty('color', categoryData.color);
      expect(response.body.data.category).toHaveProperty('userId', testUser._id.toString());
    });

    it('should not create category without authentication', async () => {
      const categoryData = {
        name: 'Test Category',
        type: 'expense',
        icon: 'test-icon',
        color: '#FF0000'
      };

      const response = await request(app)
        .post('/api/categories')
        .send(categoryData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Not authorized, no token');
    });

    it('should not create category with missing required fields', async () => {
      const categoryData = {
        name: 'Test Category'
        // Missing type, icon, and color
      };

      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Please provide all required fields');
    });
  });

  describe('GET /api/categories', () => {
    it('should get all categories for authenticated user', async () => {
      // Create some test categories
      await Category.create([
        {
          name: 'Category 1',
          type: 'expense',
          icon: 'icon1',
          color: '#FF0000',
          userId: testUser._id
        },
        {
          name: 'Category 2',
          type: 'income',
          icon: 'icon2',
          color: '#00FF00',
          userId: testUser._id
        }
      ]);

      const response = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.categories).toHaveLength(2);
      expect(response.body.data.categories[0]).toHaveProperty('name', 'Category 1');
      expect(response.body.data.categories[1]).toHaveProperty('name', 'Category 2');
    });

    it('should not get categories without authentication', async () => {
      const response = await request(app)
        .get('/api/categories');

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Not authorized, no token');
    });
  });

  describe('PATCH /api/categories/:id', () => {
    it('should update category successfully', async () => {
      // Create a test category
      const category = await Category.create({
        name: 'Original Category',
        type: 'expense',
        icon: 'original-icon',
        color: '#FF0000',
        userId: testUser._id
      });

      const updateData = {
        name: 'Updated Category',
        color: '#00FF00'
      };

      const response = await request(app)
        .patch(`/api/categories/${category._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.category).toHaveProperty('name', updateData.name);
      expect(response.body.data.category).toHaveProperty('color', updateData.color);
      expect(response.body.data.category).toHaveProperty('type', category.type);
      expect(response.body.data.category).toHaveProperty('icon', category.icon);
    });

    it('should not update category without authentication', async () => {
      const category = await Category.create({
        name: 'Test Category',
        type: 'expense',
        icon: 'test-icon',
        color: '#FF0000',
        userId: testUser._id
      });

      const updateData = {
        name: 'Updated Category'
      };

      const response = await request(app)
        .patch(`/api/categories/${category._id}`)
        .send(updateData);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Not authorized, no token');
    });

    it('should not update non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = {
        name: 'Updated Category'
      };

      const response = await request(app)
        .patch(`/api/categories/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Category not found');
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should delete category successfully', async () => {
      const category = await Category.create({
        name: 'Test Category',
        type: 'expense',
        icon: 'test-icon',
        color: '#FF0000',
        userId: testUser._id
      });

      const response = await request(app)
        .delete(`/api/categories/${category._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Category deleted successfully');

      // Verify category is deleted
      const deletedCategory = await Category.findById(category._id);
      expect(deletedCategory).toBeNull();
    });

    it('should not delete category without authentication', async () => {
      const category = await Category.create({
        name: 'Test Category',
        type: 'expense',
        icon: 'test-icon',
        color: '#FF0000',
        userId: testUser._id
      });

      const response = await request(app)
        .delete(`/api/categories/${category._id}`);

      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Not authorized, no token');
    });

    it('should not delete non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/categories/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Category not found');
    });
  });
}); 