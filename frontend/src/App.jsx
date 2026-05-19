import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Analysis from './pages/Analysis';
import Profile from './pages/Profile';
import Vaccinations from './pages/Vaccinations';
import Admin from './pages/Admin';
import Header from './components/Header';
import Footer from './components/Footer';
import './styles/global.css';
import api from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('med_token');
    const savedUser = localStorage.getItem('med_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('med_user', JSON.stringify(userData));
    localStorage.setItem('med_token', token);
    api.setToken(token);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('med_user');
    localStorage.removeItem('med_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const handleUserUpdate = (updated) => {
    localStorage.setItem('med_user', JSON.stringify(updated));
    setUser(updated);
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  const AdminRoute = ({ children }) => {
    if (!user?.is_admin) return <Navigate to="/" />;
    return children;
  };

  return (
    <Router>
      <div className="app">
        {isAuthenticated && (
          <Header user={user} onLogout={handleLogout} />
        )}
        <div className="main-content">
          <Routes>
            <Route path="/login" element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
            <Route path="/verify-email" element={!isAuthenticated ? <VerifyEmail onLogin={handleLogin} /> : <Navigate to="/" />} />
            <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/" />} />
            <Route path="/reset-password" element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/" />} />
            <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/appointments" element={isAuthenticated ? <Appointments /> : <Navigate to="/login" />} />
            <Route path="/add-appointment" element={isAuthenticated ? <Navigate to="/appointments" /> : <Navigate to="/login" />} />
            <Route path="/analysis" element={isAuthenticated ? <Analysis /> : <Navigate to="/login" />} />
            <Route path="/profile" element={isAuthenticated ? <Profile user={user} onUserUpdate={handleUserUpdate} /> : <Navigate to="/login" />} />
            <Route path="/vaccinations" element={isAuthenticated ? <Vaccinations /> : <Navigate to="/login" />} />
            <Route
              path="/admin"
              element={
                isAuthenticated ? (
                  <AdminRoute><Admin /></AdminRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
          </Routes>
        </div>
        {isAuthenticated && <Footer user={user} onLogout={handleLogout} />}
      </div>
    </Router>
  );
}

export default App;
