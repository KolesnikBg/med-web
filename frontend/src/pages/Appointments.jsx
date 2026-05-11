import React, { useEffect, useState } from 'react';
import api from '../services/api';

const emptyForm = {
  type: 'Терапевт',
  appointment_date: '',
  description: '',
  diagnosis: '',
};

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalItem, setModalItem] = useState(null);

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

  useEffect(() => {
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingId) {
        const data = await api.updateAppointment(editingId, form);
        if (data.success) {
          setEditingId(null);
          setForm(emptyForm);
          await load();
        }
      } else {
        const data = await api.createAppointment(form);
        if (data.success) {
          setForm(emptyForm);
          await load();
        }
      }
    } catch (err) {
      setError(err.message || 'Не удалось сохранить приём');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (apt) => {
    setEditingId(apt.id);
    setForm({
      type: apt.type || 'Терапевт',
      appointment_date: apt.appointment_date || '',
      description: apt.description || '',
      diagnosis: apt.diagnosis || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот приём?')) return;
    setError('');
    try {
      const data = await api.deleteAppointment(id);
      if (data.success) {
        if (editingId === id) {
          setEditingId(null);
          setForm(emptyForm);
        }
        await load();
      }
    } catch (err) {
      setError(err.message || 'Не удалось удалить приём');
    }
  };

  if (loading) {
    return <div className="loading">Загрузка списка приёмов...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Все приёмы</h1>
      <p className="dashboard-subtitle">
        История ваших визитов к врачам и форма для добавления новых записей.
      </p>

      <div className="form-page" style={{ marginBottom: 24 }}>
        <h2>{editingId ? 'Редактирование приёма' : 'Новый приём'}</h2>
        <p className="form-page-subtitle">
          Укажите специалиста, дату и детали визита. Можно изменить или удалить запись в любое время.
        </p>
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Специалист *</label>
              <select
                name="type"
                value={form.type}
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
                value={form.appointment_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Цель визита / Описание</label>
            <textarea
              name="description"
              rows="3"
              value={form.description}
              onChange={handleChange}
              placeholder="Почему идёте к врачу?"
            />
          </div>

          <div className="form-group">
            <label>Диагноз или рекомендации</label>
            <textarea
              name="diagnosis"
              rows="3"
              value={form.diagnosis}
              onChange={handleChange}
              placeholder="Что сказал врач?"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? 'Сохранение...'
                : editingId
                ? 'Сохранить изменения'
                : 'Добавить приём'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Отмена редактирования
              </button>
            )}
          </div>
        </form>
      </div>

      {appointments.length > 0 ? (
        <div className="recent-section">
          <h2>История приёмов</h2>
          <div className="appointments-list">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="appointment-card"
                onClick={() => setModalItem(apt)}
                style={{ cursor: 'pointer' }}
              >
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
                <div className="form-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(apt);
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(apt.id);
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty-text">Пока нет ни одного приёма.</p>
      )}

      {modalItem && (
        <div className="modal-backdrop" onClick={() => setModalItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Детали приёма</div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalItem(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Специалист:</strong> {modalItem.type}
              </p>
              <p>
                <strong>Дата:</strong>{' '}
                {new Date(modalItem.appointment_date).toLocaleDateString('ru-RU')}
              </p>
              {modalItem.description && (
                <p>
                  <strong>Описание:</strong> {modalItem.description}
                </p>
              )}
              {modalItem.diagnosis && (
                <p>
                  <strong>Диагноз / рекомендации:</strong> {modalItem.diagnosis}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
