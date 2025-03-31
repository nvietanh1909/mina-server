const mongoose = require('mongoose');
const Transaction = require('../models/transactionModel');
const Wallet = require('../models/walletModel');

const updateTransactions = async () => {
  try {
    // Kết nối database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mina');
    console.log('Connected to MongoDB');

    // Lấy tất cả giao dịch
    const transactions = await Transaction.find({ walletId: { $exists: false } });
    console.log(`Found ${transactions.length} transactions to update`);

    // Cập nhật từng giao dịch
    for (const transaction of transactions) {
      // Tìm ví mặc định của user
      const wallet = await Wallet.findOne({ 
        userId: transaction.userId,
        isDefault: true 
      });

      if (wallet) {
        transaction.walletId = wallet._id;
        await transaction.save();
        console.log(`Updated transaction ${transaction._id} with wallet ${wallet._id}`);
      } else {
        console.log(`No default wallet found for user ${transaction.userId}`);
      }
    }

    console.log('Update completed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

updateTransactions(); 