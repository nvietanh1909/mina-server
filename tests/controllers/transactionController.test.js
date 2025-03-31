const mongoose = require('mongoose');
const transactionController = require('../../controllers/transactionController');
const Transaction = require('../../models/transactionModel');
const Wallet = require('../../models/walletModel');

// Mock mongoose
jest.mock('mongoose', () => {
  const mockMongoose = {
    Schema: function() {
      return {
        pre: jest.fn(),
        index: jest.fn()
      };
    },
    Schema: {
      Types: {
        ObjectId: String
      }
    },
    model: jest.fn(),
    connect: jest.fn(),
    connection: {
      close: jest.fn()
    },
    startSession: jest.fn().mockReturnValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn()
    })
  };
  return mockMongoose;
});

// Mock các models
jest.mock('../../models/transactionModel', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  create: jest.fn(),
  aggregate: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../../models/walletModel', () => ({
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn()
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
      // Reset mocks
      jest.clearAllMocks();
    });

    it('should create an income transaction successfully', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        balance: 1000
      };

      Wallet.findOne.mockImplementation(() => ({
        session: () => mockWallet
      }));

      const mockTransaction = [{
        _id: 'transactionId',
        amount: 500,
        type: 'income',
        category: 'Salary',
        notes: 'Monthly salary'
      }];

      Transaction.create.mockResolvedValue(mockTransaction);
      Wallet.findByIdAndUpdate.mockResolvedValue(mockWallet);

      req.body = {
        amount: 500,
        type: 'income',
        category: 'Salary',
        notes: 'Monthly salary'
      };

      // Act
      await transactionController.createTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transaction: mockTransaction[0]
        }
      });
      expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
        mockWallet._id,
        { $inc: { balance: 500 } },
        { session: mockSession }
      );
    });

    it('should create an expense transaction successfully when sufficient balance', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        balance: 1000
      };

      Wallet.findOne.mockImplementation(() => ({
        session: () => mockWallet
      }));

      const mockTransaction = [{
        _id: 'transactionId',
        amount: 500,
        type: 'expense',
        category: 'Food',
        notes: 'Lunch'
      }];

      Transaction.create.mockResolvedValue(mockTransaction);
      Wallet.findByIdAndUpdate.mockResolvedValue(mockWallet);

      req.body = {
        amount: 500,
        type: 'expense',
        category: 'Food',
        notes: 'Lunch'
      };

      // Act
      await transactionController.createTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
        mockWallet._id,
        { $inc: { balance: -500 } },
        { session: mockSession }
      );
    });

    it('should return error when insufficient balance for expense', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        balance: 300
      };

      Wallet.findOne.mockImplementation(() => ({
        session: () => mockWallet
      }));

      req.body = {
        amount: 500,
        type: 'expense',
        category: 'Food',
        notes: 'Lunch'
      };

      // Act
      await transactionController.createTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Số dư trong ví không đủ'
      });
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should return error when wallet not found', async () => {
      // Arrange
      Wallet.findOne.mockImplementation(() => ({
        session: () => null
      }));

      req.body = {
        amount: 500,
        type: 'expense',
        category: 'Food'
      };

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
    it('should update transaction successfully', async () => {
      // Arrange
      const mockUpdatedTransaction = {
        _id: 'transactionId',
        amount: 200,
        type: 'expense',
        category: 'Food',
        notes: 'Updated lunch'
      };

      Transaction.findOneAndUpdate = jest.fn().mockResolvedValue(mockUpdatedTransaction);

      req.params.id = 'transactionId';
      req.body = {
        amount: 200,
        type: 'expense',
        category: 'Food',
        notes: 'Updated lunch'
      };

      // Act
      await transactionController.updateTransaction(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          transaction: mockUpdatedTransaction
        }
      });
    });

    it('should return error when transaction not found for update', async () => {
      // Arrange
      Transaction.findOneAndUpdate = jest.fn().mockResolvedValue(null);
      req.params.id = 'nonexistentId';

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
    it('should delete transaction successfully', async () => {
      // Arrange
      const mockTransaction = {
        _id: 'transactionId',
        amount: 100
      };

      Transaction.findOneAndDelete = jest.fn().mockResolvedValue(mockTransaction);
      req.params.id = 'transactionId';

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
      Transaction.findOneAndDelete = jest.fn().mockResolvedValue(null);
      req.params.id = 'nonexistentId';

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

  describe('getTransactionStats', () => {
    it('should get transaction statistics successfully', async () => {
      // Arrange
      const mockStats = [
        { _id: 'income', total: 1000, count: 2 },
        { _id: 'expense', total: 500, count: 1 }
      ];

      Transaction.aggregate = jest.fn().mockResolvedValue(mockStats);

      // Act
      await transactionController.getTransactionStats(req, res);

      // Assert
      expect(Transaction.aggregate).toHaveBeenCalledWith(expect.any(Array));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should filter statistics by date range', async () => {
      // Arrange
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      req.query = { startDate, endDate };

      Transaction.aggregate = jest.fn().mockResolvedValue([]);

      // Act
      await transactionController.getTransactionStats(req, res);

      // Assert
      expect(Transaction.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $match: expect.objectContaining({
              date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
              }
            })
          }
        ])
      );
    });
  });
}); 