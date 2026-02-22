const { getDb } = require('../db');

exports.submitSolution = async (req, res) => {
  try {
    const { code, language, questionId } = req.body;
    const db = getDb();
    const author_id = req.user.id;

    // Verify question exists
    const question = await db.get('SELECT id FROM questions WHERE id = ?', [questionId]);
    if (!question) {
        return res.status(404).json({ success: false, error: 'Question not found' });
    }

    const result = await db.run(
        'INSERT INTO solutions (code, language, question_id, author_id) VALUES (?, ?, ?, ?)',
        [code, language, questionId, author_id]
    );

    res.status(201).json({
      success: true,
      data: { id: result.lastID, code, language, questionId, author_id }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getSolutionsForQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const db = getDb();

    const solutions = await db.all(`
        SELECT s.*, u.username as author_username 
        FROM solutions s
        LEFT JOIN users u ON s.author_id = u.id
        WHERE question_id = ?
        ORDER BY s.created_at DESC
    `, [questionId]);

    // Map _id for frontend compatibility
    const mappedSolutions = solutions.map(s => ({
        ...s,
        _id: s.id,
        author: { username: s.author_username }
    }));

    res.status(200).json({
      success: true,
      count: mappedSolutions.length,
      data: mappedSolutions
    });
  } catch (error) {
     res.status(500).json({ success: false, error: error.message });
  }
};
