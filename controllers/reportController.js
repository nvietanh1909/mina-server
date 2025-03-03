const Report = require('../models/reportModel');
const Transaction = require('../models/transactionModel');
const Category = require('../models/categoryModel');
const Wallet = require('../models/walletModel');
const mongoose = require('mongoose');

exports.getMonthlyReport = async (req, res) => {
  try {
    const { year, month, walletId } = req.query;
    const userId = req.user.id;

    // Validate input
    if (!year || !month) {
      return res.status(400).json({
        status: 'error',
        message: 'Năm và tháng là bắt buộc'
      });
    }

    // Tìm báo cáo theo năm, tháng và user
    let query = { userId, year: parseInt(year), month: parseInt(month) };
    
    // Thêm điều kiện ví nếu có
    if (walletId) {
      query.walletId = walletId;
    }

    const reports = await Report.find(query);

    // Nếu không có báo cáo, tính toán từ dữ liệu giao dịch
    if (!reports || reports.length === 0) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);

      let transactionQuery = {
        userId,
        date: { $gte: startDate, $lte: endDate }
      };

      if (walletId) {
        transactionQuery.walletId = walletId;
      }

      // Lấy tất cả giao dịch trong tháng
      const transactions = await Transaction.find(transactionQuery);

      // Nếu có ít nhất một giao dịch, tạo báo cáo từ các giao dịch
      if (transactions.length > 0) {
        for (const transaction of transactions) {
          await Report.updateReportFromTransaction(transaction);
        }
        
        // Truy vấn lại sau khi đã tạo báo cáo
        const newReports = await Report.find(query);
        
        return res.status(200).json({
          status: 'success',
          data: {
            reports: newReports
          }
        });
      }

      // Nếu không có giao dịch nào
      return res.status(200).json({
        status: 'success',
        data: {
          reports: []
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        reports
      }
    });
  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getAnnualReport = async (req, res) => {
  try {
    const { year, walletId } = req.query;
    const userId = req.user.id;

    if (!year) {
      return res.status(400).json({
        status: 'error',
        message: 'Năm là bắt buộc'
      });
    }

    let query = { userId, year: parseInt(year) };
    
    if (walletId) {
      query.walletId = walletId;
    }

    // Lấy tất cả báo cáo theo tháng trong năm
    const monthlyReports = await Report.find(query);

    // Tổng hợp dữ liệu theo tháng
    const monthlyData = Array(12).fill().map(() => ({
      incomeAmount: 0,
      expenseAmount: 0,
      balance: 0
    }));

    // Tổng hợp dữ liệu theo danh mục
    const categoryMap = new Map();

    // Điền dữ liệu từ các báo cáo tháng
    monthlyReports.forEach(report => {
      const monthIndex = report.month - 1;
      monthlyData[monthIndex].incomeAmount += report.incomeTotal;
      monthlyData[monthIndex].expenseAmount += report.expenseTotal;
      monthlyData[monthIndex].balance += report.balance;

      // Tổng hợp theo danh mục
      report.categoryStats.forEach(categoryStat => {
        const categoryId = categoryStat.categoryId.toString();
        
        if (!categoryMap.has(categoryId)) {
          categoryMap.set(categoryId, {
            categoryId,
            name: categoryStat.name,
            icon: categoryStat.icon,
            incomeAmount: 0,
            expenseAmount: 0
          });
        }
        
        const category = categoryMap.get(categoryId);
        category.incomeAmount += categoryStat.incomeAmount;
        category.expenseAmount += categoryStat.expenseAmount;
      });
    });

    // Tính tổng cho cả năm
    const annualSummary = monthlyData.reduce((summary, month) => {
      summary.totalIncome += month.incomeAmount;
      summary.totalExpense += month.expenseAmount;
      summary.totalBalance += month.balance;
      return summary;
    }, { totalIncome: 0, totalExpense: 0, totalBalance: 0 });

    res.status(200).json({
      status: 'success',
      data: {
        year: parseInt(year),
        monthlyData: monthlyData.map((data, index) => ({
          month: index + 1,
          ...data
        })),
        categoryData: Array.from(categoryMap.values()),
        summary: annualSummary
      }
    });
  } catch (error) {
    console.error('Get annual report error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getCategoryReport = async (req, res) => {
  try {
    const { startDate, endDate, walletId } = req.query;
    const userId = req.user.id;

    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Ngày bắt đầu và kết thúc là bắt buộc'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        status: 'error',
        message: 'Định dạng ngày không hợp lệ'
      });
    }

    // Tìm tất cả giao dịch trong khoảng thời gian
    let transactionQuery = {
      userId,
      date: { $gte: start, $lte: end }
    };

    if (walletId) {
      transactionQuery.walletId = walletId;
    }

    // Lấy danh mục từ database
    const categories = await Category.find({ userId });
    const categoryMap = new Map(
      categories.map(cat => [cat._id.toString(), {
        categoryId: cat._id,
        name: cat.name,
        icon: cat.icons && cat.icons.length > 0 ? cat.icons[0].iconPath : '📊',
        incomeAmount: 0,
        expenseAmount: 0,
        transactions: []
      }])
    );

    // Lấy giao dịch và phân nhóm theo danh mục
    const transactions = await Transaction.find(transactionQuery);
    
    transactions.forEach(transaction => {
      const categoryId = transaction.category.toString();
      
      if (!categoryMap.has(categoryId)) {
        // Trường hợp danh mục không tồn tại (hiếm gặp)
        return;
      }
      
      const category = categoryMap.get(categoryId);
      
      if (transaction.type === 'income') {
        category.incomeAmount += transaction.amount;
      } else if (transaction.type === 'expense') {
        category.expenseAmount += transaction.amount;
      }
      
      category.transactions.push({
        id: transaction._id,
        amount: transaction.amount,
        type: transaction.type,
        notes: transaction.notes,
        date: transaction.date
      });
    });

    // Tính tổng
    const summary = {
      totalIncome: Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.incomeAmount, 0),
      totalExpense: Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.expenseAmount, 0)
    };
    summary.balance = summary.totalIncome - summary.totalExpense;

    res.status(200).json({
      status: 'success',
      data: {
        startDate: start,
        endDate: end,
        categories: Array.from(categoryMap.values())
          .filter(cat => cat.incomeAmount > 0 || cat.expenseAmount > 0), // Chỉ hiển thị danh mục có giao dịch
        summary
      }
    });
  } catch (error) {
    console.error('Get category report error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.generateTransactionReport = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { timeRange, walletId } = req.body;
    const userId = req.user.id;
    
    if (!timeRange) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'error',
        message: 'Khoảng thời gian là bắt buộc'
      });
    }
    
    let startDate, endDate;
    const today = new Date();
    
    // Xác định khoảng thời gian
    switch (timeRange) {
      case 'last7days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 7);
        endDate = today;
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = today;
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'last3months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        endDate = today;
        break;
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = today;
        break;
      default:
        await session.abortTransaction();
        return res.status(400).json({
          status: 'error',
          message: 'Khoảng thời gian không hợp lệ'
        });
    }
    
    // Xây dựng query
    let query = {
      userId,
      date: { $gte: startDate, $lte: endDate }
    };
    
    if (walletId) {
      query.walletId = walletId;
    }
    
    // Lấy giao dịch
    const transactions = await Transaction.find(query)
      .populate('category', 'name icons')
      .sort({ date: -1 })
      .session(session);
    
    // Tính tổng thu chi
    const summary = transactions.reduce((acc, trans) => {
      if (trans.type === 'income') {
        acc.totalIncome += trans.amount;
      } else {
        acc.totalExpense += trans.amount;
      }
      return acc;
    }, { totalIncome: 0, totalExpense: 0 });
    
    summary.balance = summary.totalIncome - summary.totalExpense;
    
    // Tính toán theo danh mục
    const categoryStats = {};
    
    transactions.forEach(trans => {
      const categoryId = trans.category._id.toString();
      const categoryName = trans.category.name;
      const icon = trans.category.icons && trans.category.icons.length > 0 
        ? trans.category.icons[0].iconPath 
        : '📊';
      
      if (!categoryStats[categoryId]) {
        categoryStats[categoryId] = {
          categoryId,
          name: categoryName,
          icon,
          incomeAmount: 0,
          expenseAmount: 0,
          count: 0
        };
      }
      
      if (trans.type === 'income') {
        categoryStats[categoryId].incomeAmount += trans.amount;
      } else {
        categoryStats[categoryId].expenseAmount += trans.amount;
      }
      
      categoryStats[categoryId].count++;
    });
    
    await session.commitTransaction();
    
    res.status(200).json({
      status: 'success',
      data: {
        timeRange,
        startDate,
        endDate,
        transactions,
        categoryStats: Object.values(categoryStats),
        summary
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Generate transaction report error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// Sử dụng khi thêm giao dịch mới để cập nhật báo cáo
exports.updateReportFromTransaction = async (transaction) => {
  try {
    return await Report.updateReportFromTransaction(transaction);
  } catch (error) {
    console.error('Update report from transaction error:', error);
    throw error;
  }
};