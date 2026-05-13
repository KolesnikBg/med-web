import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Calendar from '../components/Calendar/Calendar';

// Справочник рекомендуемых прививок по возрасту (можно вынести в конфиг)
const VACCINE_SCHEDULE = [
  { age: 0, vaccine: 'Гепатит B' },
  { age: 2, vaccine: 'Пневмококковая' },
  { age: 3, vaccine: 'Корь, Краснуха, Свинка' },
  { age: 6, vaccine: 'Полиомиелит (ревакцинация)' },
  { age: 14, vaccine: 'Дифтерия, Столбняк (ревакцинация)' },
  { age: 18, vaccine: 'Грипп (ежегодно)' },
  { age: 60, vaccine: 'Пневмококковая (для пожилых)' },
];

const Dashboard = ({ user }) => {
  const [appointments, setAppointments] = useState([]);
  const [analyses, setAnalyses] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [recommendedVaccines, setRecommendedVaccines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Расчёт возраста из birth_date
  const calculateAge = (birthDateString) => {
    if (!birthDateString) return null;
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [aptData, analData, vaccData, allVaccinesData] = await Promise.all([
        api.getAppointments(),
        api.getAnalyses(),
        api.request('/user/vaccinations', { method: 'GET' }),
        api.request('/vaccines', { method: 'GET' })
      ]);

      setAppointments(aptData.appointments || []);
      setAnalyses(analData.analyses || []);
      setVaccinations(vaccData.vaccinations || []);

      // Рассчитываем рекомендуемые прививки
      const userAge = calculateAge(user?.birth_date);
      const doneVaccineNames = new Set(
        vaccData.vaccinations
          .filter(v => v.vaccine_name)
          .map(v => v.vaccine_name)
      );
      const customVaccineNames = new Set(
        vaccData.vaccinations
          .filter(v => v.custom_name)
          .map(v => v.custom_name)
      );

      let recommendations = [];
      if (userAge !== null) {
        // Находим прививки, рекомендованные по возрасту, но ещё не сделанные
        recommendations = VACCINE_SCHEDULE
          .filter(item => item.age <= userAge)
          .map(item => item.vaccine)
          .filter(vaccineName => 
            !doneVaccineNames.has(vaccineName) && 
            !customVaccineNames.has(vaccineName)
          );
        
        // Убираем дубликаты
        recommendations = [...new Set(recommendations)];
      }

      // Также добавляем прививки из справочника, которые не в графике, но важны
      const allVaccineNames = new Set(allVaccinesData.vaccines.map(v => v.name));
      const allDone = new Set([...doneVaccineNames, ...customVaccineNames]);
      const extraRecommendations = allVaccinesData.vaccines
        .filter(v => !allDone.has(v.name) && !recommendations.includes(v.name))
        .map(v => v.name)
        .slice(0, 3); // не более 3 доп. рекомендаций

      setRecommendedVaccines([...recommendations, ...extraRecommendations].slice(0, 5));
    } catch (err) {
      console.error('Ошибка загрузки дашборда:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка дашборда...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Привет, {user?.name}</h1>
      <p className="dashboard-subtitle">
        Здесь собраны ваши недавние приёмы, анализы и прививки.
      </p>

      <div className="App">
      <Calendar />
    </div>

      <div className="quick-actions">
        <Link to="/add-appointment" className="btn btn-primary">+ Добавить прием</Link>
        <Link to="/analysis" className="btn btn-secondary">+ Добавить анализ</Link>
        <Link to="/vaccinations" className="btn btn-ternary">+ Добавить прививку</Link>
      </div>

      {/* Приёмы */}
      <div className="recent-section">
        <h2>Последние приёмы</h2>
        {appointments.length > 0 ? (
          <div className="appointments-list">
            {appointments.slice(0, 5).map((apt) => (
              <div key={apt.id} className="appointment-card">
                <h3>{apt.type || apt.title}</h3>
                <p>
                  <strong>Дата:</strong>{' '}
                  {new Date(apt.appointment_date || apt.start_time).toLocaleDateString('ru-RU')}
                </p>
                {(apt.description || apt.notes) && <p><em>{apt.description || apt.notes}</em></p>}
                {apt.diagnosis && <p><strong>Диагноз:</strong> {apt.diagnosis}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">
            Нет записей. <Link to="/add-appointment">Добавьте первую</Link>
          </p>
        )}
      </div>

      {/* Анализы */}
      <div className="recent-section" style={{ marginTop: 16 }}>
        <h2>Недавние анализы</h2>
        {analyses.length > 0 ? (
          <div className="appointments-list">
            {analyses.slice(0, 5).map((item) => (
              <div key={item.id} className="appointment-card">
                <h3>{item.type}</h3>
                <p>
                  <strong>Дата:</strong>{' '}
                  {new Date(item.analysis_date || item.date).toLocaleDateString('ru-RU')}
                </p>
                <p>
                  <strong>Значение:</strong> {item.value || item.result} {item.unit}
                </p>
                {item.notes && (
                  <p>
                    <em>Комментарий: {item.notes}</em>
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">
            Нет анализов. <Link to="/analysis">Добавьте первый</Link>
          </p>
        )}
      </div>

      {/* Прививки */}
      <div className="recent-section" style={{ marginTop: 16 }}>
        <h2>Недавние прививки</h2>
        {vaccinations.length > 0 ? (
          <div className="appointments-list">
            {vaccinations
              .slice(0, 5)
              .map((v) => (
                <div key={v.id} className="appointment-card">
                  <h3>{v.vaccine_name || v.custom_name}{v.custom_name && ' (самостоятельно)'}</h3>
                  <p>
                    <strong>Дата:</strong>{' '}
                    {new Date(v.date_given).toLocaleDateString('ru-RU')}
                  </p>
                  {v.notes && <p><em>Заметка: {v.notes}</em></p>}
                </div>
              ))}
          </div>
        ) : (
          <p className="empty-text">
            Нет прививок. <Link to="/vaccinations">Добавьте первую</Link>
          </p>
        )}
      </div>

      {/* Рекомендуемые прививки */}
      {recommendedVaccines.length > 0 && (
        <div className="recent-section" style={{ marginTop: 16 }}>
          <h2>Рекомендуемые прививки</h2>
          <div className="appointments-list">
            {recommendedVaccines.map((name, idx) => (
              <div key={idx} className="appointment-card">
                <h3>{name}</h3>
                <p>Рекомендуется по возрасту или статусу</p>
                <Link to="/vaccinations" className="btn-link">Отметить как сделанную</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;