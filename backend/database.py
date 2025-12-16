import sqlite3
import json
from datetime import datetime
import bcrypt
import os

class Config:
    # Используем абсолютный путь
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    DATABASE = os.path.join(DATA_DIR, 'medical.db')
    
    # Создаем папку data, если ее нет
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

class Database:
    def __init__(self, db_path=Config.DATABASE):
        self.db_path = db_path
        self.init_database()
    
    def get_connection(self):
        # Убедимся, что папка существует
        db_dir = os.path.dirname(self.db_path)
        if not os.path.exists(db_dir):
            os.makedirs(db_dir)
        
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_database(self):
        """Инициализация базы данных и создание таблиц"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                birth_date TEXT,
                blood_type TEXT,
                allergies TEXT,
                chronic_diseases TEXT,
                emergency_contact TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Таблица анализов
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                date DATE NOT NULL,
                result TEXT NOT NULL,
                unit TEXT,
                norm_min REAL,
                norm_max REAL,
                doctor TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Таблица приемов врачей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                doctor TEXT,
                specialty TEXT,
                location TEXT,
                status TEXT DEFAULT 'scheduled',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Индексы для быстрого поиска
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_analyses_user_date ON analyses(user_id, date)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON appointments(user_id, start_time)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')
        
        # Создаем демо пользователя, если его нет
        cursor.execute('SELECT COUNT(*) FROM users WHERE email = ?', ('demo@example.com',))
        if cursor.fetchone()[0] == 0:
            password_hash = bcrypt.hashpw('demo123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute('''
                INSERT INTO users (email, password_hash, name, birth_date, blood_type, allergies, emergency_contact)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                'demo@example.com',
                password_hash,
                'Демо Пользователь',
                '1990-01-01',
                'A(II) Rh+',
                'Нет',
                '+7 (999) 123-45-67'
            ))
            
            # Добавляем демо анализы
            demo_analyses = [
                ('Общий анализ крови', '2024-01-10', '5.2', 'млн/мкл', '4.5', '5.5', 'Иванов И.И.', 'В норме'),
                ('Глюкоза', '2024-01-12', '5.8', 'ммоль/л', '3.9', '6.1', 'Петрова А.А.', 'Незначительное повышение'),
                ('Холестерин', '2024-01-15', '5.0', 'ммоль/л', '3.0', '5.2', 'Сидоров В.В.', 'В пределах нормы'),
            ]
            
            user_id = cursor.lastrowid
            for analysis in demo_analyses:
                cursor.execute('''
                    INSERT INTO analyses (user_id, type, date, result, unit, norm_min, norm_max, doctor, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, *analysis))
            
            # Добавляем демо записи
            demo_appointments = [
                ('Консультация терапевта', '2024-01-20 10:00', '2024-01-20 11:00', 
                 'Иванов И.И.', 'Терапевт', 'Поликлиника №1', 'scheduled', 'Ежегодный осмотр'),
                ('УЗИ брюшной полости', '2024-01-25 14:00', '2024-01-25 15:00',
                 'Петрова А.А.', 'УЗИ-специалист', 'Диагностический центр', 'scheduled', 'Натощак'),
            ]
            
            for appointment in demo_appointments:
                cursor.execute('''
                    INSERT INTO appointments (user_id, title, start_time, end_time, doctor, specialty, location, status, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, *appointment))
        
        conn.commit()
        conn.close()
    
    # ========== ПОЛЬЗОВАТЕЛИ ==========
    def create_user(self, email, password, name, **kwargs):
        """Создание нового пользователя"""
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO users (email, password_hash, name, birth_date, blood_type, allergies, chronic_diseases, emergency_contact)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (email, password_hash, name, 
                  kwargs.get('birth_date'), kwargs.get('blood_type'), 
                  kwargs.get('allergies'), kwargs.get('chronic_diseases'),
                  kwargs.get('emergency_contact')))
            
            user_id = cursor.lastrowid
            conn.commit()
            
            return self.get_user_by_id(user_id)
        except sqlite3.IntegrityError:
            return None  # Пользователь с таким email уже существует
        finally:
            conn.close()
    
    def get_user_by_email(self, email):
        """Получение пользователя по email"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)
        return None
    
    def get_user_by_id(self, user_id):
        """Получение пользователя по ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)
        return None
    
    def verify_password(self, email, password):
        """Проверка пароля пользователя"""
        user = self.get_user_by_email(email)
        if not user:
            return False
        
        return bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8'))
    
    def update_user(self, user_id, **kwargs):
        """Обновление данных пользователя"""
        allowed_fields = ['name', 'birth_date', 'blood_type', 'allergies', 
                         'chronic_diseases', 'emergency_contact']
        
        update_fields = []
        update_values = []
        
        for field in allowed_fields:
            if field in kwargs:
                update_fields.append(f"{field} = ?")
                update_values.append(kwargs[field])
        
        if not update_fields:
            return self.get_user_by_id(user_id)
        
        update_values.append(user_id)
        update_query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
        
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(update_query, update_values)
        conn.commit()
        conn.close()
        
        return self.get_user_by_id(user_id)
    
    # ========== АНАЛИЗЫ ==========
    def create_analysis(self, user_id, analysis_data):
        """Создание нового анализа"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO analyses (user_id, type, date, result, unit, norm_min, norm_max, doctor, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, 
              analysis_data['type'], analysis_data['date'], analysis_data['result'],
              analysis_data.get('unit'), analysis_data.get('norm_min'), 
              analysis_data.get('norm_max'), analysis_data.get('doctor'),
              analysis_data.get('notes')))
        
        analysis_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return self.get_analysis_by_id(analysis_id)
    
    def get_analyses_by_user(self, user_id, limit=None, offset=None):
        """Получение всех анализов пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM analyses WHERE user_id = ? ORDER BY date DESC'
        params = [user_id]
        
        if limit:
            query += ' LIMIT ?'
            params.append(limit)
        if offset:
            query += ' OFFSET ?'
            params.append(offset)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_analysis_by_id(self, analysis_id):
        """Получение анализа по ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM analyses WHERE id = ?', (analysis_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)
        return None
    
    def update_analysis(self, analysis_id, user_id, analysis_data):
        """Обновление анализа"""
        # Проверяем, что анализ принадлежит пользователю
        analysis = self.get_analysis_by_id(analysis_id)
        if not analysis or analysis['user_id'] != user_id:
            return None
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE analyses 
            SET type = ?, date = ?, result = ?, unit = ?, norm_min = ?, norm_max = ?, doctor = ?, notes = ?
            WHERE id = ? AND user_id = ?
        ''', (analysis_data['type'], analysis_data['date'], analysis_data['result'],
              analysis_data.get('unit'), analysis_data.get('norm_min'), 
              analysis_data.get('norm_max'), analysis_data.get('doctor'),
              analysis_data.get('notes'), analysis_id, user_id))
        
        conn.commit()
        conn.close()
        
        return self.get_analysis_by_id(analysis_id)
    
    def delete_analysis(self, analysis_id, user_id):
        """Удаление анализа"""
        # Проверяем, что анализ принадлежит пользователю
        analysis = self.get_analysis_by_id(analysis_id)
        if not analysis or analysis['user_id'] != user_id:
            return False
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM analyses WHERE id = ? AND user_id = ?', (analysis_id, user_id))
        deleted = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        return deleted
    
    # ========== ПРИЕМЫ ВРАЧЕЙ ==========
    def create_appointment(self, user_id, appointment_data):
        """Создание новой записи к врачу"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO appointments (user_id, title, start_time, end_time, doctor, specialty, location, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, 
              appointment_data['title'], appointment_data['start_time'], appointment_data['end_time'],
              appointment_data.get('doctor'), appointment_data.get('specialty'),
              appointment_data.get('location'), appointment_data.get('status', 'scheduled'),
              appointment_data.get('notes')))
        
        appointment_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return self.get_appointment_by_id(appointment_id)
    
    def get_appointments_by_user(self, user_id, limit=None, offset=None):
        """Получение всех записей пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = 'SELECT * FROM appointments WHERE user_id = ? ORDER BY start_time DESC'
        params = [user_id]
        
        if limit:
            query += ' LIMIT ?'
            params.append(limit)
        if offset:
            query += ' OFFSET ?'
            params.append(offset)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]
    
    def get_appointment_by_id(self, appointment_id):
        """Получение записи по ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)
        return None
    
    def update_appointment(self, appointment_id, user_id, appointment_data):
        """Обновление записи к врачу"""
        # Проверяем, что запись принадлежит пользователю
        appointment = self.get_appointment_by_id(appointment_id)
        if not appointment or appointment['user_id'] != user_id:
            return None
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE appointments 
            SET title = ?, start_time = ?, end_time = ?, doctor = ?, specialty = ?, location = ?, status = ?, notes = ?
            WHERE id = ? AND user_id = ?
        ''', (appointment_data['title'], appointment_data['start_time'], appointment_data['end_time'],
              appointment_data.get('doctor'), appointment_data.get('specialty'),
              appointment_data.get('location'), appointment_data.get('status'),
              appointment_data.get('notes'), appointment_id, user_id))
        
        conn.commit()
        conn.close()
        
        return self.get_appointment_by_id(appointment_id)
    
    def delete_appointment(self, appointment_id, user_id):
        """Удаление записи к врачу"""
        # Проверяем, что запись принадлежит пользователю
        appointment = self.get_appointment_by_id(appointment_id)
        if not appointment or appointment['user_id'] != user_id:
            return False
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM appointments WHERE id = ? AND user_id = ?', (appointment_id, user_id))
        deleted = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        return deleted
    
    # ========== СТАТИСТИКА ==========
    def get_user_stats(self, user_id):
        """Получение статистики пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Количество анализов
        cursor.execute('SELECT COUNT(*) FROM analyses WHERE user_id = ?', (user_id,))
        total_analyses = cursor.fetchone()[0]
        
        # Количество отклонений от нормы
        cursor.execute('''
            SELECT COUNT(*) FROM analyses 
            WHERE user_id = ? AND (
                (CAST(result AS REAL) < norm_min) OR 
                (CAST(result AS REAL) > norm_max)
            )
        ''', (user_id,))
        abnormal_analyses = cursor.fetchone()[0]
        
        # Количество записей к врачам
        cursor.execute('SELECT COUNT(*) FROM appointments WHERE user_id = ?', (user_id,))
        total_appointments = cursor.fetchone()[0]
        
        # Предстоящие записи
        cursor.execute('''
            SELECT COUNT(*) FROM appointments 
            WHERE user_id = ? AND status = 'scheduled' AND start_time > datetime('now')
        ''', (user_id,))
        upcoming_appointments = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            'total_analyses': total_analyses,
            'abnormal_analyses': abnormal_analyses,
            'total_appointments': total_appointments,
            'upcoming_appointments': upcoming_appointments
        }
    
    def get_recent_analyses(self, user_id, limit=5):
        """Получение последних анализов"""
        return self.get_analyses_by_user(user_id, limit=limit)
    
    def get_upcoming_appointments(self, user_id, limit=5):
        """Получение ближайших записей"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM appointments 
            WHERE user_id = ? AND status = 'scheduled' AND start_time > datetime('now')
            ORDER BY start_time ASC
            LIMIT ?
        ''', (user_id, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [dict(row) for row in rows]

# Создаем глобальный экземпляр базы данных
db = Database()