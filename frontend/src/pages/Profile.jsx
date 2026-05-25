import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Profile = ({ user, onUserUpdate, onLogout }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(user);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', sex: 'male', birth_date: '' });
  const [passwordForm, setPasswordForm] = useState({ password: '', newPassword: '' });
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = () => {
    api.getProfile().then((data) => {
      if (data.user) {
        setProfile(data.user);
        setTwoFaEnabled(data.user.two_factor_enabled);
        setForm({
          name: data.user.name || '',
          sex: data.user.sex || 'male',
          birth_date: data.user.birth_date?.slice(0, 10) || '',
        });
        onUserUpdate?.(data.user);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const sexLabel = profile?.sex === 'female' ? 'Женский' : 'Мужской';

  const calculateAge = (birthDateString) => {
    if (!birthDateString) return '—';
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const body = { ...form };
      if (passwordForm.newPassword) {
        body.password = passwordForm.password;
        body.new_password = passwordForm.newPassword;
      }
      const data = await api.updateProfile(body);
      setProfile(data.user);
      onUserUpdate?.(data.user);
      setEditMode(false);
      setPasswordForm({ password: '', newPassword: '' });
      setMessage('Профиль сохранён');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle2fa = async (enabled) => {
    setError('');
    setMessage('');
    if (!twoFaPassword) {
      setError('Введите пароль для подтверждения');
      return;
    }
    try {
      const data = await api.toggle2fa(enabled, twoFaPassword);
      setTwoFaEnabled(data.two_factor_enabled);
      setMessage(data.message);
      setTwoFaPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Удалить аккаунт безвозвратно? Все записи и фото будут удалены.')) return;
    if (!deletePassword) {
      setError('Введите пароль для удаления аккаунта');
      return;
    }
    setError('');
    try {
      await api.deleteAccount(deletePassword);
      api.clearToken();
      onLogout?.();
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!profile) return <div className="loading">Загрузка...</div>;

  return (
    <div className="profile-page page">
      <h2>Мой профиль</h2>
      {message && <p className="success-message">{message}</p>}
      {error && <div className="error-message">{error}</div>}

      {!editMode ? (
        <div className="profile-card card">
          <p><strong>ФИО:</strong> {profile.name || '—'}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Пол:</strong> {sexLabel}</p>
          <p><strong>Дата рождения:</strong> {new Date(profile.birth_date).toLocaleDateString('ru-RU')}</p>
          <p><strong>Полных лет:</strong> {calculateAge(profile.birth_date)}</p>
          {profile.created_at && (
            <p><strong>С нами с:</strong> {new Date(profile.created_at).toLocaleDateString('ru-RU')}</p>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setEditMode(true)}>
            Редактировать
          </button>
        </div>
      ) : (
        <form className="card profile-card" onSubmit={handleSaveProfile}>
          <label>
            ФИО
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Пол
            <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </label>
          <label>
            Дата рождения
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              required
            />
          </label>
          <h3>Смена пароля (необязательно)</h3>
          <label>
            Текущий пароль
            <input
              type="password"
              value={passwordForm.password}
              onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
            />
          </label>
          <label>
            Новый пароль
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">Сохранить</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <h3>Двухфакторная аутентификация (email)</h3>
        <p className="page-lead">
          Статус: {twoFaEnabled ? 'включена' : 'выключена'}.
          {twoFaEnabled
            ? ' При входе на почту придёт код.'
            : ' Включите — при каждом входе код будет отправляться на email.'}
        </p>
        <label>
          Пароль для подтверждения
          <input
            type="password"
            value={twoFaPassword}
            onChange={(e) => setTwoFaPassword(e.target.value)}
          />
        </label>
        <div className="form-actions">
          {!twoFaEnabled && (
            <button type="button" className="btn btn-primary" onClick={() => handleToggle2fa(true)}>
              Включить 2FA
            </button>
          )}
          {twoFaEnabled && (
            <button type="button" className="btn btn-secondary" onClick={() => handleToggle2fa(false)}>
              Выключить 2FA
            </button>
          )}
        </div>
      </section>

      <section className="card card--danger" style={{ marginTop: 24 }}>
        <h3>Удаление аккаунта</h3>
        <p className="page-lead">
          Будут удалены все приёмы, анализы, прививки и загруженные файлы.
        </p>
        <label>
          Пароль
          <input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
        </label>
        <button type="button" className="btn btn-delete" onClick={handleDeleteAccount}>
          Удалить аккаунт
        </button>
      </section>
    </div>
  );
};

export default Profile;
