const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    totalIncome: {
        type: Number,
        default: 0
    },
    totalExpense: {
        type: Number,
        default: 0
    },
    balance: {
        type: Number,
        default: 0
    },
    categoryData: [{
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        },
        categoryName: String,
        amount: Number,
        type: {
            type: String,
            enum: ['income', 'expense']
        }
    }]
}, { 
    timestamps: true
});

// Tạo index cho tìm kiếm hiệu quả
reportSchema.index({ userId: 1, date: 1 });

// Phương thức tĩnh để tạo hoặc cập nhật báo cáo theo ngày
reportSchema.statics.updateReportForTransaction = async function(transaction) {
    const startDate = new Date(transaction.date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(transaction.date);
    endDate.setHours(23, 59, 59, 999);

    // Tìm báo cáo theo ngày và userId
    let report = await this.findOne({
        userId: transaction.userId,
        date: {
            $gte: startDate,
            $lte: endDate
        }
    });

    // Nếu chưa có báo cáo cho ngày này, tạo mới
    if (!report) {
        report = new this({
            userId: transaction.userId,
            date: startDate,
            totalIncome: 0,
            totalExpense: 0,
            balance: 0,
            categoryData: []
        });
    }

    // Cập nhật tổng thu nhập hoặc chi tiêu
    if (transaction.type === 'income') {
        report.totalIncome += transaction.amount;
    } else if (transaction.type === 'expense') {
        report.totalExpense += transaction.amount;
    }

    // Cập nhật số dư
    report.balance = report.totalIncome - report.totalExpense;

    // Cập nhật dữ liệu danh mục
    const categoryIndex = report.categoryData.findIndex(
        cat => cat.categoryId.toString() === transaction.category.toString() && cat.type === transaction.type
    );

    if (categoryIndex !== -1) {
        // Nếu danh mục đã tồn tại, cập nhật số tiền
        report.categoryData[categoryIndex].amount += transaction.amount;
    } else {
        // Thêm danh mục mới
        report.categoryData.push({
            categoryId: transaction.category,
            categoryName: transaction.categoryName, // Giả sử có categoryName trong transaction
            amount: transaction.amount,
            type: transaction.type
        });
    }

    // Lưu và trả về báo cáo đã cập nhật
    return await report.save();
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;