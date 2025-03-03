const Report = require('../models/reportModel');
const Transaction = require('../models/transactionModel');
const Category = require('../models/categoryModel');
const Wallet = require('../models/walletModel');
const mongoose = require('mongoose');

// Lấy báo cáo theo ngày
exports.getDailyReport = async (req, res) => {
    try {
        const { date } = req.query;
        const userId = req.user.id;

        // Nếu không có ngày, lấy ngày hiện tại
        const reportDate = date ? new Date(date) : new Date();
        reportDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(reportDate);
        endDate.setHours(23, 59, 59, 999);

        let report = await Report.findOne({
            userId: userId,
            date: {
                $gte: reportDate,
                $lte: endDate
            }
        }).populate('categoryData.categoryId', 'name icon');

        if (!report) {
            // Nếu chưa có báo cáo, tạo một báo cáo trống
            const wallet = await Wallet.findOne({ userId });
            report = {
                userId,
                date: reportDate,
                totalIncome: 0,
                totalExpense: 0,
                balance: wallet ? wallet.balance : 0,
                categoryData: []
            };
        }

        res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy báo cáo hàng ngày',
            error: error.message
        });
    }
};

// Lấy báo cáo theo tuần
exports.getWeeklyReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const userId = req.user.id;

        // Tạo ngày bắt đầu và kết thúc của tuần
        let start, end;
        
        if (startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            // Mặc định lấy tuần hiện tại
            const now = new Date();
            start = new Date(now);
            start.setDate(now.getDate() - now.getDay()); // Chủ nhật của tuần này
            start.setHours(0, 0, 0, 0);
            
            end = new Date(now);
            end.setDate(now.getDate() + (6 - now.getDay())); // Thứ 7 của tuần này
            end.setHours(23, 59, 59, 999);
        }

        // Tổng hợp dữ liệu giao dịch theo tuần
        const weeklyData = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        day: { $dayOfWeek: "$date" },
                        type: "$type"
                    },
                    total: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id.day": 1 }
            }
        ]);

        // Tổng hợp dữ liệu theo danh mục
        const categoryData = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        category: "$category",
                        type: "$type"
                    },
                    total: { $sum: "$amount" }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id.category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            {
                $unwind: "$categoryInfo"
            },
            {
                $project: {
                    _id: 0,
                    categoryId: "$_id.category",
                    categoryName: "$categoryInfo.name",
                    icon: "$categoryInfo.icon",
                    type: "$_id.type",
                    amount: "$total"
                }
            }
        ]);

        // Tính tổng thu nhập và chi tiêu
        const totalIncome = weeklyData
            .filter(item => item._id.type === 'income')
            .reduce((sum, item) => sum + item.total, 0);
            
        const totalExpense = weeklyData
            .filter(item => item._id.type === 'expense')
            .reduce((sum, item) => sum + item.total, 0);

        // Định dạng dữ liệu theo ngày trong tuần
        const dailyData = Array(7).fill().map((_, index) => {
            const dayIndex = index + 1; // MongoDB $dayOfWeek: 1 (Chủ nhật) -> 7 (Thứ 7)
            const income = weeklyData.find(item => 
                item._id.day === dayIndex && item._id.type === 'income'
            );
            const expense = weeklyData.find(item => 
                item._id.day === dayIndex && item._id.type === 'expense'
            );
            
            return {
                day: dayIndex,
                income: income ? income.total : 0,
                expense: expense ? expense.total : 0
            };
        });

        res.status(200).json({
            success: true,
            data: {
                startDate: start,
                endDate: end,
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense,
                dailyData,
                categoryData
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy báo cáo hàng tuần',
            error: error.message
        });
    }
};

