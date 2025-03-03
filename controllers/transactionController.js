const Transaction = require('../models/transactionModel');
const Wallet = require('../models/walletModel');
const mongoose = require('mongoose');
const reportController = require('./reportController');

exports.createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount, notes, category, type, date } = req.body;

    const wallet = await Wallet.findOne({ 
      userId: req.user.id 
    }).session(session);

    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy ví'
      });
    }

    // Kiểm tra số dư khi chi tiêu
    if (type === 'expense' && wallet.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Số dư trong ví không đủ'
      });
    }

    // Tạo giao dịch
    const transaction = await Transaction.create([{
      userId: req.user.id,
      walletId: wallet._id,
      amount,
      notes: notes || '',
      category,
      type,
      date: date || new Date()
    }], { session });

    // Cập nhật số dư ví
    const updateAmount = type === 'income' ? amount : -amount;
    await Wallet.findByIdAndUpdate(
      wallet._id,
      { $inc: { balance: updateAmount } },
      { session }
    );

    await reportController.updateReportFromTransaction(transaction[0]);

    await session.commitTransaction();

    res.status(201).json({
      status: 'success',
      data: {
        transaction: transaction[0]
      }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const {
      type,
      category,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sort = '-date'
    } = req.query;

    const query = { userId: req.user.id };

    if (type) query.type = type;
    if (category) query.category = category;
    
    // Xử lý lọc theo ngày
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        transactions,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};


exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy giao dịch'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        transaction
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.updateTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { amount, notes, category, type, date } = req.body;

    // Lấy thông tin giao dịch cũ
    const oldTransaction = await Transaction.findOne({ 
      _id: req.params.id, 
      userId: req.user.id 
    }).session(session);

    if (!oldTransaction) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy giao dịch'
      });
    }

    // Lấy thông tin ví
    const wallet = await Wallet.findById(oldTransaction.walletId).session(session);
    
    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy ví'
      });
    }

    // Tính toán thay đổi số dư
    let balanceChange = 0;
    
    // Hoàn lại số dư từ giao dịch cũ
    if (oldTransaction.type === 'income') {
      balanceChange -= oldTransaction.amount;
    } else {
      balanceChange += oldTransaction.amount;
    }
    
    // Thêm số dư từ giao dịch mới
    if (type === 'income') {
      balanceChange += amount;
    } else {
      balanceChange -= amount;
    }
    
    // Kiểm tra số dư đủ không
    if (wallet.balance + balanceChange < 0) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Số dư trong ví không đủ sau khi cập nhật'
      });
    }

    // Cập nhật giao dịch
    const updatedTransaction = await Transaction.findOneAndUpdate(
      { 
        _id: req.params.id, 
        userId: req.user.id 
      },
      { 
        amount, 
        notes, 
        category, 
        type, 
        date: date || new Date() 
      },
      { 
        new: true, 
        runValidators: true,
        session
      }
    );

    // Cập nhật số dư ví
    await Wallet.findByIdAndUpdate(
      wallet._id,
      { $inc: { balance: balanceChange } },
      { session }
    );

    // Cập nhật báo cáo - Để đơn giản, chúng ta sẽ cập nhật lại báo cáo
    // Đối với giao dịch cũ và mới (nếu tháng khác nhau)
    const oldDate = new Date(oldTransaction.date);
    const newDate = new Date(date || updatedTransaction.date);
    
    // Tạo một giao dịch âm để bù trừ giao dịch cũ
    const negativeOldTransaction = {
      ...oldTransaction.toObject(),
      amount: -oldTransaction.amount
    };
    
    await reportController.updateReportFromTransaction(negativeOldTransaction);
    await reportController.updateReportFromTransaction(updatedTransaction);

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      data: {
        transaction: updatedTransaction
      }
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  } finally {
    session.endSession();
  }
};


exports.deleteTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Lấy thông tin giao dịch trước khi xóa
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).session(session);

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy giao dịch'
      });
    }
    
    // Cập nhật số dư ví
    const updateAmount = transaction.type === 'income' ? -transaction.amount : transaction.amount;
    
    await Wallet.findByIdAndUpdate(
      transaction.walletId,
      { $inc: { balance: updateAmount } },
      { session }
    );
    
    // Xóa giao dịch
    await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    }).session(session);
    
    // Cập nhật báo cáo
    // Tạo một giao dịch ngược lại để bù trừ ảnh hưởng của giao dịch xóa
    const negativeTransaction = {
      ...transaction.toObject(),
      amount: -transaction.amount
    };
    
    await reportController.updateReportFromTransaction(negativeTransaction);
    
    await session.commitTransaction();
    
    res.status(200).json({
      status: 'success',
      message: 'Xóa giao dịch thành công'
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const {
      type,
      category,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sort = '-date'
    } = req.query;

    const query = { userId: req.user.id };

    if (type) query.type = type;
    if (category) query.category = category;
    
    // Xử lý lọc theo ngày
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        transactions,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getTransactionStats = async (req, res) => {
  try {
    const { type, category, startDate, endDate } = req.query;

    const query = { userId: req.user.id };

    if (type) query.type = type;
    if (category) query.category = category;
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const stats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const statsObject = stats.reduce((acc, curr) => {
      acc[curr._id] = {
        total: curr.total,
        count: curr.count
      };
      return acc;
    }, {});

    // Thống kê theo danh mục
    const categoryStats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        overview: statsObject,
        categoryStats
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};