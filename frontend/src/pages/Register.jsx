import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Register = ({ onRegister }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    birthDate: '',
    sexType: '',
    bloodType: '',
    allergies: '',
    emergencyContact: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sexType = ['мужской', 'женский']

  const bloodTypes = [
    'O(I) Rh+',
    'O(I) Rh-',
    'A(II) Rh+',
    'A(II) Rh-',
    'B(III) Rh+',
    'B(III) Rh-',
    'AB(IV) Rh+',
    'AB(IV) Rh-'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // проверка email
  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Введите корректный email адрес');
      return false;
    }

    // проверка пароля
    if (formData.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return false;
    }

    // подтвердение пароля
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают!');
      return false;
    }

    // проверка имени
    if (formData.name.trim().length < 2) {
      setError('Введите ваше ФИО!');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          birth_date: formData.birthDate || null,
          sex_type: formData.sexType || null
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Ошибка регистрации');
      }

      if (data.success) {
        localStorage.setItem('med_user', JSON.stringify(data.user));
        localStorage.setItem('med_token', 'demo-token');  // временный токен
        
        if (onRegister) {
          onRegister(data.user, 'demo-token');
        }
        
        // идем на главную
        navigate('/');
      } else {
        setError(data.message || 'Ошибка регистрации');
      }
    } catch (err) {
      setError(err.message || 'Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Регистрация в МедКнижке</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-section">
            <h3 className="form-section-title">Основная информация</h3>
            
            <div className="form-group">
              <label htmlFor="name">ФИО*</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Иванов Иван Иванович"
                className="form-input"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email*</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="ваш@email.com"
                className="form-input"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="birthDate">Дата рождения</label>
                <input
                  type="date"
                  id="birthDate"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            

            <div className="form-group">
                <label htmlFor="sexType">Пол</label>
                <select
                  type="password"
                  id="sexType"
                  name="sexType"
                  value={formData.sexType}
                  onChange={handleChange}
                  placeholder=""
                  className="form-input"
                  required
                >
                <option value="">Выберите ваш пол</option>
                  {sexType.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Пароль*</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder=""
                  className="form-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">Подтвердите пароль*</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder=""
                  className="form-input"
                  required
                />
              </div>
            </div>
        </div>
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="login-btn"
              disabled={loading}
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </div>
        </form>
        
        <div className="login-links">
          <span>Уже есть аккаунт?</span>
          <Link to="/login" className="register-link">Войти</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;