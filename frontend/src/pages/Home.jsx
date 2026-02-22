import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const { user, logout } = useContext(AuthContext);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ title: '', description: '', difficulty: 'Medium', tags: '' });
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await axios.get('/questions');
      setQuestions(res.data.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      const tagsArray = newQuestion.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      await axios.post('/questions', { ...newQuestion, tags: tagsArray });
      setShowCreateModal(false);
      setNewQuestion({ title: '', description: '', difficulty: 'Medium', tags: '' });
      fetchQuestions();
    } catch (err) {
      alert('Failed to create question: ' + (err.response?.data?.error || err.message));
    }
  };

  const createRoom = async (questionId = null) => {
    try {
      const payload = questionId ? { questionId } : {};
      const res = await axios.post('/rooms', payload);
      navigate(`/room/${res.data.data.roomId}`, { state: { pin: res.data.data.pin } });
    } catch (err) {
      console.error('Room Creation Error:', err);
      alert('Failed to create room: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    const roomId = e.target.roomId.value;
    const pin = e.target.pin.value;
    
    axios.post('/rooms/join', { roomId, pin })
      .then(() => navigate(`/room/${roomId}`, { state: { pin } }))
      .catch((err) => alert(err.response?.data?.error || 'Failed to join room'));
  };

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="nav-brand">DSA Study Rooms</div>
        <div className="nav-user">
          <span className="username">Welcome, {user.username}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="sidebar-actions">
           <div className="action-card">
              <h3>Join a Room</h3>
              <form onSubmit={handleJoinRoom} className="join-form">
                <input type="text" name="roomId" placeholder="Room ID" required />
                <input type="text" name="pin" placeholder="PIN" required />
                <button type="submit" className="primary-btn w-full mt-2">Join</button>
              </form>
           </div>
           <div className="action-card mt-4">
              <h3>Custom Practice</h3>
              <p className="text-sm text-muted mb-4">Start a blank room without a question</p>
              <button onClick={() => createRoom()} className="secondary-btn w-full">Create Blank Room</button>
           </div>
        </div>

        <div className="questions-feed">
          <div className="feed-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>DSA Practice Questions</h2>
            <button onClick={() => setShowCreateModal(true)} className="primary-btn small">Create Question</button>
          </div>
          
          {loading ? (
            <p>Loading questions...</p>
          ) : questions.length === 0 ? (
            <div className="empty-state">No questions found.</div>
          ) : (
            <div className="questions-grid">
              {questions.map(q => (
                <div key={q._id} className="question-card">
                  <div className="q-header">
                    <span className={`difficulty badge-${q.difficulty.toLowerCase()}`}>
                      {q.difficulty}
                    </span>
                  </div>
                  <h3>{q.title}</h3>
                  <p className="q-desc">{q.description.substring(0, 100)}...</p>
                  <div className="q-tags">
                     {q.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                  </div>
                  <div className="q-footer mt-4">
                     <button onClick={() => createRoom(q._id)} className="primary-btn">Solve in Room</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Question Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Create New Question</h3>
            <form onSubmit={handleCreateQuestion}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={newQuestion.title} onChange={e => setNewQuestion({...newQuestion, title: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows="4" value={newQuestion.description} onChange={e => setNewQuestion({...newQuestion, description: e.target.value})} required></textarea>
              </div>
              <div className="form-group">
                <label>Difficulty</label>
                <select value={newQuestion.difficulty} onChange={e => setNewQuestion({...newQuestion, difficulty: e.target.value})}>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div className="form-group">
                <label>Tags (Comma separated)</label>
                <input type="text" placeholder="e.g. Arrays, Sorting" value={newQuestion.tags} onChange={e => setNewQuestion({...newQuestion, tags: e.target.value})} />
              </div>
              <div className="modal-actions mt-4" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="secondary-btn">Cancel</button>
                <button type="submit" className="primary-btn">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Home;
