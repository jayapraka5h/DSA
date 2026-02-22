const express = require('express');
const { createRoom, joinRoom } = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .post(protect, createRoom);

router.route('/join')
  .post(protect, joinRoom);

module.exports = router;
