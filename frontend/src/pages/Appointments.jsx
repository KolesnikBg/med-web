import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Attachments from '../components/Attachments';

const emptyFilters = { doctor_id: '', search: '', date_from: '', date_to: '' };

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    doctor_id: '',
    custom_doctor: '',
    appointment_date: '',
    description: '',
    diagnosis: '',
  });
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState('view');
  const [editForm, setEditForm] = useState(null);
  const [editUseCustom, setEditUseCustom] = useState(false);
  const [draftKey, setDraftKey] = useState(() => api.createDraftKey());

  const filteredAppointments = useMemo(() => {
    const q = (filters.search || '').trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((apt) => {
      const hay = [
        apt.doctor_name,
        apt.type,
        apt.description,
        apt.diagnosis,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [appointments, filters.search]);

  const load = async () => {
    setError('');
    try {
      const params = {};
      if (filters.doctor_id) params.doctor_id = filters.doctor_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.search) params.search = filters.search;
      const [data, docRes] = await Promise.all([
        api.getAppointments(params),
        api.getDoctorsList(),
      ]);
      setAppointments(data.appointments || []);
      setDoctors(docRes.doctors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters.doctor_id, filters.date_from, filters.date_to, filters.search]);

  const buildPayload = (data, useCustom, dk) => {
    if (useCustom) {
      return {
        type: data.custom_doctor.trim(),
        appointment_date: data.appointment_date,
        description: data.description,
        diagnosis: data.diagnosis,
        draft_key: dk,
      };
    }
    const doc = doctors.find((d) => String(d.id) === String(data.doctor_id));
    return {
      doctor_id: data.doctor_id ? Number(data.doctor_id) : undefined,
      type: doc?.name,
      appointment_date: data.appointment_date,
      description: data.description,
      diagnosis: data.diagnosis,
      draft_key: dk,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const useCustom = !form.doctor_id;
      const payload = buildPayload(form, useCustom, draftKey);
      if (!payload.type && !payload.doctor_id) {
        setError('Выберите специальность или укажите свою');
        setSaving(false);
        return;
      }
      await api.createAppointment(payload);
      setForm({
        doctor_id: '',
        custom_doctor: '',
        appointment_date: '',
        description: '',
        diagnosis: '',
      });
      setDraftKey(api.createDraftKey());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openViewModal = (apt) => {
    setModalItem(apt);
    setModalMode('view');
    setEditForm(null);
  };

  const openEditModal = (apt) => {
    const match = doctors.find((d) => d.id === apt.doctor_id || d.name === apt.type);
    if (match) {
      setEditUseCustom(false);
      setEditForm({
        doctor_id: String(match.id),
        custom_doctor: '',
        appointment_date: apt.appointment_date,
        description: apt.description || '',
        diagnosis: apt.diagnosis || '',
      });
    } else {
      setEditUseCustom(true);
      setEditForm({
        doctor_id: '',
        custom_doctor: apt.type || apt.doctor_name || '',
        appointment_date: apt.appointment_date,
        description: apt.description || '',
        diagnosis: apt.diagnosis || '',
      });
    }
    setModalMode('edit');
  };

  const saveModalEdit = async () => {
    setSaving(true);
    try {
      const payload = buildPayload(editForm, editUseCustom);
      await api.updateAppointment(modalItem.id, payload);
      setModalItem(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteModalItem = async () => {
    if (!window.confirm('Удалить приём?')) return;
    await api.deleteAppointment(modalItem.id);
    setModalItem(null);
    await load();
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  const showCustomField = !form.doctor_id;
  const showEditCustom = editForm && !editForm.doctor_id;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Приёмы</h1>
        <p className="page-lead">Создание и просмотр записей о приёмах.</p>
      </header>
      <section className="card">
        <h2>Новый приём</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Специальность
              <select
                value={form.doctor_id}
                onChange={(e) => setForm({ ...form, doctor_id: e.target.value, custom_doctor: '' })}
              >
                <option value="">— выберите —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            {showCustomField && (
              <label>
                Или специальность
                <input
                  value={form.custom_doctor}
                  onChange={(e) => setForm({ ...form, custom_doctor: e.target.value })}
                  required={showCustomField}
                  placeholder="Терапевт, кардиолог..."
                />
              </label>
            )}
            <label>
              Дата
              <input type="date" value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })} required />
            </label>
            <label className="span-2">
              Описание
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="span-2">
              Диагноз / рекомендации
              <textarea rows={2} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение...' : 'Добавить'}
          </button>
          <Attachments recordType="appointments" draftKey={draftKey} />
        </form>
      </section>

      <section className="card">
        <h2>История</h2>
        <div className="filters-bar">
          <label>
            Поиск
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Специальность, описание, диагноз..."
            />
          </label>
          <select
            value={filters.doctor_id}
            onChange={(e) => setFilters({ ...filters, doctor_id: e.target.value })}
          >
            <option value="">Все специальности</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}{d.is_global ? '' : ' (мой)'}</option>
            ))}
          </select>
          <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
          <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
          <button type="button" className="btn btn-secondary" onClick={() => setFilters(emptyFilters)}>Сброс</button>
        </div>

        {filteredAppointments.length ? (
          <div className="record-list">
            {filteredAppointments.map((apt) => (
              <article key={apt.id} className="record-card" onClick={() => openViewModal(apt)}>
                <h3>{apt.doctor_name || apt.type}</h3>
                <p>{new Date(apt.appointment_date).toLocaleDateString('ru-RU')}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-text">Нет приёмов.</p>
        )}
      </section>

      {modalItem && (
        <div className="modal-backdrop" onClick={() => setModalItem(null)}>
          <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modalItem.doctor_name || modalItem.type}</div>
              <button type="button" className="modal-close" onClick={() => setModalItem(null)}>×</button>
            </div>
            <div className="modal-body">
              {modalMode === 'view' ? (
                <>
                  <p><strong>Дата:</strong> {new Date(modalItem.appointment_date).toLocaleDateString('ru-RU')}</p>
                  {modalItem.description && <p><strong>Описание:</strong> {modalItem.description}</p>}
                  {modalItem.diagnosis && <p><strong>Диагноз:</strong> {modalItem.diagnosis}</p>}
                  <Attachments recordType="appointments" recordId={modalItem.id} />
                  <div className="modal-actions">
                    <button type="button" className="btn-edit" onClick={() => openEditModal(modalItem)}>Редактировать</button>
                    <button type="button" onClick={() => setModalItem(null)}>Закрыть</button>
                    <button type="button" className="btn-delete" onClick={deleteModalItem}>Удалить</button>
                  </div>
                </>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); saveModalEdit(); }}>
                  <div className="form-grid">
                    <label>
                      Специальность
                      <select
                        value={editForm.doctor_id}
                        onChange={(e) => {
                          setEditForm({ ...editForm, doctor_id: e.target.value, custom_doctor: '' });
                          setEditUseCustom(!e.target.value);
                        }}
                      >
                        <option value="">— выберите —</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </label>
                    {showEditCustom && (
                      <label>
                        Или специальность
                        <input
                          value={editForm.custom_doctor}
                          onChange={(e) => setEditForm({ ...editForm, custom_doctor: e.target.value })}
                          required
                        />
                      </label>
                    )}
                    <label>
                      Дата
                      <input type="date" value={editForm.appointment_date} onChange={(e) => setEditForm({ ...editForm, appointment_date: e.target.value })} required />
                    </label>
                    <label className="span-2">
                      Описание
                      <textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                    </label>
                    <label className="span-2">
                      Диагноз
                      <textarea rows={2} value={editForm.diagnosis} onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value })} />
                    </label>
                  </div>
                  <Attachments recordType="appointments" recordId={modalItem.id} />
                  <div className="modal-actions">
                    <button type="submit" className="btn-primary" disabled={saving}>Сохранить</button>
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

export default Appointments;
