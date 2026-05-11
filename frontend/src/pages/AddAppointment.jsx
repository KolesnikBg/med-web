import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AddAppointment = () => {
  const [formData, setFormData] = useState({
    type: 'Терапевт',
    appointment_date: '',
    description: '',
    diagnosis: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.createAppointment({
        type: formData.type,
        appointment_date: formData.appointment_date,
        description: formData.description,
        diagnosis: formData.diagnosis
      });

      if (data.success) {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Не удалось создать запись');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <h2>Новая запись к врачу</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Специалист *</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            required
          >
            <option value="Терапевт">Терапевт</option>
            <option value="Стоматолог">Стоматолог</option>
            <option value="Травматолог">Травматолог</option>
            <option value="Кардиолог">Кардиолог</option>
            <option value="Окулист">Окулист</option>
            <option value="Дерматолог">Дерматолог</option>
            <option value="Эндокринолог">Эндокринолог</option>
            <option value="Невролог">Невролог</option>
          </select>
        </div>

        <div className="form-group">
          <label>Дата приёма *</label>
          <input
            type="date"
            name="appointment_date"
            value={formData.appointment_date}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Цель визита / Описание</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            placeholder="Почему идёте к врачу?"
          />
        </div>

        <div className="form-group">
          <label>Диагноз или рекомендации</label>
          <textarea
            name="diagnosis"
            value={formData.diagnosis}
            onChange={handleChange}
            rows="3"
            placeholder="Что сказал врач?"
          />
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Сохранение...' : 'Добавить приём'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-link"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddAppointment;