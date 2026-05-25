import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/register.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await api.forgotPassword(email);
      setInfo(
        data.message + (data.dev_code ? ` Код: ${data.dev_code}` : '')
      );
      setTimeout(() => {
        navigate('/reset-password', { state: { email } });
      }, 1500);
    } catch (err) {
      if (err.payload?.email_not_found) {
        setError('Пользователь с такой почтой не зарегистрирован');
      } else {
        setError(err.message);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Сброс пароля</h2>
        {error && <div className="error-message">{error}</div>}
        {info && <p>{info}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <h3>Email</h3>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button type="submit" className="register-btn">Отправить код</button>
        </form>
        <div className="auth-links">
          <Link to="/login">Назад</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
