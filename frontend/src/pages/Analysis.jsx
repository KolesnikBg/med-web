// src/pages/Analysis.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const TYPE_CONFIG = {
  'Кровь': { unit: 'г/л', placeholder: 'Например, 130' },
  'Давление': { unit: 'мм рт. ст.', placeholder: 'Например, 120/80' },
  'Гормоны': { unit: 'мЕд/л', placeholder: 'Например, 2.5' },
};

const Analysis = () => {
  const [form, setForm] = useState({
    type: 'Кровь',
    analysis_date: '',
    unit: TYPE_CONFIG['Кровь'].unit,
    value: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [modalItem, setModalItem] = useState(null);

  const currentConfig = useMemo(
    () => TYPE_CONFIG[form.type] || TYPE_CONFIG['Кровь'],
    [form.type]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'type') {
      const nextType = value;
      const cfg = TYPE_CONFIG[nextType] || TYPE_CONFIG['Кровь'];
      setForm((prev) => ({
        ...prev,
        type: nextType,
        unit: cfg.unit,
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const loadAnalyses = async () => {
    setListLoading(true);
    setError('');
    try {
      const data = await api.getAnalyses();
      setAnalyses(data.analyses || []);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить анализы');
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadAnalyses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        type: form.type,
        analysis_date: form.analysis_date,
        unit: form.unit,
        value: form.value,
        notes: form.notes,
      };

      let data;
      if (editingId) {
        data = await api.updateAnalysis(editingId, payload);
      } else {
        data = await api.createAnalysis(payload);
      }

      if (data.success) {
        setForm((prev) => ({
          ...prev,
          analysis_date: '',
          value: '',
          notes: '',
        }));
        setEditingId(null);
        await loadAnalyses();
      }
    } catch (err) {
      setError(err.message || 'Не удалось сохранить анализ');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      type: item.type,
      analysis_date: item.analysis_date,
      unit: item.unit,
      value: item.value,
      notes: item.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить этот анализ?')) return;
    setError('');
    try {
      const data = await api.deleteAnalysis(id);
      if (data.success) {
        if (editingId === id) {
          setEditingId(null);
        }
        await loadAnalyses();
      }
    } catch (err) {
      setError(err.message || 'Не удалось удалить анализ');
    }
  };

  return (
    <div className="dashboard">
      <h1>Анализы</h1>
      <p className="dashboard-subtitle">
        Сохраняйте результаты ключевых анализов и отслеживайте динамику.
      </p>

      <div className="form-page" style={{ marginBottom: 24 }}>
        <h2>{editingId ? 'Редактирование анализа' : 'Новый анализ'}</h2>
        <p className="form-page-subtitle">
          Выберите тип анализа, дату и введите значение. Единица измерения
          подставится автоматически.
        </p>
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Тип анализа *</label>
              <select name="type" value={form.type} onChange={handleChange} required>
                <option value="Кровь">Кровь</option>
                <option value="Давление">Давление</option>
                <option value="Гормоны">Гормоны</option>
              </select>
            </div>
            <div className="form-group">
              <label>Дата сдачи *</label>
              <input
                type="date"
                name="analysis_date"
                value={form.analysis_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Значение *</label>
              <input
                name="value"
                value={form.value}
                onChange={handleChange}
                placeholder={currentConfig.placeholder}
                required
              />
            </div>
            <div className="form-group">
              <label>Единица измерения *</label>
              <input
                name="unit"
                value={form.unit}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Комментарий врача / заметка</label>
            <textarea
              name="notes"
              rows="3"
              value={form.notes}
              onChange={handleChange}
              placeholder="Например: анализ в норме, пересдать через 6 месяцев"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? 'Сохранение...'
                : editingId
                ? 'Сохранить изменения'
                : 'Добавить анализ'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    type: 'Кровь',
                    analysis_date: '',
                    unit: TYPE_CONFIG['Кровь'].unit,
                    value: '',
                    notes: '',
                  });
                }}
              >
                Отмена редактирования
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="recent-section">
        <h2>История анализов</h2>
        {listLoading ? (
          <div className="loading">Загрузка истории анализов...</div>
        ) : analyses.length > 0 ? (
          <div className="appointments-list">
            {analyses.map((item) => (
              <div
                key={item.id}
                className="appointment-card"
                onClick={() => setModalItem(item)}
                style={{ cursor: 'pointer' }}
              >
                <h3>{item.type}</h3>
                <p>
                  <strong>Дата:</strong>{' '}
                  {new Date(item.analysis_date).toLocaleDateString('ru-RU')}
                </p>
                <p>
                  <strong>Значение:</strong> {item.value} {item.unit}
                </p>
                {item.notes && (
                  <p>
                    <em>Комментарий: {item.notes}</em>
                  </p>
                )}
                <div className="form-actions" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(item);
                    }}
                  >
                    Редактировать
                  </button>
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
          <p className="empty-text">Пока нет сохранённых анализов.</p>
        )}
      </div>

      {modalItem && (
        <div className="modal-backdrop" onClick={() => setModalItem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Детали анализа</div>
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
                <strong>Тип:</strong> {modalItem.type}
              </p>
              <p>
                <strong>Дата:</strong>{' '}
                {new Date(modalItem.analysis_date).toLocaleDateString('ru-RU')}
              </p>
              <p>
                <strong>Значение:</strong> {modalItem.value} {modalItem.unit}
              </p>
              {modalItem.notes && (
                <p>
                  <strong>Комментарий:</strong> {modalItem.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;


