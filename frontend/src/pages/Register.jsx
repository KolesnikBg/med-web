import React, { useState } from 'react';  // подключение реакт
import { Link, useNavigate } from 'react-router-dom';  // навигация между страницами
import api from '../services/api';  // апи для работы с бэкендом
import '../styles/register.css';  // стили
import { useValidation } from '../hooks/useValidation.js'; // хук 

/*
* ЛОГИКА
*/
const Register = ({ onRegister }) => {

  // данные формы
  const [formData, setFormData] = useState({
    name: '',
    lastname: '',
    patronymic: '',
    email: '',
    password: '',
    confirmPassword: '',
    sex: 'male',
    birth_date: ''
  });

  // общая ошибка (над формой)
  const [error, setError] = useState('');  // текст ошибки для пользователя 

  // ошибки по полям
  const [fieldErrors, setFieldErrors] = useState({});

  // флаг загрузки (блокировка кнопки)
  const [loading, setLoading] = useState(false);

  // навигация (для перехода на другую страницу)
  const navigate = useNavigate();

  // подключение валидации из хука
  const { validate } = useValidation(formData);

  // обработка ввода
  const handleChange = (e) => {

    // берем имя и его значение
    const { name, value } = e.target;

    // обновляем только это поле
    setFormData({ ...formData, [name]: value });

    // очистка ошибку поля при вводе
    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: '' });
    }
  };

  // чекбокс
  const [isChecked, setIsChecked] = useState(false);

  // проверка чекбокса
  const handleCheckboxChange = (event) => {
    setIsChecked(event.target.checked);
  };

  // отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault(); // запрет перезагрузки страницы
    setError('');
    setFieldErrors({});

    // валидация через хук
    const { isValid, errors } = validate();
    if (!isValid) {
      setFieldErrors(errors); // показываем ошибки под полями
      return;
    }

    // отправка на сервер
    setLoading(true); // включение "загрузки"
    try {
      const data = await api.register({ // ждм ответа от бэка
        name: formData.name,
        lastname: formData.lastname,
        patronymic: formData.patronymic,
        email: formData.email,
        password: formData.password,
        sex: formData.sex,
        birth_date: formData.birth_date
      });

      // успех
      if (data.success) {
        onRegister(data.user, data.access_token); // передача данных родителю
        navigate('/'); // переход на главную
      }
    } catch (err) {
      // обработка 409 Conflict и других ошибок
      if (err.status === 409 || err.message?.includes('409')) {
        setError('Этот email уже зарегистрирован');
        setFieldErrors({ email: 'Email занят' }); // подсветка поля
      } else if (err.status === 400) {
        setError('Проверьте правильность заполнения формы');
      } else {
        setError(err.message || 'Ошибка регистрации. Попробуйте позже');
      }
    } finally {
      setLoading(false); // отключаем загрузку 
    }
  };

  /*
  * ОТРИСОВКА 
  */

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Регистрация</h2>

        {/* Общая ошибка */}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} noValidate> {/* отключение валидацию браузера */}

          {/* ФИО */}
          <div className='block'>
            <h3>ФИО</h3>
            <div className="form-row">
              <div className="form-group">
                <input
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleChange}
                  placeholder="Фамилия*"
                  required
                  minLength={2}
                />
                {fieldErrors.lastname && <span className="field-error">{fieldErrors.lastname}</span>}
              </div>
              <div className="form-group">
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Имя*"
                  required
                  minLength={2}
                  pattern="[А-Яа-яA-Za-z\s\-]+" // только буквы, пробелы, дефис
                  title="Только буквы, пробелы и дефис"
                />
                {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
              </div>
              <div className="form-group">
                <input
                  name="patronymic"
                  value={formData.patronymic}
                  onChange={handleChange}
                  placeholder="Отчество"
                  pattern="[А-Яа-яA-Za-z\s\-]+"
                />
                {fieldErrors.patronymic && <span className="field-error">{fieldErrors.patronymic}</span>}
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="block">
            <div className="form-group">
              <h3>Эл. почта</h3>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="example@mail.ru"
                pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$" // ← HTML5-паттерн
                title="Введите корректный email"
                autoComplete="email"
              />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>
          </div>

          {/* Пол + Дата */}
          <div className="block">
            <div className="form-row-2">
              <div className="form-group">
                <h3>Пол</h3>
                <select name="sex" value={formData.sex} onChange={handleChange} required>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </div>
              <div className="form-group">
                <h3>Дата рождения</h3>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  required
                  max={new Date().toISOString().split('T')[0]} // нельзя выбрать будущее
                />
                {fieldErrors.birth_date && <span className="field-error">{fieldErrors.birth_date}</span>}
              </div>
            </div>
          </div>

          {/* Пароль */}
          <div className='block'>
            <div className="form-group">
              <h3>Пароль</h3>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6} //  HTML5-валидация
                pattern="(?=.*[a-zA-Z])(?=.*\d).+" // ← минимум буква + цифра (опционально)
                title="Минимум 6 символов, включая буквы и цифры"
                autoComplete="new-password"
              />
              {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
            </div>
          </div>

          {/* Подтверждение пароля */}
          <div className='block'>
            <div className="form-group">
              <h3>Подтвердите пароль</h3>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}
            </div>
          </div>
          <div className='block'>
            <div className='form-row-3'>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={handleCheckboxChange}
                style={{
                  cursor: 'pointer',
                }} />
              <span>Я согласен на обработку персональных данных и с условиями
                пользовательского соглашения
              </span>
              {/* {isChecked ? "Выбрано" : "Не выбрано"} */}
            </div>
          </div>

          <div className='block'>
            <div className='form-row'>
              <button type="submit" disabled={loading} className='register-btn'>
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            </div>
          </div>
        </form>

        <div className="auth-links">
          <span>Уже есть аккаунт? </span>
          <Link to="/login">Войти</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;