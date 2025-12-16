import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    start_time: '',
    end_time: '',
    doctor: '',
    specialty: '',
    location: '',
    status: 'scheduled',
    notes: ''
  });

  // Стандартные специализации врачей
  const specialties = [
    'Терапевт',
    'Хирург',
    'Кардиолог',
    'Невролог',
    'Эндокринолог',
    'Офтальмолог',
    'Отоларинголог',
    'Гинеколог',
    'Уролог',
    'Дерматолог',
    'Ортопед',
    'Педиатр'
  ];

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/appointments?user_id=1');
      const data = await response.json();
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
      alert('Ошибка загрузки записей. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let url = 'http://localhost:5000/api/appointments';
      let method = 'POST';
      
      if (editingId) {
        url = `http://localhost:5000/api/appointments/${editingId}`;
        method = 'PUT';
      }
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: 1,
          ...formData
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setShowForm(false);
        setEditingId(null);
        resetForm();
        fetchAppointments(); // Обновляем список
        alert(data.message || 'Запись сохранена!');
      } else {
        alert(data.message || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка соединения с сервером');
    }
  };

  const handleEdit = (appointment) => {
    setFormData({
      title: appointment.title,
      start_time: formatDateTimeForInput(appointment.start_time),
      end_time: formatDateTimeForInput(appointment.end_time),
      doctor: appointment.doctor || '',
      specialty: appointment.specialty || '',
      location: appointment.location || '',
      status: appointment.status || 'scheduled',
      notes: appointment.notes || ''
    });
    setEditingId(appointment.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить эту запись?')) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/appointments/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (response.ok) {
        fetchAppointments(); // Обновляем список
        alert(data.message || 'Запись удалена!');
      } else {
        alert(data.message || 'Ошибка удаления');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка соединения с сервером');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      start_time: '',
      end_time: '',
      doctor: '',
      specialty: '',
      location: '',
      status: 'scheduled',
      notes: ''
    });
    setEditingId(null);
  };

  const formatDateTimeForInput = (datetime) => {
    if (!datetime) return '';
    // Преобразуем дату из формата БД в формат для input[type="datetime-local"]
    const date = new Date(datetime);
    return date.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
  };

  const formatDateTimeForDisplay = (datetime) => {
    if (!datetime) return '';
    const date = new Date(datetime);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'scheduled': return 'var(--status-scheduled, #007bff)';
      case 'completed': return 'var(--status-completed, #28a745)';
      case 'canceled': return 'var(--status-canceled, #dc3545)';
      default: return 'var(--status-default, #6c757d)';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'scheduled': return 'Запланирован';
      case 'completed': return 'Завершен';
      case 'canceled': return 'Отменен';
      default: return status;
    }
  };

  if (loading) {
    return <div className="loading">Загрузка записей...</div>;
  }

  return (
    <div className="appointments-page">
      <div className="page-header">
        <h1>Приемы врачей</h1>
        <button 
          className="add-btn" 
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          + Новая запись
        </button>
      </div>

      {/* Форма добавления/редактирования */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingId ? 'Редактировать запись' : 'Новая запись к врачу'}</h2>
              <button 
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }} 
                className="close-btn"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="appointment-form">
              <div className="form-group">
                <label>Название приема *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Например: Консультация кардиолога"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Начало *</label>
                  <input
                    type="datetime-local"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Окончание *</label>
                  <input
                    type="datetime-local"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Врач</label>
                  <input
                    type="text"
                    name="doctor"
                    value={formData.doctor}
                    onChange={handleChange}
                    placeholder="ФИО врача"
                  />
                </div>
                <div className="form-group">
                  <label>Специальность</label>
                  <select
                    name="specialty"
                    value={formData.specialty}
                    onChange={handleChange}
                  >
                    <option value="">Выберите специальность</option>
                    {specialties.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Место приема</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="Поликлиника, адрес"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Статус</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="scheduled">Запланирован</option>
                    <option value="completed">Завершен</option>
                    <option value="canceled">Отменен</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Примечания</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Натощак, взять с собой..."
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="secondary-btn"
                >
                  Отмена
                </button>
                <button type="submit" className="primary-btn">
                  {editingId ? 'Обновить' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Список записей */}
      {appointments.length > 0 ? (
        <div className="appointments-list">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="appointment-card">
              <div className="appointment-header">
                <div className="appointment-main">
                  <h3>{appointment.title}</h3>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(appointment.status) }}
                  >
                    {getStatusText(appointment.status)}
                  </span>
                </div>
                <div className="appointment-time">
                  {formatDateTimeForDisplay(appointment.start_time)}
                </div>
              </div>
              
              <div className="appointment-content">
                {(appointment.doctor || appointment.specialty) && (
                  <div className="appointment-info">
                    {appointment.doctor && (
                      <div className="info-item">
                        <strong>Врач:</strong> {appointment.doctor}
                      </div>
                    )}
                    {appointment.specialty && (
                      <div className="info-item">
                        <strong>Специальность:</strong> {appointment.specialty}
                      </div>
                    )}
                  </div>
                )}
                
                {appointment.location && (
                  <div className="appointment-location">
                    <strong>Место:</strong> {appointment.location}
                  </div>
                )}
                
                {appointment.notes && (
                  <div className="appointment-notes">
                    <strong>Примечания:</strong> {appointment.notes}
                  </div>
                )}
              </div>
              
              <div className="appointment-actions">
                <button 
                  onClick={() => handleEdit(appointment)}
                  className="action-btn edit-btn"
                >
                  ✏️ Редактировать
                </button>
                <button 
                  onClick={() => handleDelete(appointment.id)}
                  className="action-btn delete-btn"
                >
                  🗑️ Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">👨‍⚕️</div>
          <h3>Записей к врачам нет</h3>
          <p>Добавьте вашу первую запись на прием</p>
          <button 
            className="primary-btn" 
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            Добавить запись
          </button>
        </div>
      )}
    </div>
  );
};

export default Appointments;