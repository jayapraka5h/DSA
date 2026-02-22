const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initDb } = require('./db');
const authRoutes = require('./routes/authRoutes');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use('/api/auth', authRoutes);
const questionRoutes = require('./routes/questionRoutes');
app.use('/api/questions', questionRoutes);
const solutionRoutes = require('./routes/solutionRoutes');
app.use('/api/solutions', solutionRoutes);
const roomRoutes = require('./routes/roomRoutes');
app.use('/api/rooms', roomRoutes);

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // We will restrict this in production
    methods: ['GET', 'POST']
  }
});

// Temporary in-memory store for room state -> { roomId: { editorSocketId: string, participants: [{ socketId, username, role }] } }
const roomState = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join_room', async ({ roomId, username, userId }) => {
    socket.join(roomId);

    if (!roomState.has(roomId)) {
      roomState.set(roomId, { editorSocketId: socket.id, participants: [], question: null });
      
      // Fetch the associated question from SQLite when initializing the room in memory
      try {
        const { getDb } = require('./db');
        const db = getDb();
        const roomRow = await db.get('SELECT question_id FROM rooms WHERE roomId = ?', [roomId]);
        
        if (roomRow && roomRow.question_id) {
           const question = await db.get('SELECT * FROM questions WHERE id = ?', [roomRow.question_id]);
           if (question) {
               const tagsRows = await db.all('SELECT tag FROM question_tags WHERE question_id = ?', [question.id]);
               question.tags = tagsRows.map(t => t.tag);
               roomState.get(roomId).question = question;
           }
        }
      } catch (err) {
          console.error("Error fetching room question:", err);
      }
    }

    const room = roomState.get(roomId);
    
    // First person to join gets the 'Owner' and 'Editor' role logically
    const isFirst = room.participants.length === 0;
    const role = isFirst ? 'Owner' : 'Viewer';

    // If editor left and someone joins, or if this is the first, set them as editor
    if (!room.editorSocketId || isFirst) {
        room.editorSocketId = socket.id;
    }

    room.participants.push({ socketId: socket.id, username, userId, role });
    
    console.log(`User ${username} joined ${roomId} as ${role}`);

    // Let the new user know who is currently the editor, and their own role
    socket.emit('room_info', { 
        editorSocketId: room.editorSocketId,
        participants: room.participants,
        yourRole: role,
        socketId: socket.id,
        question: room.question
    });

    // Broadcast updated participant list to everyone else
    socket.to(roomId).emit('user_joined', { 
        username,
        socketId: socket.id,
        role,
        participants: room.participants
    });
  });

  socket.on('code_change', ({ roomId, code }) => {
    const room = roomState.get(roomId);
    // Enforce read-only: Only the current editor can broadcast code changes
    if (room && room.editorSocketId === socket.id) {
       socket.to(roomId).emit('receive_code', { code });
    }
  });

  socket.on('request_control', ({ roomId, username }) => {
    const room = roomState.get(roomId);
    if (room && room.editorSocketId) {
       // Send the request specifically to the current editor
       io.to(room.editorSocketId).emit('control_requested', { username, requesterSocketId: socket.id });
    }
  });

  socket.on('transfer_control', ({ roomId, newEditorSocketId }) => {
    const room = roomState.get(roomId);
    // Only the current editor can give up control
    if (room && room.editorSocketId === socket.id) {
        room.editorSocketId = newEditorSocketId;
        // Broadcast the new editor to everyone so UIs can lock/unlock
        io.to(roomId).emit('editor_changed', { newEditorSocketId });
    }
  });

  socket.on('send_message', ({ roomId, username, message }) => {
    io.to(roomId).emit('receive_message', { username, message });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Cleanup room state if a user leaves
    roomState.forEach((room, roomId) => {
        const participantIndex = room.participants.findIndex(p => p.socketId === socket.id);
        
        if (participantIndex !== -1) {
            const username = room.participants[participantIndex].username;
            room.participants.splice(participantIndex, 1);
            
            // If the editor left, reassign control to the next person, or null if empty
            if (room.editorSocketId === socket.id) {
                room.editorSocketId = room.participants.length > 0 ? room.participants[0].socketId : null;
                io.to(roomId).emit('editor_changed', { newEditorSocketId: room.editorSocketId });
            }
            
            io.to(roomId).emit('user_left', { 
                username, 
                socketId: socket.id,
                participants: room.participants 
            });

            // Clean up empty rooms from memory
            if (room.participants.length === 0) {
                roomState.delete(roomId);
            }
        }
    });
  });
});

const PORT = process.env.PORT || 5000;

initDb().then(() => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
