// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Dashboard = ({ user }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const data = await api.getAppointments();
      setAppointments(data.appointments || []);
    } catch (err) {
      console.error('Ошибка загрузки приёмов:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка дашборда...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Привет, {user?.name}!</h1>
      <p className="dashboard-subtitle">
        Здесь собраны ваши недавние приёмы и быстрый доступ к добавлению новых записей.
      </p>

      <div className="quick-actions">
        <Link to="/add-appointment" className="btn btn-primary">+ Новая запись</Link>
        <Link to="/profile" className="btn btn-secondary">Настройки</Link>
      </div>

      <div className="recent-section">
        <h2>Последние приёмы</h2>
        {appointments.length > 0 ? (
          <div className="appointments-list">
            {appointments.slice(0, 5).map((apt) => (
              <div key={apt.id} className="appointment-card">
                <h3>{apt.type}</h3>
                <p><strong>Дата:</strong> {new Date(apt.appointment_date).toLocaleDateString('ru-RU')}</p>
                {apt.description && <p><em>Описание: {apt.description}</em></p>}
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
    </div>
  );
};

export default Dashboard;