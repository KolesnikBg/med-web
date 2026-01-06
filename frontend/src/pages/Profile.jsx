// src/pages/Profile.jsx
import React from 'react';

const Profile = ({ user }) => {
  const sexLabel = user.sex === 'female' ? 'Женский' : 'Мужской';

  return (
    <div className="profile-page">
      <h2>Мой профиль</h2>
      <div className="profile-card">
        <p><strong>ФИО:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Пол:</strong> {sexLabel}</p>
        <p><strong>Дата рождения:</strong> {new Date(user.birth_date).toLocaleDateString('ru-RU')}</p>
      </div>
    </div>
  );
};

export default Profile;