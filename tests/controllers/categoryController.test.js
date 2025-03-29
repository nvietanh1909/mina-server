const categoryController = require('../../controllers/categoryController');
const Category = require('../../models/categoryModel');

// Mock dependencies
jest.mock('../../models/categoryModel');

describe('Category Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {}
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
      Category.create.mockResolvedValue({
        _id: 'categoryId',
        ...categoryData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await categoryController.createCategory(req, res);

      expect(Category.create).toHaveBeenCalledWith(categoryData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'categoryId',
          name: categoryData.name,
          description: categoryData.description,
          icon: categoryData.icon,
          color: categoryData.color
        })
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
      Category.create.mockRejectedValue({
        code: 11000,
        keyPattern: { name: 1 }
      });

      await categoryController.createCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Category with this name already exists'
      });
    });

    test('should handle server error', async () => {
      req.body = {
        name: 'Test Category',
        description: 'Test Description'
      };

      // Mock Category.create to throw error
      Category.create.mockRejectedValue(new Error('Database error'));

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
          description: 'Description 1'
        },
        {
          _id: 'categoryId2',
          name: 'Category 2',
          description: 'Description 2'
        }
      ];

      // Mock Category.find to return categories
      Category.find.mockResolvedValue(categories);

      await categoryController.getCategories(req, res);

      expect(Category.find).toHaveBeenCalled();
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
        description: 'Test Description'
      };

      // Mock Category.findById to return category
      Category.findById.mockResolvedValue(category);

      await categoryController.getCategoryById(req, res);

      expect(Category.findById).toHaveBeenCalledWith(categoryId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: category
      });
    });

    test('should handle category not found', async () => {
      req.params.id = 'nonExistentId';

      // Mock Category.findById to return null
      Category.findById.mockResolvedValue(null);

      await categoryController.getCategoryById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Category not found'
      });
    });

    test('should handle server error', async () => {
      req.params.id = 'categoryId';

      // Mock Category.findById to throw error
      Category.findById.mockRejectedValue(new Error('Database error'));

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
        updatedAt: new Date()
      };

      // Mock Category.findByIdAndUpdate to return updated category
      Category.findByIdAndUpdate.mockResolvedValue(updatedCategory);

      await categoryController.updateCategory(req, res);

      expect(Category.findByIdAndUpdate).toHaveBeenCalledWith(
        categoryId,
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

      // Mock Category.findByIdAndUpdate to return null
      Category.findByIdAndUpdate.mockResolvedValue(null);

      await categoryController.updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Category not found'
      });
    });

    test('should handle duplicate category name', async () => {
      req.params.id = 'categoryId';
      req.body = {
        name: 'Existing Category'
      };

      // Mock Category.findByIdAndUpdate to throw duplicate key error
      Category.findByIdAndUpdate.mockRejectedValue({
        code: 11000,
        keyPattern: { name: 1 }
      });

      await categoryController.updateCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Category with this name already exists'
      });
    });

    test('should handle server error', async () => {
      req.params.id = 'categoryId';
      req.body = {
        name: 'Updated Category'
      };

      // Mock Category.findByIdAndUpdate to throw error
      Category.findByIdAndUpdate.mockRejectedValue(new Error('Database error'));

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

      // Mock Category.findByIdAndDelete to return deleted category
      Category.findByIdAndDelete.mockResolvedValue({
        _id: categoryId,
        name: 'Deleted Category'
      });

      await categoryController.deleteCategory(req, res);

      expect(Category.findByIdAndDelete).toHaveBeenCalledWith(categoryId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Category deleted successfully'
      });
    });

    test('should handle category not found', async () => {
      req.params.id = 'nonExistentId';

      // Mock Category.findByIdAndDelete to return null
      Category.findByIdAndDelete.mockResolvedValue(null);

      await categoryController.deleteCategory(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Category not found'
      });
    });

    test('should handle server error', async () => {
      req.params.id = 'categoryId';

      // Mock Category.findByIdAndDelete to throw error
      Category.findByIdAndDelete.mockRejectedValue(new Error('Database error'));

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