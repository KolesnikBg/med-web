const API_URL = 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('med_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('med_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('med_token');
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const config = { ...options, headers: this.getHeaders() };
    if (options.body) config.body = JSON.stringify(options.body);

    const res = await fetch(url, config);

    // прочитаем один раз, чтобы использовать для разных веток
    const payload = await res.json().catch(() => ({}));
    const message = payload?.msg || payload?.message;

    // токен отсутствует/неверный(JWT 401)
    if (res.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      throw new Error(message || 'Сессия истекла. Войдите снова');
    }

    // JWT 422
    if (res.status === 422) {
      if (message && /authorization|token|jwt|signature|expired|subject/i.test(message)) {
        this.clearToken();
        window.location.href = '/login';
        throw new Error('Сессия истекла. Войдите снова');
      }
      throw new Error(message || 'Ошибка 422');
    }

    if (!res.ok) {
      throw new Error(message || `Ошибка ${res.status}`);
    }

    return payload;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    if (data.success && data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async register(userData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: userData
    });
    if (data.success && data.access_token) {
      this.setToken(data.access_token);
    }
    return data;
  }

  async getProfile() {
    return this.request('/user/profile');
  }

  async getAppointments() {
    return this.request('/appointments');
  }

  async createAppointment(appointment) {
    return this.request('/appointments', {
      method: 'POST',
      body: appointment
    });
  }

  async updateAppointment(id, updates) {
    return this.request(`/appointments/${id}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async deleteAppointment(id) {
    return this.request(`/appointments/${id}`, {
      method: 'DELETE',
    });
  }

  async getAnalyses() {
    return this.request('/analyses');
  }

  async createAnalysis(analysis) {
    return this.request('/analyses', {
      method: 'POST',
      body: analysis
    });
  }

  async updateAnalysis(id, updates) {
    return this.request(`/analyses/${id}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async deleteAnalysis(id) {
    return this.request(`/analyses/${id}`, {
      method: 'DELETE',
    });
  }

   async getVaccines(showAll = false) {
    const query = showAll ? '?all=true' : '';
    return this.request(`/vaccines${query}`);
  }

  async getUserVaccinations() {
    return this.request('/user/vaccinations');
  }

  async addUserVaccination(vaccinationData) {
    return this.request('/user/vaccinations', {
      method: 'POST',
      body: vaccinationData
    });
  }

  async deleteUserVaccination(id) {
    return this.request(`/user/vaccinations/${id}`, {
      method: 'DELETE'
    });
  }

    // ============ 📅 КАЛЕНДАРЬ ============

  /**
   * Получить все события для календаря (приёмы + анализы + прививки)
   * @returns {Promise<{success: boolean, events: Array}>}
   */
  async getCalendarEvents() {
    return this.request('/calendar/events');
  }

  /**
   * Добавить событие в календарь (универсальный метод)
   * @param {Object} eventData - { table, title, date, description, extra? }
   * @returns {Promise<{success: boolean, id: string}>}
   */
  async addCalendarEvent(eventData) {
    return this.request('/calendar/events', {
      method: 'POST',
      body: eventData
    });
  }

  /**
   * Удалить событие из календаря по таблице и ID
   * @param {string} table - 'appointments' | 'analyses' | 'user_vaccinations'
   * @param {number} recordId - ID записи в таблице
   * @returns {Promise<{success: boolean}>}
   */
  async deleteCalendarEvent(table, recordId) {
    // Маршрут зависит от таблицы — делегируем к существующим методам
    if (table === 'appointments') {
      return this.deleteAppointment(recordId);
    } else if (table === 'analyses') {
      return this.deleteAnalysis(recordId);
    } else if (table === 'user_vaccinations') {
      return this.deleteUserVaccination(recordId);
    }
    throw new Error('Неизвестная таблица');
  }

  /**
   * Обновить событие в календарь (делегирование)
   */
  async updateCalendarEvent(table, recordId, updates) {
    if (table === 'appointments') {
      return this.updateAppointment(recordId, updates);
    } else if (table === 'analyses') {
      return this.updateAnalysis(recordId, updates);
    } else if (table === 'user_vaccinations') {
      // Для прививок пока нет update — можно добавить на бэке при необходимости
      throw new Error('Редактирование прививок пока не поддерживается');
    }
    throw new Error('Неизвестная таблица');
  }

    async updateUserVaccination(id, updates) {
    return this.request(`/user/vaccinations/${id}`, {
      method: 'PUT',
      body: updates
    });
  }

  // Обновите updateCalendarEvent:
  async updateCalendarEvent(table, recordId, updates) {
    if (table === 'appointments') {
      return this.updateAppointment(recordId, updates);
    } else if (table === 'analyses') {
      return this.updateAnalysis(recordId, updates);
    } else if (table === 'user_vaccinations') {
      return this.updateUserVaccination(recordId, updates); // ✅ новое
    }
    throw new Error('Неизвестная таблица');
  }

}



export default new ApiService();