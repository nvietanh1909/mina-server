const categoryController = require('../../controllers/categoryController');
const Category = require('../../models/categoryModel');

// Mock dependencies
jest.mock('../../models/categoryModel', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn()
}));

describe('Category Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 'mockUserId' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('createCategory', () => {
    test('should create category successfully', async () => {
      const categoryData = {
        name: 'Test Category',
        description: 'Test Description',
        icon: 'test-icon',
        color: '#FF0000'
      };
      req.body = categoryData;

      // Mock Category.create to return new category
      const mockCategory = {
        _id: 'categoryId',
        ...categoryData,
        userId: 'mockUserId',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      Category.create.mockResolvedValue(mockCategory);

      await categoryController.createCategory(req, res);

      expect(Category.create).toHaveBeenCalledWith({
        ...categoryData,
        userId: 'mockUserId',
        isDefault: false
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCategory
      });
    });

    test('should handle missing required fields', async () => {
      req.body = {
        description: 'Test Description'
      };

      await categoryController.createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Name is required'
      });

      expect(Category.create).not.toHaveBeenCalled();
    });

    test('should handle duplicate category name', async () => {
      req.body = {
        name: 'Test Category',
        description: 'Test Description'
      };

      // Mock Category.create to throw duplicate key error
      const duplicateError = new Error('Duplicate key error');
      duplicateError.code = 11000;
      duplicateError.keyPattern = { name: 1 };
      Category.create.mockRejectedValue(duplicateError);

      await categoryController.createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Đã tồn tại category với tên này'
      });
    });

    test('should handle server error', async () => {
      req.body = {
        name: 'Test Category',
        description: 'Test Description'
      };

      // Mock Category.create to throw error
      const dbError = new Error('Database error');
      Category.create.mockRejectedValue(dbError);

      await categoryController.createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to create category',
        error: 'Database error'
      });
    });
  });

  describe('getCategories', () => {
    test('should get all categories successfully', async () => {
      const categories = [
        {
          _id: 'categoryId1',
          name: 'Category 1',
          description: 'Description 1',
          userId: 'mockUserId'
        },
        {
          _id: 'categoryId2',
          name: 'Category 2',
          description: 'Description 2',
          userId: 'mockUserId'
        }
      ];

      // Mock Category.find to return categories
      Category.find.mockResolvedValue(categories);

      await categoryController.getCategories(req, res);

      expect(Category.find).toHaveBeenCalledWith({
        $or: [
          { isDefault: true },
          { userId: 'mockUserId' }
        ]
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: categories
      });
    });

    test('should handle server error', async () => {
      // Mock Category.find to throw error
      Category.find.mockRejectedValue(new Error('Database error'));

      await categoryController.getCategories(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get categories',
        error: 'Database error'
      });
    });
  });

  describe('getCategoryById', () => {
    test('should get category by id successfully', async () => {
      const categoryId = 'categoryId';
      req.params.id = categoryId;

      const category = {
        _id: categoryId,
        name: 'Test Category',
        description: 'Test Description',
        userId: 'mockUserId'
      };

      // Mock Category.findOne to return category
      Category.findOne.mockResolvedValue(category);

      await categoryController.getCategoryById(req, res);

      expect(Category.findOne).toHaveBeenCalledWith({
        $or: [
          { isDefault: true },
          { userId: 'mockUserId' }
        ],
        _id: categoryId
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: category
      });
    });

    test('should handle category not found', async () => {
      req.params.id = 'nonExistentId';

      // Mock Category.findOne to return null
      Category.findOne.mockResolvedValue(null);

      await categoryController.getCategoryById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Category not found or cannot be updated'
      });
    });

    test('should handle server error', async () => {
      req.params.id = 'categoryId';

      // Mock Category.findOne to throw error
      Category.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.getCategoryById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get category',
        error: 'Database error'
      });
    });
  });

  describe('updateCategory', () => {
    test('should update category successfully', async () => {
      const categoryId = 'categoryId';
      req.params.id = categoryId;
      req.body = {
        name: 'Updated Category',
        description: 'Updated Description'
      };

      const updatedCategory = {
        _id: categoryId,
        ...req.body,
        userId: 'mockUserId',
        isDefault: false,
        updatedAt: new Date()
      };

      // Mock Category.findOne and findByIdAndUpdate
      Category.findOne.mockResolvedValue(updatedCategory);
      Category.findByIdAndUpdate.mockResolvedValue(updatedCategory);

      await categoryController.updateCategory(req, res);

      expect(Category.findOne).toHaveBeenCalledWith({
        $or: [
          { isDefault: true },
          { userId: 'mockUserId' }
        ],
        _id: categoryId
      });
      expect(Category.findByIdAndUpdate).toHaveBeenCalledWith(
        { _id: categoryId, userId: 'mockUserId', isDefault: false },
        req.body,
        { new: true, runValidators: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedCategory
      });
    });

    test('should handle category not found', async () => {
      req.params.id = 'nonExistentId';
      req.body = {
        name: 'Updated Category'
      };

      // Mock Category.findOne to return null
      Category.findOne.mockResolvedValue(null);

      await categoryController.updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Category not found or cannot be updated'
      });
    });

    test('should handle duplicate category name', async () => {
      req.params.id = 'categoryId';
      req.body = {
        name: 'Existing Category'
      };

      // Mock Category.findOne to return category
      Category.findOne.mockResolvedValue({
        _id: 'categoryId',
        name: 'Existing Category',
        userId: 'mockUserId',
        isDefault: false
      });

      // Mock Category.findByIdAndUpdate to throw duplicate key error
      Category.findByIdAndUpdate.mockRejectedValue({
        code: 11000,
        keyPattern: { name: 1 }
      });

      await categoryController.updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Đã tồn tại category với tên này'
      });
    });

    test('should handle server error', async () => {
      req.params.id = 'categoryId';
      req.body = {
        name: 'Updated Category'
      };

      // Mock Category.findOne to throw error
      Category.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to update category',
        error: 'Database error'
      });
    });
  });

  describe('deleteCategory', () => {
    test('should delete category successfully', async () => {
      const categoryId = 'categoryId';
      req.params.id = categoryId;

      // Mock Category.findOne and findByIdAndDelete
      Category.findOne.mockResolvedValue({
        _id: categoryId,
        name: 'Deleted Category',
        userId: 'mockUserId',
        isDefault: false
      });
      Category.findByIdAndDelete.mockResolvedValue({
        _id: categoryId,
        name: 'Deleted Category',
        userId: 'mockUserId',
        isDefault: false
      });

      await categoryController.deleteCategory(req, res);

      expect(Category.findOne).toHaveBeenCalledWith({
        $or: [
          { isDefault: true },
          { userId: 'mockUserId' }
        ],
        _id: categoryId
      });
      expect(Category.findByIdAndDelete).toHaveBeenCalledWith({
        _id: categoryId,
        userId: 'mockUserId',
        isDefault: false
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Category deleted successfully'
      });
    });

    test('should handle category not found', async () => {
      req.params.id = 'nonExistentId';

      // Mock Category.findOne to return null
      Category.findOne.mockResolvedValue(null);

      await categoryController.deleteCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Category not found or cannot be deleted'
      });
    });

    test('should handle server error', async () => {
      req.params.id = 'categoryId';

      // Mock Category.findOne to throw error
      Category.findOne.mockRejectedValue(new Error('Database error'));

      await categoryController.deleteCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to delete category',
        error: 'Database error'
      });
    });
  });
}); 