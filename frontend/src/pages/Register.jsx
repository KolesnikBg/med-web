import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/register.css';
import { computeRegistrationErrors, useValidation } from '../hooks/useValidation.js';

const FIELD_NAMES = [
  'lastname',
  'name',
  'patronymic',
  'email',
  'birth_date',
  'password',
  'confirmPassword',
];

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    lastname: '',
    patronymic: '',
    email: '',
    password: '',
    confirmPassword: '',
    sex: 'male',
    birth_date: '',
  });

  const [error, setError] = useState('');
  const [serverFieldErrors, setServerFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [consentTouched, setConsentTouched] = useState(false);

  const navigate = useNavigate();
  const { validate } = useValidation(formData);

  const clientErrors = useMemo(() => computeRegistrationErrors(formData), [formData]);
  const formValid = useMemo(() => Object.keys(clientErrors).length === 0, [clientErrors]);

  const mergedErrors = { ...clientErrors, ...serverFieldErrors };
  const canSubmit = formValid && isChecked && !loading;

  const markTouched = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const showFieldFeedback = (name) =>
    Boolean(touched[name] || serverFieldErrors[name]);

  const getFieldClass = (name) => {
    if (!showFieldFeedback(name)) return '';
    if (mergedErrors[name]) return 'field-input-invalid';
    if (name === 'patronymic' && !formData.patronymic?.trim()) return 'field-input-valid';
    if (!formData[name] && name !== 'patronymic') return 'field-input-invalid';
    return 'field-input-valid';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    markTouched(name);
    if (serverFieldErrors[name]) {
      setServerFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    setError('');
  };

  const handleBlur = (e) => {
    markTouched(e.target.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setConsentTouched(true);
    setError('');
    setServerFieldErrors({});

    const { isValid, errors } = validate();
    if (!isValid) {
      setTouched((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.keys(errors).map((k) => [k, true])),
      }));
      return;
    }
    if (!isChecked) return;

    setLoading(true);
    try {
      const data = await api.register({
        name: formData.name,
        lastname: formData.lastname,
        patronymic: formData.patronymic,
        email: formData.email,
        password: formData.password,
        sex: formData.sex,
        birth_date: formData.birth_date,
      });

      if (data.success && data.needs_verification) {
        navigate('/verify-email', {
          state: { email: formData.email, devCode: data.dev_code },
        });
      }
    } catch (err) {
      const apiMessage = err.payload?.message || err.message || '';
      const emailTaken =
        err.status === 409 ||
        /email.*уже|уже.*используется|email.*занят/i.test(apiMessage);

      if (emailTaken) {
        setError('Этот email уже зарегистрирован');
        setServerFieldErrors({ email: 'Этот email уже занят' });
        markTouched('email');
      } else if (err.status === 400) {
        setError(apiMessage || 'Проверьте правильность заполнения формы');
      } else {
        setError(apiMessage || 'Ошибка регистрации. Попробуйте позже');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderFieldError = (name) => {
    if (!showFieldFeedback(name)) {
      return <span className="field-error field-error--placeholder" aria-hidden="true" />;
    }
    const msg = mergedErrors[name];
    return msg ? (
      <span className="field-error">{msg}</span>
    ) : (
      <span className="field-error field-error--placeholder" aria-hidden="true" />
    );
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card--register">
        <h2>Регистрация</h2>
        {/* <p className="auth-subtitle">Корректные поля подсвечиваются зелёным, с ошибками — красным.</p> */}

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} noValidate className="register-form">
          <div className="block">
            <h3>ФИО</h3>
            <div className="form-row">
              <div className="form-group">
                <input
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Фамилия*"
                  className={getFieldClass('lastname')}
                  autoComplete="family-name"
                />
                {renderFieldError('lastname')}
              </div>
              <div className="form-group">
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Имя*"
                  className={getFieldClass('name')}
                  autoComplete="given-name"
                />
                {renderFieldError('name')}
              </div>
              <div className="form-group">
                <input
                  name="patronymic"
                  value={formData.patronymic}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Отчество"
                  className={getFieldClass('patronymic')}
                  autoComplete="additional-name"
                />
                {renderFieldError('patronymic')}
              </div>
            </div>
          </div>

          <div className="block">
            <div className="form-group">
              <h3>Эл. почта</h3>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="example@mail.ru"
                className={getFieldClass('email')}
                autoComplete="email"
              />
              {renderFieldError('email')}
            </div>
          </div>

          <div className="block">
            <div className="form-row-2">
              <div className="form-group">
                <h3>Пол</h3>
                <select
                  name="sex"
                  value={formData.sex}
                  onChange={handleChange}
                  className="field-input-valid"
                >
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
                  onBlur={handleBlur}
                  max={new Date().toISOString().split('T')[0]}
                  className={getFieldClass('birth_date')}
                />
                {renderFieldError('birth_date')}
              </div>
            </div>
          </div>

          <div className="block">
            <div className="form-group">
              <h3>Пароль</h3>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className={getFieldClass('password')}
                autoComplete="new-password"
                placeholder="Минимум 6 символов, буквы и цифры"
              />
              {renderFieldError('password')}
            </div>
          </div>

          <div className="block">
            <div className="form-group">
              <h3>Подтвердите пароль</h3>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                className={getFieldClass('confirmPassword')}
                autoComplete="new-password"
                placeholder="Повторите пароль"
              />
              {renderFieldError('confirmPassword')}
            </div>
          </div>

          <div
            className={`consent-block ${
              consentTouched && !isChecked
                ? 'consent-block--invalid'
                : isChecked
                ? 'consent-block--valid'
                : ''
            }`}
          >
            <label className="consent-label">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  setIsChecked(e.target.checked);
                  setConsentTouched(true);
                }}
              />
              <span>
                Я согласен на обработку персональных данных и с условиями пользовательского соглашения
              </span>
            </label>
            {consentTouched && !isChecked && (
              <span className="field-error">Необходимо согласие для регистрации</span>
            )}
          </div>

          <div className="register-submit-wrap">
            <button
              type="submit"
              disabled={!canSubmit}
              className="register-btn"
              title={!canSubmit ? 'Исправьте ошибки и отметьте согласие' : ''}
            >
              {loading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
            {!canSubmit && !loading && (
              <p className="register-hint">Заполните все поля корректно и подтвердите согласие</p>
            )}
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
