import React, { useState } from 'react';
import '../styles/pages.css';

const Settings = () => {
  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: true,
    reminderDays: 1,
    theme: 'light',
    language: 'ru',
    dataExport: false,
    autoBackup: true,
  });

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    alert('Настройки сохранены!');
  };

  const handleReset = () => {
    if (window.confirm('Сбросить все настройки к значениям по умолчанию?')) {
      const defaultSettings = {
        notifications: true,
        emailNotifications: true,
        reminderDays: 1,
        theme: 'light',
        language: 'ru',
        dataExport: false,
        autoBackup: true,
      };
      setSettings(defaultSettings);
      localStorage.removeItem('appSettings');
    }
  };

  const exportData = () => {
    const analyses = JSON.parse(localStorage.getItem('analyses') || '[]');
    const appointments = JSON.parse(localStorage.getItem('appointments') || '[]');
    const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    
    const exportData = {
      analyses,
      appointments,
      profile,
      exportDate: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `medknizhka_export_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    alert('Данные экспортированы в JSON файл!');
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          if (data.analyses) localStorage.setItem('analyses', JSON.stringify(data.analyses));
          if (data.appointments) localStorage.setItem('appointments', JSON.stringify(data.appointments));
          if (data.profile) localStorage.setItem('userProfile', JSON.stringify(data.profile));
          
          alert('Данные успешно импортированы! Перезагрузите страницу.');
        } catch (error) {
          alert('Ошибка при импорте данных. Проверьте файл.');
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  };

  const clearAllData = () => {
    if (window.confirm('ВНИМАНИЕ! Это удалит все ваши данные. Продолжить?')) {
      if (window.confirm('Точно удалить ВСЕ данные? Это действие нельзя отменить.')) {
        localStorage.removeItem('analyses');
        localStorage.removeItem('appointments');
        localStorage.removeItem('userProfile');
        alert('Все данные удалены. Приложение будет перезагружено.');
        window.location.reload();
      }
    }
  };

  return (
    <div className="settings-page">
      <h1 className="page-title">Настройки</h1>

      <div className="settings-sections">
        {/* Уведомления */}
        <div className="settings-section">
          <h2>🔔 Уведомления</h2>
          
          <div className="setting-item">
            <div className="setting-info">
              <h3>Push-уведомления</h3>
              <p>Получать уведомления в браузере</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => handleChange('notifications', e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Email-уведомления</h3>
              <p>Отправлять напоминания на email</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => handleChange('emailNotifications', e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Напоминания о приемах</h3>
              <p>За сколько дней напоминать о приеме</p>
            </div>
            <select
              value={settings.reminderDays}
              onChange={(e) => handleChange('reminderDays', parseInt(e.target.value))}
              className="setting-select"
            >
              <option value={1}>За 1 день</option>
              <option value={2}>За 2 дня</option>
              <option value={3}>За 3 дня</option>
              <option value={7}>За неделю</option>
            </select>
          </div>
        </div>

        {/* Внешний вид */}
        <div className="settings-section">
          <h2>🎨 Внешний вид</h2>
          
          <div className="setting-item">
            <div className="setting-info">
              <h3>Тема</h3>
              <p>Выберите цветовую тему приложения</p>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
              className="setting-select"
            >
              <option value="light">Светлая</option>
              <option value="dark">Темная</option>
              <option value="auto">Авто</option>
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Язык</h3>
              <p>Язык интерфейса</p>
            </div>
            <select
              value={settings.language}
              onChange={(e) => handleChange('language', e.target.value)}
              className="setting-select"
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        {/* Данные */}
        <div className="settings-section">
          <h2>💾 Данные</h2>
          
          <div className="setting-item">
            <div className="setting-info">
              <h3>Авто-бэкап</h3>
              <p>Автоматически создавать резервные копии</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.autoBackup}
                onChange={(e) => handleChange('autoBackup', e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="data-actions">
            <button className="data-btn export" onClick={exportData}>
              📤 Экспорт данных
            </button>
            
            <button className="data-btn import" onClick={importData}>
              📥 Импорт данных
            </button>
            
            <button className="data-btn clear" onClick={clearAllData}>
              🗑️ Очистить все данные
            </button>
          </div>
        </div>

        {/* Информация */}
        <div className="settings-section">
          <h2>ℹ️ О приложении</h2>
          
          <div className="about-info">
            <div className="about-item">
              <span className="about-label">Версия:</span>
              <span className="about-value">1.0.0</span>
            </div>
            
            <div className="about-item">
              <span className="about-label">Разработчик:</span>
              <span className="about-value">МедКнижка Team</span>
            </div>
            
            <div className="about-item">
              <span className="about-label">Лицензия:</span>
              <span className="about-value">MIT License</span>
            </div>
            
            <div className="about-item">
              <span className="about-label">Поддержка:</span>
              <span className="about-value">support@medknizhka.ru</span>
            </div>
            
            <div className="about-item">
              <span className="about-label">Обновлено:</span>
              <span className="about-value">15.01.2024</span>
            </div>
          </div>
          
          <div className="privacy-links">
            <a href="/privacy" className="privacy-link">Политика конфиденциальности</a>
            <a href="/terms" className="privacy-link">Условия использования</a>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button className="action-btn save" onClick={handleSave}>
          💾 Сохранить настройки
        </button>
        
        <button className="action-btn reset" onClick={handleReset}>
          🔄 Сбросить настройки
        </button>
      </div>
    </div>
  );
};

export default Settings;