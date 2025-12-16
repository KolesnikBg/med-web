import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    totalAppointments: 0
  });
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Получаем статистику
      const statsResponse = await fetch('http://localhost:5000/api/dashboard/stats?user_id=1');
      const statsData = await statsResponse.json();
      
      // Получаем анализы
      const analysesResponse = await fetch('http://localhost:5000/api/analyses?user_id=1');
      const analysesData = await analysesResponse.json();
      
      // Получаем приемы
      const appointmentsResponse = await fetch('http://localhost:5000/api/appointments?user_id=1');
      const appointmentsData = await appointmentsResponse.json();
      
      setStats(statsData.stats || { totalAnalyses: 0, totalAppointments: 0 });
      setRecentAnalyses(statsData.recent_analyses || []);
      setUpcomingAppointments(statsData.upcoming_appointments || []);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка данных...</div>;
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Добро пожаловать, {user?.name}!</h1>
      
      {/* Статистика */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🩸</div>
          <div className="stat-info">
            <h3>Всего анализов</h3>
            <p className="stat-number">{stats.totalAnalyses}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-info">
            <h3>Приемы врачей</h3>
            <p className="stat-number">{stats.totalAppointments}</p>
          </div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="quick-actions">
        <h2>Быстрые действия</h2>
        <div className="actions-grid">
          <Link to="/analysis" className="action-card">
            <span className="action-icon">➕</span>
            <span className="action-text">Добавить анализ</span>
          </Link>
          
          <Link to="/appointments" className="action-card">
            <span className="action-icon">📝</span>
            <span className="action-text">Запись к врачу</span>
          </Link>
        </div>
      </div>

      {/* Последние анализы */}
      <div className="recent-section">
        <div className="section-header">
          <h2>Последние анализы</h2>
          <Link to="/analysis" className="view-all">Все анализы →</Link>
        </div>
        
        {recentAnalyses.length > 0 ? (
          <div className="analyses-list">
            {recentAnalyses.map((analysis) => (
              <div key={analysis.id} className="analysis-item">
                <div className="analysis-type">{analysis.type}</div>
                <div className="analysis-date">{analysis.date}</div>
                <div className="analysis-result">
                  {analysis.result} {analysis.unit}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Анализы еще не добавлены</p>
            <Link to="/analysis" className="add-btn">Добавить первый анализ</Link>
          </div>
        )}
      </div>

      {/* Ближайшие приемы */}
      <div className="recent-section">
        <div className="section-header">
          <h2>Ближайшие приемы</h2>
          <Link to="/appointments" className="view-all">Все приемы →</Link>
        </div>
        
        {upcomingAppointments.length > 0 ? (
          <div className="appointments-list">
            {upcomingAppointments.map((appointment) => (
              <div key={appointment.id} className="appointment-item">
                <div className="appointment-doc">{appointment.doctor}</div>
                <div className="appointment-specialty">{appointment.specialty}</div>
                <div className="appointment-date">
                  {new Date(appointment.start_time).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>Ближайших приемов нет</p>
            <Link to="/appointments" className="add-btn">Записаться к врачу</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;