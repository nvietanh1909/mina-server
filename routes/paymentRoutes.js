const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// Hàm tạo chuỗi hash
function createHash(data, secret) {
  return crypto.createHmac('sha512', secret).update(data).digest('hex');
}

router.post('/create_payment_url', (req, res) => {
  const { amount, orderId, orderInfo } = req.body;

  const date = new Date();
  const vnp_TmnCode = process.env.VNP_TMNCODE;
  const vnp_HashSecret = process.env.VNP_HASHSECRET;
  const vnp_Url = process.env.VNP_URL;
  const vnp_ReturnUrl = process.env.VNP_RETURNURL;

  const createDate = date.toISOString().replace(/[-:T.]/g, '').slice(0, 14); 
  const vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: vnp_TmnCode,
    vnp_Amount: amount * 100, 
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId || createDate, 
    vnp_OrderInfo: orderInfo || 'Thanh toan don hang',
    vnp_OrderType: 'billpayment',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: vnp_ReturnUrl,
    vnp_IpAddr: req.ip || '127.0.0.1',
    vnp_CreateDate: createDate,
  };

  const sortedParams = Object.keys(vnp_Params)
    .sort()
    .reduce((result, key) => {
      result[key] = vnp_Params[key];
      return result;
    }, {});

  const signData = new URLSearchParams(sortedParams).toString();
  const vnp_SecureHash = createHash(signData, vnp_HashSecret);
  sortedParams.vnp_SecureHash = vnp_SecureHash;

  const paymentUrl = `${vnp_Url}?${new URLSearchParams(sortedParams).toString()}`;

  res.json({ paymentUrl });
});


router.get('/vnpay_return', (req, res) => {
  const vnp_Params = req.query;
  const secureHash = vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  const sortedParams = Object.keys(vnp_Params)
    .sort()
    .reduce((result, key) => {
      result[key] = vnp_Params[key];
      return result;
    }, {});

  const signData = new URLSearchParams(sortedParams).toString();
  const vnp_HashSecret = process.env.VNP_HASHSECRET;
  const checkSum = createHash(signData, vnp_HashSecret);

  if (secureHash === checkSum) {
    const rspCode = vnp_Params['vnp_ResponseCode'];
    const transactionData = {
      amount: vnp_Params['vnp_Amount'] / 100,
      bankCode: vnp_Params['vnp_BankCode'],
      cardType: vnp_Params['vnp_CardType'],
      orderInfo: vnp_Params['vnp_OrderInfo'],
      payDate: vnp_Params['vnp_PayDate'],
      responseCode: rspCode,
      transactionNo: vnp_Params['vnp_TransactionNo'],
      txnRef: vnp_Params['vnp_TxnRef'],
    };

    if (rspCode === '00') {
      console.log('Transaction Success:', transactionData);
      res.status(200).json({ message: 'Thanh toán thành công', data: transactionData });
    } else {
      console.log('Transaction Failed:', transactionData);
      res.status(400).json({ message: 'Thanh toán thất bại', data: transactionData });
    }
  } else {
    console.log('Invalid Signature:', vnp_Params);
    res.status(400).json({ message: 'Chữ ký không hợp lệ' });
  }
});

module.exports = router;