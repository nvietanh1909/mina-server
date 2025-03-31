const mongoose = require('mongoose');
const transactionController = require('../../controllers/transactionController');
const Transaction = require('../../models/transactionModel');
const Category = require('../../models/categoryModel');
const Wallet = require('../../models/walletModel');

// Mock mongoose
jest.mock('mongoose', () => {
  const mockSchema = jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnThis(),
    pre: jest.fn().mockReturnThis(),
    methods: {},
    statics: {}
  }));

  const mockSession = {
    startTransaction: jest.fn().mockResolvedValue(),
    commitTransaction: jest.fn().mockResolvedValue(),
    abortTransaction: jest.fn().mockResolvedValue(),
    endSession: jest.fn().mockResolvedValue()
  };

  const mockMongoose = {
    Schema: mockSchema,
    Schema: {
      Types: {
        ObjectId: jest.fn()
      }
    },
    model: jest.fn(),
    connect: jest.fn(),
    startSession: jest.fn().mockResolvedValue(mockSession)
  };

  // Add Schema constructor to mockMongoose
  mockMongoose.Schema = mockSchema;
  mockMongoose.Schema.Types = {
    ObjectId: jest.fn()
  };

  return mockMongoose;
});

// Mock dependencies
jest.mock('../../models/transactionModel', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
  aggregate: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../../models/walletModel', () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

jest.mock('../../models/categoryModel', () => ({
  findOne: jest.fn()
}));

jest.mock('../../controllers/notificationController', () => ({
  createNotification: jest.fn()
}));

describe('TransactionController', () => {
  let req;
  let res;
  let mockSession;

  beforeEach(() => {
    req = {
      body: {},
      user: { id: 'mockUserId' },
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    };
    mongoose.startSession.mockResolvedValue(mockSession);
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      req.user = { id: 'userId' };
      req.body = {
        amount: 1000,
        type: 'expense',
        category: 'Food',
        notes: 'Test transaction',
        date: new Date(),
        icon: '🍔',
        walletId: 'walletId'
      };
    });

    it('should create a transaction successfully', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        balance: 1000,
        userId: 'userId'
      };

      const mockTransaction = {
        _id: 'transactionId',
        userId: 'userId',
        walletId: 'walletId',
        amount: 500,
        type: 'income',
        category: 'Salary',
        notes: 'Monthly salary',
        date: new Date()
      };

      req.body = {
        amount: 500,
        type: 'income',
        category: 'Salary',
        notes: 'Monthly salary',
        walletId: 'walletId'
      };

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet)
      });
      Transaction.create.mockResolvedValue([mockTransaction]);

      // Act
      await transactionController.createTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
        mockWallet._id,
        { $inc: { balance: 500 } },
        { session: expect.any(Object) }
      );
    });

    it('should create an expense transaction successfully when sufficient balance', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        balance: 1000,
        userId: 'userId'
      };

      const mockTransaction = {
        _id: 'transactionId',
        userId: 'userId',
        walletId: 'walletId',
        amount: 500,
        type: 'expense',
        category: 'Food',
        notes: 'Lunch',
        date: new Date()
      };

      req.body = {
        amount: 500,
        type: 'expense',
        category: 'Food',
        notes: 'Lunch',
        walletId: 'walletId'
      };

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet)
      });
      Transaction.create.mockResolvedValue([mockTransaction]);

      // Act
      await transactionController.createTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
        mockWallet._id,
        { $inc: { balance: -500 } },
        { session: expect.any(Object) }
      );
    });

    it('should return error when insufficient balance for expense', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        balance: 100,
        userId: 'userId'
      };

      req.body = {
        amount: 500,
        type: 'expense',
        category: 'Food',
        notes: 'Lunch',
        walletId: 'walletId'
      };

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet)
      });

      // Act
      await transactionController.createTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Số dư trong ví không đủ'
      });
    });

    it('should return error when wallet not found', async () => {
      // Arrange
      req.body = {
        amount: 500,
        type: 'income',
        category: 'Salary',
        notes: 'Monthly salary',
        walletId: 'walletId'
      };

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null)
      });

      // Act
      await transactionController.createTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy ví'
      });
    });
  });

  describe('getTransactions', () => {
    it('should get transactions with pagination', async () => {
      // Arrange
      const mockTransactions = [
        { _id: 'trans1', amount: 100, type: 'income' },
        { _id: 'trans2', amount: 200, type: 'expense' }
      ];

      Transaction.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockTransactions)
      });

      Transaction.countDocuments = jest.fn().mockResolvedValue(2);

      req.query = {
        page: 1,
        limit: 10
      };

      // Act
      await transactionController.getTransactions(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transactions: mockTransactions,
          pagination: {
            total: 2,
            page: 1,
            pages: 1
          }
        }
      });
    });

    it('should filter transactions by type and category', async () => {
      // Arrange
      const mockTransactions = [
        { _id: 'trans1', amount: 100, type: 'income', category: 'Salary' }
      ];

      Transaction.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockTransactions)
      });

      Transaction.countDocuments = jest.fn().mockResolvedValue(1);

      req.query = {
        type: 'income',
        category: 'Salary'
      };

      // Act
      await transactionController.getTransactions(req, res);

      // Assert
      expect(Transaction.find).toHaveBeenCalledWith({
        userId: 'mockUserId',
        type: 'income',
        category: 'Salary'
      });
    });

    it('should filter transactions by date range', async () => {
      // Arrange
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      const mockTransactions = [
        { _id: 'trans1', amount: 100, type: 'income', date: new Date(startDate) }
      ];

      Transaction.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockTransactions)
      });

      Transaction.countDocuments = jest.fn().mockResolvedValue(1);

      req.query = { startDate, endDate };

      // Act
      await transactionController.getTransactions(req, res);

      // Assert
      expect(Transaction.find).toHaveBeenCalledWith({
        userId: 'mockUserId',
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      });
    });
  });

  describe('getTransaction', () => {
    it('should get a single transaction successfully', async () => {
      // Arrange
      const mockTransaction = {
        _id: 'transactionId',
        amount: 100,
        type: 'income'
      };

      Transaction.findOne = jest.fn().mockResolvedValue(mockTransaction);
      req.params.id = 'transactionId';

      // Act
      await transactionController.getTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transaction: mockTransaction
        }
      });
    });

    it('should return error when transaction not found', async () => {
      // Arrange
      Transaction.findOne = jest.fn().mockResolvedValue(null);
      req.params.id = 'nonexistentId';

      // Act
      await transactionController.getTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy giao dịch'
      });
    });
  });

  describe('updateTransaction', () => {
    beforeEach(() => {
      req.params.id = 'transactionId';
      req.body = {
        amount: 1000,
        type: 'expense',
        category: 'Food',
        notes: 'Updated transaction'
      };
      req.user = { id: 'userId' };
    });

    it('should update transaction successfully', async () => {
      // Arrange
      const mockTransaction = {
        _id: 'transactionId',
        userId: 'mockUserId',
        amount: 1000,
        type: 'income',
        category: 'Salary',
        notes: 'Updated transaction',
        date: new Date()
      };

      req.params.id = 'transactionId';
      req.body = {
        amount: 1000,
        type: 'income',
        category: 'Salary',
        notes: 'Updated transaction'
      };

      Category.findOne.mockResolvedValue({ name: 'Salary', isDefault: true });
      Transaction.findOneAndUpdate.mockResolvedValue(mockTransaction);

      // Act
      await transactionController.updateTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transaction: mockTransaction
        }
      });
    });

    it('should return error when transaction not found for update', async () => {
      // Arrange
      req.params.id = 'nonExistentId';
      req.body = {
        amount: 1000,
        type: 'income',
        category: 'Salary'
      };

      Category.findOne.mockResolvedValue({ name: 'Salary', isDefault: true });
      Transaction.findOneAndUpdate.mockResolvedValue(null);

      // Act
      await transactionController.updateTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy giao dịch'
      });
    });
  });

  describe('deleteTransaction', () => {
    beforeEach(() => {
      req.params.id = 'transactionId';
      req.user = { id: 'userId' };
    });

    it('should delete transaction successfully', async () => {
      // Arrange
      const mockTransaction = {
        _id: 'transactionId',
        userId: 'mockUserId',
        type: 'income',
        amount: 1000,
        deleteOne: jest.fn().mockResolvedValue()
      };

      const mockWallet = {
        _id: 'walletId',
        userId: 'mockUserId',
        balance: 2000
      };

      Transaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockTransaction)
      });

      Wallet.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(mockWallet)
      });

      Wallet.findByIdAndUpdate.mockReturnValue({
        session: jest.fn().mockResolvedValue({ balance: 1000 })
      });

      // Act
      await transactionController.deleteTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Xóa giao dịch thành công'
      });
    });

    it('should return error when transaction not found for deletion', async () => {
      // Arrange
      Transaction.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(null)
      });

      // Act
      await transactionController.deleteTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy giao dịch'
      });
    });
  });
}); 