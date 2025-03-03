const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  incomeTotal: {
    type: Number,
    default: 0
  },
  expenseTotal: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  categoryStats: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    name: String,
    icon: String,
    incomeAmount: {
      type: Number,
      default: 0
    },
    expenseAmount: {
      type: Number,
      default: 0
    }
  }],
  dailyStats: [{
    day: {
      type: Number,
      min: 1,
      max: 31
    },
    incomeAmount: {
      type: Number,
      default: 0
    },
    expenseAmount: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true
});

// Composite unique index để đảm bảo không có báo cáo trùng lặp cho cùng user, wallet, tháng và năm
reportSchema.index({ userId: 1, walletId: 1, year: 1, month: 1 }, { unique: true });

// Hàm static để tạo hoặc cập nhật báo cáo khi có giao dịch mới
reportSchema.statics.updateReportFromTransaction = async function(transaction) {
  const { userId, walletId, amount, category, type, date } = transaction;
  const transactionDate = new Date(date);
  const year = transactionDate.getFullYear();
  const month = transactionDate.getMonth() + 1; // JavaScript months are 0-indexed
  const day = transactionDate.getDate();

  // Tìm hoặc tạo báo cáo cho tháng này
  let report = await this.findOne({ userId, walletId, year, month });

  if (!report) {
    report = new this({
      userId,
      walletId,
      year,
      month,
      incomeTotal: 0,
      expenseTotal: 0,
      balance: 0,
      categoryStats: [],
      dailyStats: Array.from({ length: 31 }, (_, i) => ({
        day: i + 1,
        incomeAmount: 0,
        expenseAmount: 0
      }))
    });
  }

  // Cập nhật tổng thu chi
  if (type === 'income') {
    report.incomeTotal += amount;
  } else if (type === 'expense') {
    report.expenseTotal += amount;
  }

  // Cập nhật balance
  report.balance = report.incomeTotal - report.expenseTotal;

  // Cập nhật thống kê theo danh mục
  const categoryIndex = report.categoryStats.findIndex(
    stat => stat.categoryId && stat.categoryId.toString() === category.toString()
  );

  if (categoryIndex >= 0) {
    // Nếu danh mục đã tồn tại trong báo cáo
    if (type === 'income') {
      report.categoryStats[categoryIndex].incomeAmount += amount;
    } else if (type === 'expense') {
      report.categoryStats[categoryIndex].expenseAmount += amount;
    }
  } else {
    // Nếu danh mục chưa có trong báo cáo
    // Lấy thông tin category từ database
    const Category = mongoose.model('Category');
    const categoryInfo = await Category.findById(category);
    
    if (categoryInfo) {
      const iconInfo = categoryInfo.icons && categoryInfo.icons.length > 0 
        ? categoryInfo.icons[0].iconPath 
        : '📊'; // Default icon
      
      report.categoryStats.push({
        categoryId: category,
        name: categoryInfo.name,
        icon: iconInfo,
        incomeAmount: type === 'income' ? amount : 0,
        expenseAmount: type === 'expense' ? amount : 0
      });
    }
  }

  // Cập nhật thống kê theo ngày
  const dayIndex = report.dailyStats.findIndex(stat => stat.day === day);
  if (dayIndex >= 0) {
    if (type === 'income') {
      report.dailyStats[dayIndex].incomeAmount += amount;
    } else if (type === 'expense') {
      report.dailyStats[dayIndex].expenseAmount += amount;
    }
  } else {
    report.dailyStats.push({
      day,
      incomeAmount: type === 'income' ? amount : 0,
      expenseAmount: type === 'expense' ? amount : 0
    });
  }

  // Lưu báo cáo đã cập nhật
  await report.save();
  return report;
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;