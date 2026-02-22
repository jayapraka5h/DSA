const express = require('express');
const { submitSolution, getSolutionsForQuestion } = require('../controllers/solutionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
  .post(protect, submitSolution);

router.route('/:questionId')
  .get(getSolutionsForQuestion);

module.exports = router;
