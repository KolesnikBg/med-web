import React from 'react';

const Profile = ({ user }) => {
  const sexLabel = user.sex === 'female' ? 'Женский' : 'Мужской';
  const sexImg = sexLabel === 'Мужской' ? '/man_icon.png': '/woman_icon.png';
  const age = calculateAge(user.birth_date);

  // обработка возраста
  function calculateAge(birthDateString) {
    let birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() < birthDate.getMonth() || 
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
      age--;
  }
  return age;
  }


  return (
    <div className="profile-page">
      <h2>Мой профиль</h2>
      <div className="profile-card">
        <div className="profile-card-img">
          <img src={sexImg}></img>
        </div>
        <p><strong>ФИО:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Пол:</strong> {sexLabel}</p>
        <p><strong>Дата рождения:</strong> {new Date(user.birth_date).toLocaleDateString('ru-RU')}</p>
        <p><strong>Полных лет:</strong> {age}</p>
        <p><strong>С нами с:</strong> {new Date(user.created_at).toLocaleDateString('ru-RU')}</p>
      </div>
    </div>
  );
};

export default Profile;