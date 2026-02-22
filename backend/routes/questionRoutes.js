const express = require('express');
const { getQuestions, createQuestion } = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .get(getQuestions)
  .post(protect, createQuestion);

module.exports = router;