// Lấy báo cáo theo tháng
exports.getMonthlyReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        const userId = req.user.id;

        // Thiết lập ngày đầu và cuối tháng
        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth(); // 0-11
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();
        
        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

        // Tổng hợp dữ liệu giao dịch theo tháng
        const monthlyData = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        day: { $dayOfMonth: "$date" },
                        type: "$type"
                    },
                    total: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id.day": 1 }
            }
        ]);

        // Tổng hợp dữ liệu theo danh mục
        const categoryData = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        category: "$category",
                        type: "$type"
                    },
                    total: { $sum: "$amount" }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id.category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            {
                $unwind: "$categoryInfo"
            },
            {
                $project: {
                    _id: 0,
                    categoryId: "$_id.category",
                    categoryName: "$categoryInfo.name",
                    icon: "$categoryInfo.icon",
                    type: "$_id.type",
                    amount: "$total"
                }
            }
        ]);

        // Tính tổng thu nhập và chi tiêu
        const totalIncome = monthlyData
            .filter(item => item._id.type === 'income')
            .reduce((sum, item) => sum + item.total, 0);
            
        const totalExpense = monthlyData
            .filter(item => item._id.type === 'expense')
            .reduce((sum, item) => sum + item.total, 0);

        // Tạo dữ liệu cho từng ngày trong tháng
        const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const dailyData = Array(daysInMonth).fill().map((_, index) => {
            const day = index + 1;
            const income = monthlyData.find(item => 
                item._id.day === day && item._id.type === 'income'
            );
            const expense = monthlyData.find(item => 
                item._id.day === day && item._id.type === 'expense'
            );
            
            return {
                day,
                income: income ? income.total : 0,
                expense: expense ? expense.total : 0
            };
        });

        res.status(200).json({
            success: true,
            data: {
                month: targetMonth + 1,
                year: targetYear,
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense,
                dailyData,
                categoryData
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy báo cáo hàng tháng',
            error: error.message
        });
    }
};

// Lấy báo cáo theo năm
exports.getYearlyReport = async (req, res) => {
    try {
        const { year } = req.query;
        const userId = req.user.id;

        // Thiết lập năm mục tiêu
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const startDate = new Date(targetYear, 0, 1);
        const endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);

        // Tổng hợp dữ liệu giao dịch theo năm
        const yearlyData = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$date" },
                        type: "$type"
                    },
                    total: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id.month": 1 }
            }
        ]);

        // Tổng hợp dữ liệu theo danh mục
        const categoryData = await Transaction.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(userId),
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        category: "$category",
                        type: "$type"
                    },
                    total: { $sum: "$amount" }
                }
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id.category",
                    foreignField: "_id",
                    as: "categoryInfo"
                }
            },
            {
                $unwind: "$categoryInfo"
            },
            {
                $project: {
                    _id: 0,
                    categoryId: "$_id.category",
                    categoryName: "$categoryInfo.name",
                    icon: "$categoryInfo.icon",
                    type: "$_id.type",
                    amount: "$total"
                }
            },
            {
                $sort: { amount: -1 }
            }
        ]);

        // Tính tổng thu nhập và chi tiêu
        const totalIncome = yearlyData
            .filter(item => item._id.type === 'income')
            .reduce((sum, item) => sum + item.total, 0);
            
        const totalExpense = yearlyData
            .filter(item => item._id.type === 'expense')
            .reduce((sum, item) => sum + item.total, 0);

        // Dữ liệu cho từng tháng trong năm
        const monthlyData = Array(12).fill().map((_, index) => {
            const month = index + 1;
            const income = yearlyData.find(item => 
                item._id.month === month && item._id.type === 'income'
            );
            const expense = yearlyData.find(item => 
                item._id.month === month && item._id.type === 'expense'
            );
            
            return {
                month,
                income: income ? income.total : 0,
                expense: expense ? expense.total : 0
            };
        });

        res.status(200).json({
            success: true,
            data: {
                year: targetYear,
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense,
                monthlyData,
                categoryData
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy báo cáo hàng năm',
            error: error.message
        });
    }
};

// Cập nhật báo cáo khi có giao dịch mới (được gọi từ transactionController)
exports.updateReportAfterTransaction = async (transaction) => {
    try {
        // Lấy thông tin danh mục
        const category = await Category.findById(transaction.category);
        
        // Thêm tên danh mục vào thông tin giao dịch
        transaction.categoryName = category ? category.name : 'Unknown';
        
        // Cập nhật báo cáo
        await Report.updateReportForTransaction(transaction);
        
        // Cập nhật số dư ví
        if (transaction.type === 'income') {
            await Wallet.findOneAndUpdate(
                { userId: transaction.userId },
                { $inc: { balance: transaction.amount } }
            );
        } else if (transaction.type === 'expense') {
            await Wallet.findOneAndUpdate(
                { userId: transaction.userId },
                { $inc: { balance: -transaction.amount } }
            );
        }
        
        return true;
    } catch (error) {
        console.error('Lỗi khi cập nhật báo cáo:', error);
        return false;
    }
};