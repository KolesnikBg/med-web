import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Analysis = () => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    type: '',
    date: new Date().toISOString().split('T')[0],
    result: '',
    unit: '',
    norm_min: '',
    norm_max: '',
    doctor: '',
    notes: ''
  });

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/analyses?user_id=1');
      const data = await response.json();
      setAnalyses(data.analyses || []);
    } catch (error) {
      console.error('Ошибка загрузки анализов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:5000/api/analyses', {
        method: 'POST',
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
        setFormData({
          type: '',
          date: new Date().toISOString().split('T')[0],
          result: '',
          unit: '',
          norm_min: '',
          norm_max: '',
          doctor: '',
          notes: ''
        });
        fetchAnalyses(); // Обновляем список
      } else {
        alert(data.message || 'Ошибка сохранения');
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

  if (loading) {
    return <div className="loading">Загрузка анализов...</div>;
  }

  return (
    <div className="analysis-page">
      <div className="page-header">
        <h1>Мои анализы</h1>
        <button className="add-btn" onClick={() => setShowForm(true)}>
          + Добавить анализ
        </button>
      </div>

      {/* Форма добавления */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Новый анализ</h2>
              <button onClick={() => setShowForm(false)} className="close-btn">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="analysis-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Тип анализа *</label>
                  <input
                    type="text"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Дата *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Результат *</label>
                  <input
                    type="text"
                    name="result"
                    value={formData.result}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Единица измерения</label>
                  <input
                    type="text"
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    placeholder="ммоль/л, мг/дл"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Норма (мин)</label>
                  <input
                    type="number"
                    name="norm_min"
                    value={formData.norm_min}
                    onChange={handleChange}
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Норма (макс)</label>
                  <input
                    type="number"
                    name="norm_max"
                    value={formData.norm_max}
                    onChange={handleChange}
                    step="0.01"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Врач</label>
                <input
                  type="text"
                  name="doctor"
                  value={formData.doctor}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label>Примечания</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)}>
                  Отмена
                </button>
                <button type="submit" className="primary-btn">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Список анализов */}
      {analyses.length > 0 ? (
        <div className="analysis-list">
          {analyses.map((analysis) => (
            <div key={analysis.id} className="analysis-card">
              <div className="analysis-header">
                <h3>{analysis.type}</h3>
                <span className="analysis-date">{analysis.date}</span>
              </div>
              <div className="analysis-content">
                <div className="analysis-result">
                  <strong>Результат:</strong> {analysis.result} {analysis.unit}
                </div>
                {analysis.norm_min && analysis.norm_max && (
                  <div className="analysis-norm">
                    <strong>Норма:</strong> {analysis.norm_min} - {analysis.norm_max} {analysis.unit}
                  </div>
                )}
                {analysis.doctor && (
                  <div className="analysis-doctor">
                    <strong>Врач:</strong> {analysis.doctor}
                  </div>
                )}
                {analysis.notes && (
                  <div className="analysis-notes">
                    <strong>Примечания:</strong> {analysis.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🩺</div>
          <h3>Анализы не найдены</h3>
          <p>Добавьте свой первый анализ</p>
          <button className="primary-btn" onClick={() => setShowForm(true)}>
            Добавить анализ
          </button>
        </div>
      )}
    </div>
  );
};

export default Analysis;