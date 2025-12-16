import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Appointments from './pages/Appointments';
import Profile from './pages/Profile';
import Header from './components/Header';
import './styles/global.css';
import './styles/pages.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем, есть ли сохраненный пользователь
    const savedUser = localStorage.getItem('med_user');
    const savedToken = localStorage.getItem('med_token');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('med_user', JSON.stringify(userData));
    localStorage.setItem('med_token', token);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('med_user');
    localStorage.removeItem('med_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <Router>
      <div className="app">
        {isAuthenticated && <Header user={user} onLogout={handleLogout} />}
        <div className="main-content">
          <Routes>
            <Route 
              path="/login" 
              element={
                !isAuthenticated ? 
                <Login onLogin={handleLogin} /> : 
                <Navigate to="/" />
              } 
            />
            
            <Route 
              path="/" 
              element={
                isAuthenticated ? 
                <Dashboard user={user} /> : 
                <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/analysis" 
              element={
                isAuthenticated ? 
                <Analysis user={user} /> : 
                <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/appointments" 
              element={
                isAuthenticated ? 
                <Appointments user={user} /> : 
                <Navigate to="/login" />
              } 
            />
            
            <Route 
              path="/profile" 
              element={
                isAuthenticated ? 
                <Profile user={user} /> : 
                <Navigate to="/login" />
              } 
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;