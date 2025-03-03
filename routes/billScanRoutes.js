const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const billScanController = require('../controllers/billScanController');

// router.use(auth);

router.post('/analyze', billScanController.analyzeBill);

module.exports = router;
