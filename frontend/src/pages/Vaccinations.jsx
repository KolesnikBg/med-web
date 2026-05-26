import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Attachments from '../components/Attachments';

const CATEGORY_LABELS = {
  standard: 'Стандартные',
  travel: 'Для путешествий',
  work: 'Профессиональные',
  other: 'Прочие',
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
  const [vaccines, setVaccines] = useState([]);
  const [userVaccinations, setUserVaccinations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState('view');
  const [editForm, setEditForm] = useState(null);
  const [filters, setFilters] = useState({ vaccine_id: '', search: '', date_from: '', date_to: '' });
  const [recommendations, setRecommendations] = useState([]);
  const [draftKey, setDraftKey] = useState(() => api.createDraftKey());

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

  const resetCreateForm = () => {
    setForm({ vaccine_id: '', custom_name: '', date_given: '', notes: '' });
    setDraftKey(api.createDraftKey());
  };

  const buildPayload = (data) => {
    if (data.vaccine_id) {
      return {
        vaccine_id: parseInt(data.vaccine_id, 10),
        date_given: data.date_given,
        notes: data.notes,
        draft_key: draftKey,
      };
    }
    return {
      custom_name: data.custom_name,
      date_given: data.date_given,
      notes: data.notes,
      draft_key: draftKey,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!form.vaccine_id && !form.custom_name?.trim()) {
        setError('Выберите прививку или укажите своё название');
        setLoading(false);
        return;
      }
      await api.addUserVaccination(buildPayload(form));
      resetCreateForm();
      await loadVaccines();
    } catch (err) {
      setError(err.message || 'Не удалось сохранить прививку');
    } finally {
      setLoading(false);
    }
  };

  const openViewModal = (item) => {
    setModalItem(item);
    setModalMode('view');
    setEditForm(null);
  };

  const openEditModal = (item) => {
    setModalItem(item);
    setModalMode('edit');
    setEditForm({
      vaccine_id: item.vaccine_id ? String(item.vaccine_id) : '',
      custom_name: item.custom_name || '',
      date_given: item.date_given,
      notes: item.notes || '',
    });
  };

  const saveModalEdit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = editForm.vaccine_id
        ? {
            vaccine_id: parseInt(editForm.vaccine_id, 10),
            date_given: editForm.date_given,
            notes: editForm.notes,
          }
        : {
            custom_name: editForm.custom_name,
            date_given: editForm.date_given,
            notes: editForm.notes,
          };
      await api.updateUserVaccination(modalItem.id, payload);
      setModalItem(null);
      await loadVaccines();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteModalItem = async () => {
    if (!window.confirm('Удалить запись о прививке?')) return;
    try {
      await api.deleteUserVaccination(modalItem.id);
      setModalItem(null);
      await loadVaccines();
    } catch (err) {
      setError(err.message);
    }
  };

  const groupedVaccines = vaccines.reduce((acc, v) => {
    const cat = v.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

  const editUsesCustom = editForm && !editForm.vaccine_id;

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
        <h2>Новая прививка</h2>
        {error && !modalItem && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Прививка из справочника</label>
            <select
              name="vaccine_id"
              value={form.vaccine_id}
              onChange={(e) => setForm((prev) => ({
                ...prev,
                vaccine_id: e.target.value,
                custom_name: e.target.value ? '' : prev.custom_name,
              }))}
            >
              <option value="">— Выберите или добавьте свою —</option>
              {Object.entries(groupedVaccines).map(([category, list]) => (
                <optgroup key={category} label={CATEGORY_LABELS[category] || category}>
                  {list.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
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
                onChange={(e) => setForm((prev) => ({ ...prev, custom_name: e.target.value }))}
                placeholder="Например: Против клещевого энцефалита"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Дата прививки *</label>
            <input
              type="date"
              name="date_given"
              value={form.date_given}
              onChange={(e) => setForm((prev) => ({ ...prev, date_given: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Заметки</label>
            <textarea
              name="notes"
              rows="3"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Побочные эффекты, серия..."
            />
          </div>
          <Attachments recordType="user_vaccinations" draftKey={draftKey} />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Сохранение...' : 'Добавить прививку'}
          </button>
        </form>
      </div>

      <section className="card">
        <h2>История прививок</h2>
        {listLoading ? (
          <div className="loading">Загрузка...</div>
        ) : userVaccinations.length > 0 ? (
          <div className="record-list">
            {userVaccinations.map((item) => (
              <article key={item.id} className="record-card" onClick={() => openViewModal(item)}>
                <h3>{item.vaccine_name || item.custom_name}</h3>
                <p>{new Date(item.date_given).toLocaleDateString('ru-RU')}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-text">Пока нет добавленных прививок.</p>
        )}
      </section>

      {modalItem && (
        <div className="modal-backdrop" onClick={() => setModalItem(null)}>
          <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modalItem.vaccine_name || modalItem.custom_name}</div>
              <button type="button" className="modal-close" onClick={() => setModalItem(null)}>×</button>
            </div>
            <div className="modal-body">
              {error && modalItem && <div className="error-message">{error}</div>}
              {modalMode === 'view' ? (
                <>
                  <p><strong>Дата:</strong> {new Date(modalItem.date_given).toLocaleDateString('ru-RU')}</p>
                  {modalItem.notes && <p><strong>Заметки:</strong> {modalItem.notes}</p>}
                  <Attachments recordType="user_vaccinations" recordId={modalItem.id} />
                  <div className="modal-actions">
                    <button type="button" className="btn-edit" onClick={() => openEditModal(modalItem)}>Редактировать</button>
                    <button type="button" onClick={() => setModalItem(null)}>Закрыть</button>
                    <button type="button" className="btn-delete" onClick={deleteModalItem}>Удалить</button>
                  </div>
                </>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); saveModalEdit(); }}>
                  <div className="form-group">
                    <label>Прививка</label>
                    <select
                      value={editForm.vaccine_id}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        vaccine_id: e.target.value,
                        custom_name: e.target.value ? '' : editForm.custom_name,
                      })}
                    >
                      <option value="">— своя —</option>
                      {vaccines.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  {editUsesCustom && (
                    <div className="form-group">
                      <label>Своя прививка *</label>
                      <input
                        value={editForm.custom_name}
                        onChange={(e) => setEditForm({ ...editForm, custom_name: e.target.value })}
                        required
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Дата *</label>
                    <input
                      type="date"
                      value={editForm.date_given}
                      onChange={(e) => setEditForm({ ...editForm, date_given: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Заметки</label>
                    <textarea
                      rows="3"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </div>
                  <Attachments recordType="user_vaccinations" recordId={modalItem.id} />
                  <div className="modal-actions">
                    <button type="submit" className="btn-primary" disabled={loading}>Сохранить</button>
                    <button type="button" onClick={() => setModalMode('view')}>Отмена</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vaccinations;
