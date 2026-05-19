import React, { useEffect, useState } from 'react';
import api from '../services/api';

const Profile = ({ user, onUserUpdate }) => {
  const [profile, setProfile] = useState(user);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [setupUri, setSetupUri] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [togglePassword, setTogglePassword] = useState('');
  const [toggleCode, setToggleCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProfile().then((data) => {
      if (data.user) {
        setProfile(data.user);
        setTwoFaEnabled(data.user.two_factor_enabled);
        onUserUpdate?.(data.user);
      }
    }).catch(() => {});
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

  const handleSetup2fa = async () => {
    setError('');
    try {
      const data = await api.setup2fa();
      setSetupSecret(data.secret);
      setSetupUri(data.otpauth_uri);
      setMessage('Отсканируйте QR в Google Authenticator и введите код ниже');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleConfirm2fa = async () => {
    setError('');
    try {
      await api.confirm2fa(confirmCode);
      setTwoFaEnabled(true);
      setMessage('2FA включена');
      setSetupUri('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle2fa = async (enabled) => {
    setError('');
    try {
      await api.toggle2fa(enabled, togglePassword, toggleCode);
      setTwoFaEnabled(enabled);
      setMessage(enabled ? '2FA включена' : '2FA отключена');
      setTogglePassword('');
      setToggleCode('');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!profile) return <div className="loading">Загрузка...</div>;

  return (
    <div className="profile-page">
      <h2>Мой профиль</h2>
      <div className="profile-card">
        <p><strong>ФИО:</strong> {profile.name}</p>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>Пол:</strong> {sexLabel}</p>
        <p><strong>Дата рождения:</strong> {new Date(profile.birth_date).toLocaleDateString('ru-RU')}</p>
        <p><strong>Полных лет:</strong> {calculateAge(profile.birth_date)}</p>
        {profile.created_at && (
          <p><strong>С нами с:</strong> {new Date(profile.created_at).toLocaleDateString('ru-RU')}</p>
        )}
      </div>

      <section className="recent-section" style={{ marginTop: 24 }}>
        <h2>Двухфакторная аутентификация</h2>
        <p className="dashboard-subtitle">
          Статус: {twoFaEnabled ? 'включена' : 'выключена'}. Можно включить/выключить для проверки.
        </p>
        {message && <p>{message}</p>}
        {error && <div className="error-message">{error}</div>}

        {!twoFaEnabled && !setupUri && (
          <button type="button" className="btn btn-secondary" onClick={handleSetup2fa}>
            Настроить 2FA
          </button>
        )}

        {setupUri && !twoFaEnabled && (
          <div>
            <p><small>Секрет: {setupSecret}</small></p>
            <p><small>URI: {setupUri}</small></p>
            <input
              placeholder="Код из приложения"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
            />
            <button type="button" className="btn btn-primary" onClick={handleConfirm2fa}>
              Подтвердить и включить
            </button>
          </div>
        )}

        <div className="form-row" style={{ marginTop: 16 }}>
          <input
            type="password"
            placeholder="Пароль"
            value={togglePassword}
            onChange={(e) => setTogglePassword(e.target.value)}
          />
          <input
            placeholder="Код 2FA (если включена)"
            value={toggleCode}
            onChange={(e) => setToggleCode(e.target.value)}
          />
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleToggle2fa(true)}
          >
            Включить 2FA
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => handleToggle2fa(false)}
          >
            Выключить 2FA
          </button>
        </div>
      </section>
    </div>
  );
};

export default Profile;
