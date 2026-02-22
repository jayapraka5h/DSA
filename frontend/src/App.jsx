import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Room from './pages/Room';

const PrivateRoute = ({ children }) => {
  const { user } = React.useContext(AuthContext);
  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Routes>
             <Route path="/login" element={<Login />} />
             <Route path="/signup" element={<Signup />} />
             <Route path="/" element={
                 <PrivateRoute><Home /></PrivateRoute>
             } />
             <Route path="/room/:roomId" element={
                 <PrivateRoute><Room /></PrivateRoute>
             } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
