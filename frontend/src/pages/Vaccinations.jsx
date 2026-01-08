import React, { useEffect, useState } from 'react';
import api from '../services/api';

// категорий для отображения
const CATEGORY_LABELS = {
  standard: 'Стандартные',
  travel: 'Для путешествий',
  work: 'Профессиональные',
};

const Vaccinations = () => {
  const [form, setForm] = useState({
    vaccine_id: '',
    custom_name: '',
    date_given: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vaccines, setVaccines] = useState([]); // все прививки (справочник)
  const [userVaccinations, setUserVaccinations] = useState([]); // сделанные
  const [listLoading, setListLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [modalItem, setModalItem] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const loadVaccines = async () => {
    setListLoading(true);
    setError('');
    try {
      const vaccinesRes = await api.request('/vaccines', { method: 'GET' });
      const userVaccRes = await api.request('/user/vaccinations', { method: 'GET' });
      setVaccines(vaccinesRes.vaccines || []);
      setUserVaccinations(userVaccRes.vaccinations || []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить прививки');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadVaccines();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Если выбрана прививка из справочника
      const isCustom = !form.vaccine_id;
      const payload = isCustom
        ? {
            custom_name: form.custom_name,
            date_given: form.date_given,
            notes: form.notes,
          }
        : {
            vaccine_id: parseInt(form.vaccine_id),
            date_given: form.date_given,
            notes: form.notes,
          };

      let data;
      if (editingId) {
        window.alert('Редактирование временно недоступно. Удалите и создайте заново.');
        return;
      } else {
        data = await api.request('/user/vaccinations', {
          method: 'POST',
          body: payload,
        });
      }

      if (data.success || (data.id && data.date_given)) {
        setForm({
          vaccine_id: '',
          custom_name: '',
          date_given: '',
          notes: '',
        });
        setEditingId(null);
        await loadVaccines();
      }
    } catch (err) {
      setError(err.message || 'Не удалось сохранить прививку');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить запись о прививке?')) return;
    setError('');
    try {
      await api.request(`/user/vaccinations/${id}`, { method: 'DELETE' });
      if (editingId === id) {
        setEditingId(null);
      }
      await loadVaccines();
    } catch (err) {
      setError(err.message || 'Не удалось удалить прививку');
    }
  };

  // группировка по категориям
  const groupedVaccines = vaccines.reduce((acc, v) => {
    const cat = v.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

  return (
    <div className="dashboard">
      <h1>Прививки</h1>
      <p className="dashboard-subtitle">
        Отмечайте сделанные прививки или добавляйте свои.
      </p>

      <div className="form-page" style={{ marginBottom: 24 }}>
        <h2>{editingId ? 'Редактирование прививки' : 'Новая прививка'}</h2>
        <p className="form-page-subtitle">
          Выберите прививку из списка или укажите свою. Обязательно укажите дату.
        </p>
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Прививка из справочника</label>
            <select
              name="vaccine_id"
              value={form.vaccine_id}
              onChange={handleChange}
            >
              <option value="">— Выберите прививку или добавьте свою —</option>
              {Object.entries(groupedVaccines).map(([category, list]) => (
                <optgroup key={category} label={CATEGORY_LABELS[category] || category}>
                  {list.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {!form.vaccine_id && (
            <div className="form-group">
              <label>Своя прививка *</label>
              <input
                type="text"
                name="custom_name"
                value={form.custom_name}
                onChange={handleChange}
                placeholder="Например: Против клещевого энцефалита"
                required={!form.vaccine_id}
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Дата прививки *</label>
              <input
                type="date"
                name="date_given"
                value={form.date_given}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Заметки</label>
            <textarea
              name="notes"
              rows="3"
              value={form.notes}
              onChange={handleChange}
              placeholder="Побочные эффекты, сертификат и т.д."
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : editingId ? 'Сохранить' : 'Добавить прививку'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    vaccine_id: '',
                    custom_name: '',
                    date_given: '',
                    notes: '',
                  });
                }}
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="recent-section">
        <h2>История прививок</h2>
        {listLoading ? (
          <div className="loading">Загрузка истории прививок...</div>
        ) : userVaccinations.length > 0 ? (
          <div className="appointments-list">
            {userVaccinations.map((item) => (
              <div
                key={item.id}
                className="appointment-card"
                onClick={() => setModalItem(item)}
                style={{ cursor: 'pointer' }}
              >
                <h3>
                  {item.vaccine_name || item.custom_name}
                  {item.custom_name && <span style={{ fontSize: '0.9em', color: '#666' }}> (самостоятельно)</span>}
                </h3>
                <p>
                  <strong>Дата:</strong>{' '}
                  {new Date(item.date_given).toLocaleDateString('ru-RU')}
                </p>
                {item.notes && (
                  <p>
                    <em>Заметка: {item.notes}</em>
                  </p>
                )}
                <div className="form-actions" style={{ marginTop: 10 }}>
                  {/* редачить нельзя,  только удаление */}
                  <button
                    type="button"
                    className="btn-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">Пока нет добавленных прививок.</p>
        )}
      </div>

      {modalItem && (
        <div className="modal-backdrop" onClick={() => setModalItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Детали прививки</div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setModalItem(null)}
              >
                X
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Название:</strong>{' '}
                {modalItem.vaccine_name || modalItem.custom_name}
                {modalItem.custom_name && ' (самостоятельно)'}
              </p>
              <p>
                <strong>Дата:</strong>{' '}
                {new Date(modalItem.date_given).toLocaleDateString('ru-RU')}
              </p>
              {modalItem.notes && (
                <p>
                  <strong>Заметка:</strong> {modalItem.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vaccinations;