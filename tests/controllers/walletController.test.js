const Wallet = require('../../models/walletModel');
const Transaction = require('../../models/transactionModel');
const User = require('../../models/userModel');
const walletController = require('../../controllers/walletController');
const mongoose = require('mongoose');

// Mock mongoose
jest.mock('mongoose', () => {
  class Schema {
    constructor() {
      return {
        pre: jest.fn(),
        index: jest.fn(),
        methods: {},
        statics: {}
      };
    }
  }
  Schema.Types = {
    ObjectId: String
  };
  return {
    Schema,
    model: jest.fn(),
    startSession: jest.fn()
  };
});

// Mock các models
jest.mock('../../models/userModel', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  comparePassword: jest.fn()
}));

jest.mock('../../models/walletModel', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  exists: jest.fn()
}));

jest.mock('../../models/transactionModel', () => ({
  exists: jest.fn().mockReturnValue({
    session: jest.fn().mockReturnThis()
  }),
  aggregate: jest.fn()
}));

describe('WalletController', () => {
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

  describe('createWallet', () => {
    it('should create a wallet successfully when no default wallet exists', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'VND',
        isDefault: true
      };

      Wallet.findOne.mockResolvedValue(null); // No default wallet exists
      Wallet.create.mockResolvedValue(mockWallet);

      req.body = {
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'VND'
      };

      // Act
      await walletController.createWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          wallet: mockWallet
        }
      });
      expect(Wallet.create).toHaveBeenCalledWith({
        userId: 'mockUserId',
        name: 'Test Wallet',
        description: 'Test Description',
        currency: 'VND',
        isDefault: true
      });
    });

    it('should create a non-default wallet when default wallet exists', async () => {
      // Arrange
      const mockDefaultWallet = {
        _id: 'defaultWalletId',
        isDefault: true
      };

      const mockNewWallet = {
        _id: 'newWalletId',
        name: 'Second Wallet',
        description: 'Second Description',
        currency: 'VND',
        isDefault: false
      };

      Wallet.findOne.mockResolvedValue(mockDefaultWallet);
      Wallet.create.mockResolvedValue(mockNewWallet);

      req.body = {
        name: 'Second Wallet',
        description: 'Second Description',
        currency: 'VND'
      };

      // Act
      await walletController.createWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          wallet: mockNewWallet
        }
      });
      expect(Wallet.create).toHaveBeenCalledWith({
        userId: 'mockUserId',
        name: 'Second Wallet',
        description: 'Second Description',
        currency: 'VND',
        isDefault: false
      });
    });

    it('should return error when required fields are missing', async () => {
      // Arrange
      req.body = {
        description: 'Test Description'
      };

      // Act
      await walletController.createWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Vui lòng cung cấp đầy đủ thông tin'
      });
    });
  });

  describe('getAllWallets', () => {
    it('should get all wallets successfully', async () => {
      // Arrange
      const mockWallets = [
        { _id: 'wallet1', name: 'Wallet 1' },
        { _id: 'wallet2', name: 'Wallet 2' }
      ];

      Wallet.find.mockResolvedValue(mockWallets);

      // Act
      await walletController.getAllWallets(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          wallets: mockWallets
        }
      });
      expect(Wallet.find).toHaveBeenCalledWith({ userId: 'mockUserId' });
    });
  });

  describe('getWallet', () => {
    it('should get a single wallet successfully', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        name: 'Test Wallet'
      };

      Wallet.findOne.mockResolvedValue(mockWallet);
      req.params.id = 'walletId';

      // Act
      await walletController.getWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          wallet: mockWallet
        }
      });
    });

    it('should return error when wallet not found', async () => {
      // Arrange
      Wallet.findOne.mockResolvedValue(null);
      req.params.id = 'nonexistentId';

      // Act
      await walletController.getWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy ví'
      });
    });
  });

  describe('updateWallet', () => {
    it('should update wallet successfully', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        name: 'Old Name',
        description: 'Old Description',
        isDefault: false,
        save: jest.fn()
      };

      Wallet.findOne.mockResolvedValue(mockWallet);

      req.params.id = 'walletId';
      req.body = {
        name: 'New Name',
        description: 'New Description',
        isDefault: true
      };

      // Act
      await walletController.updateWallet(req, res);

      // Assert
      expect(mockWallet.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          wallet: mockWallet
        }
      });
    });

    it('should return error when wallet not found', async () => {
      // Arrange
      Wallet.findOne.mockResolvedValue(null);
      req.params.id = 'nonexistentId';

      // Act
      await walletController.updateWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy ví'
      });
    });
  });

  describe('deleteWallet', () => {
    beforeEach(() => {
      // Mock session method for Wallet.findOne
      const mockWallet = {
        _id: 'walletId',
        isDefault: false,
        deleteOne: jest.fn().mockResolvedValue(true)
      };
      Wallet.findOne.mockImplementation(() => ({
        session: () => mockWallet
      }));
    });

    it('should delete wallet successfully', async () => {
      // Arrange
      Transaction.exists.mockImplementation(() => ({
        session: () => false
      }));
      req.params.id = 'walletId';

      // Act
      await walletController.deleteWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Xóa ví thành công'
      });
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should return error when trying to delete default wallet', async () => {
      // Arrange
      const mockDefaultWallet = {
        _id: 'walletId',
        isDefault: true
      };
      Wallet.findOne.mockImplementation(() => ({
        session: () => mockDefaultWallet
      }));
      req.params.id = 'walletId';

      // Act
      await walletController.deleteWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không thể xóa ví mặc định'
      });
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should return error when wallet has transactions', async () => {
      // Arrange
      Transaction.exists.mockImplementation(() => ({
        session: () => true
      }));
      req.params.id = 'walletId';

      // Act
      await walletController.deleteWallet(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không thể xóa ví đã có giao dịch'
      });
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('getWalletBalance', () => {
    it('should get wallet balance and statistics successfully', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        balance: 1000
      };

      const mockIncomeStats = [{ _id: null, total: 2000 }];
      const mockExpenseStats = [{ _id: null, total: 1000 }];

      Wallet.findOne.mockResolvedValue(mockWallet);
      Transaction.aggregate
        .mockResolvedValueOnce(mockIncomeStats)
        .mockResolvedValueOnce(mockExpenseStats);

      req.params.id = 'walletId';

      // Act
      await walletController.getWalletBalance(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          balance: 1000,
          totalIncome: 2000,
          totalExpense: 1000
        }
      });
    });

    it('should handle empty statistics correctly', async () => {
      // Arrange
      const mockWallet = {
        _id: 'walletId',
        balance: 0
      };

      Wallet.findOne.mockResolvedValue(mockWallet);
      Transaction.aggregate
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      req.params.id = 'walletId';

      // Act
      await walletController.getWalletBalance(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          balance: 0,
          totalIncome: 0,
          totalExpense: 0
        }
      });
    });

    it('should return error when wallet not found', async () => {
      // Arrange
      Wallet.findOne.mockResolvedValue(null);
      req.params.id = 'nonexistentId';

      // Act
      await walletController.getWalletBalance(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Không tìm thấy ví'
      });
    });
  });
}); 