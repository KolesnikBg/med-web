import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Attachments from '../components/Attachments';

const emptyFilters = { doctor_id: '', date_from: '', date_to: '' };

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
  const [useCustomDoctor, setUseCustomDoctor] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeRecordId, setActiveRecordId] = useState(null);
  const [modalItem, setModalItem] = useState(null);

  const load = async () => {
    setError('');
    try {
      const params = {};
      if (filters.doctor_id) params.doctor_id = filters.doctor_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
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
  }, [filters]);

  const buildPayload = () => {
    if (useCustomDoctor) {
      return {
        doctor_name: form.custom_doctor.trim(),
        appointment_date: form.appointment_date,
        description: form.description,
        diagnosis: form.diagnosis,
      };
    }
    const doc = doctors.find((d) => String(d.id) === String(form.doctor_id));
    return {
      doctor_id: form.doctor_id ? Number(form.doctor_id) : undefined,
      type: doc?.name,
      appointment_date: form.appointment_date,
      description: form.description,
      diagnosis: form.diagnosis,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload();
      if (!payload.doctor_name && !payload.doctor_id && !payload.type) {
        setError('Выберите или введите врача');
        setSaving(false);
        return;
      }
      if (editingId) {
        await api.updateAppointment(editingId, payload);
        setActiveRecordId(editingId);
      } else {
        const res = await api.createAppointment(payload);
        const id = res.appointment?.id;
        setEditingId(id);
        setActiveRecordId(id);
      }
      setForm({
        doctor_id: '',
        custom_doctor: '',
        appointment_date: '',
        description: '',
        diagnosis: '',
      });
      setUseCustomDoctor(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (apt) => {
    setEditingId(apt.id);
    setActiveRecordId(apt.id);
    const match = doctors.find((d) => d.id === apt.doctor_id || d.name === apt.type);
    if (match) {
      setUseCustomDoctor(false);
      setForm({
        doctor_id: String(match.id),
        custom_doctor: '',
        appointment_date: apt.appointment_date,
        description: apt.description || '',
        diagnosis: apt.diagnosis || '',
      });
    } else {
      setUseCustomDoctor(true);
      setForm({
        doctor_id: '',
        custom_doctor: apt.type || apt.doctor_name || '',
        appointment_date: apt.appointment_date,
        description: apt.description || '',
        diagnosis: apt.diagnosis || '',
      });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить приём?')) return;
    await api.deleteAppointment(id);
    if (editingId === id) {
      setEditingId(null);
      setActiveRecordId(null);
    }
    await load();
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Приёмы</h1>
        <p className="page-lead">Врачи из справочника или свой врач. Фото и файлы — после сохранения записи.</p>
      </header>

      <div className="filters-bar">
        <select
          value={filters.doctor_id}
          onChange={(e) => setFilters({ ...filters, doctor_id: e.target.value })}
        >
          <option value="">Все врачи</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.name}{d.is_global ? '' : ' (мой)'}</option>
          ))}
        </select>
        <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
        <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
        <button type="button" className="btn btn-secondary" onClick={() => setFilters(emptyFilters)}>Сброс</button>
      </div>

      <section className="card">
        <h2>{editingId ? 'Редактирование' : 'Новый приём'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="checkbox-row">
              <input type="checkbox" checked={useCustomDoctor} onChange={(e) => setUseCustomDoctor(e.target.checked)} />
              Свой врач (если нет в списке)
            </label>
            {useCustomDoctor ? (
              <label>
                ФИО / специальность
                <input
                  value={form.custom_doctor}
                  onChange={(e) => setForm({ ...form, custom_doctor: e.target.value })}
                  required
                />
              </label>
            ) : (
              <label>
                Врач
                <select
                  value={form.doctor_id}
                  onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
                  required
                >
                  <option value="">— выберите —</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
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
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <Attachments recordType="appointments" recordId={activeRecordId || editingId} />
        </form>
      </section>

      <section className="card">
        <h2>История</h2>
        {appointments.length ? (
          <div className="record-list">
            {appointments.map((apt) => (
              <article key={apt.id} className="record-card" onClick={() => setModalItem(apt)}>
                <h3>{apt.doctor_name || apt.type}</h3>
                <p>{new Date(apt.appointment_date).toLocaleDateString('ru-RU')}</p>
                <div className="record-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn btn-secondary" onClick={() => handleEdit(apt)}>Изменить</button>
                  <button type="button" className="btn-link" onClick={() => handleDelete(apt.id)}>Удалить</button>
                </div>
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
              <p><strong>Дата:</strong> {new Date(modalItem.appointment_date).toLocaleDateString('ru-RU')}</p>
              {modalItem.description && <p>{modalItem.description}</p>}
              {modalItem.diagnosis && <p><strong>Диагноз:</strong> {modalItem.diagnosis}</p>}
              <Attachments recordType="appointments" recordId={modalItem.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
