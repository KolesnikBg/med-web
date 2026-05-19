import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Attachments from '../components/Attachments';

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
  const [activeRecordId, setActiveRecordId] = useState(null);
  const [modalItem, setModalItem] = useState(null);
  const [filters, setFilters] = useState({ vaccine_id: '', search: '', date_from: '', date_to: '' });
  const [recommendations, setRecommendations] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const loadVaccines = async () => {
    setListLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.vaccine_id) params.vaccine_id = filters.vaccine_id;
      if (filters.search) params.search = filters.search;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const [vaccinesRes, userVaccRes, recRes] = await Promise.all([
        api.getVaccines(),
        api.getUserVaccinations(params),
        api.getVaccinationRecommendations(),
      ]);
      setVaccines(vaccinesRes.vaccines || []);
      setUserVaccinations(userVaccRes.vaccinations || []);
      setRecommendations(recRes.recommendations || []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить прививки');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadVaccines();
  }, [filters]);

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

      const wasEdit = Boolean(editingId);
      let data;
      if (wasEdit) {
        data = await api.updateUserVaccination(editingId, payload);
        setActiveRecordId(editingId);
      } else {
        data = await api.addUserVaccination(payload);
        const id = data.vaccination?.id;
        setEditingId(id);
        setActiveRecordId(id);
      }

      if (data.success) {
        if (wasEdit) {
          setForm({ vaccine_id: '', custom_name: '', date_given: '', notes: '' });
          setEditingId(null);
          setActiveRecordId(null);
        }
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
    <div className="page">
      <header className="page-header">
        <h1>Прививки</h1>
        <p className="page-lead">Фильтры, напоминания и фото к каждой записи.</p>
      </header>

      <div className="filters-bar">
        <select value={filters.vaccine_id} onChange={(e) => setFilters({ ...filters, vaccine_id: e.target.value })}>
          <option value="">Все прививки</option>
          {vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <input placeholder="Поиск" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
        <button type="button" className="btn btn-secondary" onClick={() => setFilters({ vaccine_id: '', search: '', date_from: '', date_to: '' })}>Сброс</button>
      </div>

      {recommendations.length > 0 && (
        <section className="card card--hint">
          <h2>Рекомендуется</h2>
          <ul className="simple-list">
            {recommendations.map((r, i) => (
              <li key={i}><strong>{r.vaccine_name}</strong> — {r.reason}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="card">
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
          <Attachments recordType="user_vaccinations" recordId={activeRecordId || editingId} />
        </form>
      </div>

      <section className="card">
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
                <div className="record-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingId(item.id);
                      setActiveRecordId(item.id);
                      setForm({
                        vaccine_id: item.vaccine_id ? String(item.vaccine_id) : '',
                        custom_name: item.custom_name || '',
                        date_given: item.date_given,
                        notes: item.notes || '',
                      });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Изменить
                  </button>
                  <button type="button" className="btn-link" onClick={() => handleDelete(item.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">Пока нет добавленных прививок.</p>
        )}
      </section>

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
              <Attachments recordType="user_vaccinations" recordId={modalItem.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vaccinations;