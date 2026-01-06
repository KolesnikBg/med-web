// src/pages/Appointments.jsx
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const data = await api.getAppointments();
        setAppointments(data.appointments || []);
      } catch (err) {
        setError(err.message || 'Не удалось загрузить приёмы');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="loading">Загрузка списка приёмов...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Все приёмы</h1>
      <p className="dashboard-subtitle">
        История ваших визитов к врачам в хронологическом порядке.
      </p>

      {error && <div className="error-message">{error}</div>}

      {appointments.length > 0 ? (
        <div className="recent-section">
          <div className="appointments-list">
            {appointments.map((apt) => (
              <div key={apt.id} className="appointment-card">
                <h3>{apt.type}</h3>
                <p>
                  <strong>Дата:</strong>{' '}
                  {new Date(apt.appointment_date).toLocaleDateString('ru-RU')}
                </p>
                {apt.description && (
                  <p>
                    <em>Описание: {apt.description}</em>
                  </p>
                )}
                {apt.diagnosis && (
                  <p>
                    <strong>Диагноз:</strong> {apt.diagnosis}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-text">Пока нет ни одного приёма.</p>
      )}
    </div>
  );
};

export default Appointments;


