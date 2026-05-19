import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import '../styles/register.css';

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.resetPassword(email, code, newPassword);
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Новый пароль</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <h3>Email</h3>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <h3>Код из письма</h3>
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="form-group">
            <h3>Новый пароль</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <button type="submit" className="register-btn" disabled={loading}>
            Сохранить
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">К входу</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
