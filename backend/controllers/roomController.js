const { getDb } = require('../db');
const crypto = require('crypto');

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

exports.createRoom = async (req, res) => {
  try {
    const { questionId } = req.body;
    const db = getDb();

    // Generate a secure unique Room ID
    const roomId = crypto.randomBytes(4).toString('hex'); // 8 char hex string
    const pin = generatePin();
    const owner_id = req.user.id;

    const result = await db.run(
        'INSERT INTO rooms (roomId, pin, owner_id, question_id) VALUES (?, ?, ?, ?)',
        [roomId, pin, owner_id, questionId || null]
    );

    res.status(201).json({
      success: true,
      data: { id: result.lastID, roomId, pin, owner: owner_id, question: questionId }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const { roomId, pin } = req.body;
    const db = getDb();

    if (!roomId || !pin) {
         return res.status(400).json({ success: false, error: 'Please provide roomId and pin' });
    }

    const room = await db.get('SELECT * FROM rooms WHERE roomId = ?', [roomId]);

    if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (room.pin !== pin) {
        return res.status(401).json({ success: false, error: 'Invalid PIN' });
    }

    // Since participants array is memory-only on WebSockets, we don't save participants to sqlite here.
    
    // Convert to frontend compatible object
    const mappedRoom = {
        _id: room.id,
        roomId: room.roomId,
        pin: room.pin
    }

    res.status(200).json({
      success: true,
      data: mappedRoom
    });

  } catch (error) {
     res.status(500).json({ success: false, error: error.message });
  }
};
