import React, { useState, useEffect } from 'react';
import '../styles/pages.css';

const Profile = () => {
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    bloodType: '',
    allergies: '',
    chronicDiseases: '',
    emergencyContact: '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    // Загрузка данных пользователя
    const savedUser = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const defaultUser = {
      name: 'Иван Иванов',
      email: 'user@example.com',
      phone: '+7 (999) 123-45-67',
      birthDate: '1985-05-15',
      bloodType: 'A(II) Rh+',
      allergies: 'Пенициллин, пыльца',
      chronicDiseases: 'Гипертония',
      emergencyContact: '+7 (999) 987-65-43 (Супруга)',
    };
    
    setUserData({ ...defaultUser, ...savedUser });
  }, []);

  const handleSave = () => {
    localStorage.setItem('userProfile', JSON.stringify(userData));
    setIsEditing(false);
    alert('Данные сохранены!');
  };

  const handlePasswordChange = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Новые пароли не совпадают');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      alert('Пароль должен быть не менее 6 символов');
      return;
    }
    alert('Пароль изменен!');
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  return (
    <div className="profile-page">
      <h1 className="page-title">Мой профиль</h1>

      <div className="profile-sections">
        {/* Личная информация */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Личная информация</h2>
            {!isEditing ? (
              <button className="edit-btn" onClick={() => setIsEditing(true)}>
                ✏️ Редактировать
              </button>
            ) : (
              <button className="save-btn" onClick={handleSave}>
                💾 Сохранить
              </button>
            )}
          </div>

          <div className="profile-info">
            <div className="info-row">
              <label>ФИО:</label>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.name}
                  onChange={(e) => setUserData({...userData, name: e.target.value})}
                  className="edit-input"
                />
              ) : (
                <span>{userData.name}</span>
              )}
            </div>

            <div className="info-row">
              <label>Email:</label>
              {isEditing ? (
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({...userData, email: e.target.value})}
                  className="edit-input"
                />
              ) : (
                <span>{userData.email}</span>
              )}
            </div>

            <div className="info-row">
              <label>Телефон:</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={userData.phone}
                  onChange={(e) => setUserData({...userData, phone: e.target.value})}
                  className="edit-input"
                />
              ) : (
                <span>{userData.phone}</span>
              )}
            </div>

            <div className="info-row">
              <label>Дата рождения:</label>
              {isEditing ? (
                <input
                  type="date"
                  value={userData.birthDate}
                  onChange={(e) => setUserData({...userData, birthDate: e.target.value})}
                  className="edit-input"
                />
              ) : (
                <span>{userData.birthDate}</span>
              )}
            </div>

            <div className="info-row">
              <label>Группа крови:</label>
              {isEditing ? (
                <select
                  value={userData.bloodType}
                  onChange={(e) => setUserData({...userData, bloodType: e.target.value})}
                  className="edit-input"
                >
                  <option value="">Выберите группу крови</option>
                  <option value="O(I) Rh+">O(I) Rh+</option>
                  <option value="O(I) Rh-">O(I) Rh-</option>
                  <option value="A(II) Rh+">A(II) Rh+</option>
                  <option value="A(II) Rh-">A(II) Rh-</option>
                  <option value="B(III) Rh+">B(III) Rh+</option>
                  <option value="B(III) Rh-">B(III) Rh-</option>
                  <option value="AB(IV) Rh+">AB(IV) Rh+</option>
                  <option value="AB(IV) Rh-">AB(IV) Rh-</option>
                </select>
              ) : (
                <span>{userData.bloodType}</span>
              )}
            </div>

            <div className="info-row">
              <label>Аллергии:</label>
              {isEditing ? (
                <textarea
                  value={userData.allergies}
                  onChange={(e) => setUserData({...userData, allergies: e.target.value})}
                  className="edit-textarea"
                  placeholder="Перечислите аллергии через запятую"
                />
              ) : (
                <span>{userData.allergies}</span>
              )}
            </div>

            <div className="info-row">
              <label>Хронические заболевания:</label>
              {isEditing ? (
                <textarea
                  value={userData.chronicDiseases}
                  onChange={(e) => setUserData({...userData, chronicDiseases: e.target.value})}
                  className="edit-textarea"
                  placeholder="Перечислите хронические заболевания"
                />
              ) : (
                <span>{userData.chronicDiseases}</span>
              )}
            </div>

            <div className="info-row">
              <label>Экстренный контакт:</label>
              {isEditing ? (
                <input
                  type="text"
                  value={userData.emergencyContact}
                  onChange={(e) => setUserData({...userData, emergencyContact: e.target.value})}
                  className="edit-input"
                  placeholder="Имя и телефон"
                />
              ) : (
                <span>{userData.emergencyContact}</span>
              )}
            </div>
          </div>
        </div>

        {/* Смена пароля */}
        <div className="profile-section">
          <h2>Безопасность</h2>
          <div className="password-form">
            <div className="form-group">
              <label>Текущий пароль:</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                className="password-input"
              />
            </div>

            <div className="form-group">
              <label>Новый пароль:</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="password-input"
              />
            </div>

            <div className="form-group">
              <label>Подтвердите пароль:</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="password-input"
              />
            </div>

            <button className="change-password-btn" onClick={handlePasswordChange}>
              Сменить пароль
            </button>
          </div>
        </div>

        {/* Статистика профиля */}
        <div className="profile-section">
          <h2>Статистика</h2>
          <div className="profile-stats">
            <div className="profile-stat">
              <div className="stat-number">24</div>
              <div className="stat-label">Анализов за год</div>
            </div>
            <div className="profile-stat">
              <div className="stat-number">8</div>
              <div className="stat-label">Посещений врачей</div>
            </div>
            <div className="profile-stat">
              <div className="stat-number">95%</div>
              <div className="stat-label">Показателей в норме</div>
            </div>
            <div className="profile-stat">
              <div className="stat-number">365</div>
              <div className="stat-label">Дней с приложением</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;