const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Route công khai
router.post('/signup', userController.register);
router.post('/login', userController.login);

// Route yêu cầu xác thực
router.use(auth);
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);

module.exports = router;