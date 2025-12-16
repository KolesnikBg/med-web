const API_URL = 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('med_token');
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    
    const config = {
      ...options,
      headers: this.getHeaders(),
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Авторизация
  async login(email, password) {
    try {
      const response = await this.request('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Анализы
  async getAnalyses(userId = 1) {
    return this.request(`/analyses?user_id=${userId}`);
  }

  async createAnalysis(analysisData) {
    return this.request('/analyses', {
      method: 'POST',
      body: analysisData
    });
  }

  // Приемы врачей
  async getAppointments(userId = 1) {
    return this.request(`/appointments?user_id=${userId}`);
  }

  async createAppointment(appointmentData) {
    return this.request('/appointments', {
      method: 'POST',
      body: appointmentData
    });
  }

  // Статистика
  async getDashboardStats(userId = 1) {
    return this.request(`/dashboard/stats?user_id=${userId}`);
  }
}

export default new ApiService();