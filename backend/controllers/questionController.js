const { getDb } = require('../db');

exports.createQuestion = async (req, res) => {
  try {
    const { title, description, difficulty, tags } = req.body;
    const db = getDb();
    const author_id = req.user.id;

    // Use transaction if we have tags
    await db.run('BEGIN TRANSACTION');
    
    try {
        const result = await db.run(
            'INSERT INTO questions (title, description, difficulty, author_id) VALUES (?, ?, ?, ?)',
            [title, description, difficulty || 'Medium', author_id]
        );
        
        const questionId = result.lastID;
        
        if (tags && Array.isArray(tags)) {
            for (let tag of tags) {
                await db.run('INSERT INTO question_tags (question_id, tag) VALUES (?, ?)', [questionId, tag]);
            }
        }
        
        await db.run('COMMIT');
        
        res.status(201).json({
          success: true,
          data: { id: questionId, title, description, difficulty, tags, author_id }
        });
    } catch(err) {
        await db.run('ROLLBACK');
        throw err;
    }

  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.getQuestions = async (req, res) => {
  try {
    const db = getDb();
    
    // Join questions with their author username
    const questionsRows = await db.all(`
        SELECT q.*, u.username as author_username 
        FROM questions q
        LEFT JOIN users u ON q.author_id = u.id
        ORDER BY q.created_at DESC
    `);
    
    // Fetch tags for these questions
    let tagsRows = [];
    if (questionsRows.length > 0) {
        tagsRows = await db.all(`
            SELECT question_id, tag FROM question_tags
            WHERE question_id IN (${questionsRows.map(q => q.id).join(',')} )
        `);
    }
    
    // Map tags back into the objects
    const questions = questionsRows.map(q => {
        const qTags = tagsRows.filter(t => t.question_id === q.id).map(t => t.tag);
        return {
            _id: q.id,  // Keep frontend compatibility mapping id -> _id
            ...q,
            tags: qTags
        };
    });

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
     res.status(500).json({ success: false, error: error.message });
  }
};
