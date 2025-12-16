import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import sqlite3

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000'])

# Создаем папку data если ее нет
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = os.path.join(DATA_DIR, 'medical.db')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

def get_db():
    """Получение соединения с БД"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Инициализация базы данных"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Пользователи
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Анализы
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Приемы врачей
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Создаем тестового пользователя
    cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'demo@example.com'")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
            ('demo@example.com', 'demo123', 'Демо Пользователь')
        )
    
    conn.commit()
    conn.close()

# Инициализируем БД при запуске
init_db()

# ========== ПРОСТЫЕ РОУТЫ ==========

@app.route('/')
def home():
    return jsonify({
        'message': 'API Медицинской книжки',
        'status': 'работает',
        'database': DB_PATH
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT * FROM users WHERE email = ? AND password = ?",
        (email, password)
    )
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return jsonify({
            'success': True,
            'user': dict(user),
            'message': 'Вход выполнен'
        })
    else:
        return jsonify({
            'success': False,
            'message': 'Неверный email или пароль'
        }), 401

@app.route('/api/analyses', methods=['GET'])
def get_analyses():
    user_id = request.args.get('user_id', 1)  # Временно: тестовый пользователь
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT * FROM analyses WHERE user_id = ? ORDER BY date DESC",
        (user_id,)
    )
    analyses = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({'analyses': analyses})

@app.route('/api/analyses', methods=['POST'])
def create_analysis():
    data = request.get_json()
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO analyses (user_id, type, date, result, unit, norm_min, norm_max, doctor, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data.get('user_id', 1),
        data['type'],
        data['date'],
        data['result'],
        data.get('unit'),
        data.get('norm_min'),
        data.get('norm_max'),
        data.get('doctor'),
        data.get('notes')
    ))
    
    conn.commit()
    analysis_id = cursor.lastrowid
    conn.close()
    
    return jsonify({
        'success': True,
        'id': analysis_id,
        'message': 'Анализ сохранен'
    }), 201

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    """Создание новой записи к врачу"""
    data = request.get_json()
    
    # Проверка обязательных полей
    required_fields = ['title', 'start_time', 'end_time']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'success': False,
                'message': f'Отсутствует обязательное поле: {field}'
            }), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO appointments (user_id, title, start_time, end_time, 
                                      doctor, specialty, location, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('user_id', 1),
            data['title'],
            data['start_time'],
            data['end_time'],
            data.get('doctor'),
            data.get('specialty'),
            data.get('location'),
            data.get('status', 'scheduled'),
            data.get('notes')
        ))
        
        conn.commit()
        appointment_id = cursor.lastrowid
        
        # Получаем созданную запись
        cursor.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,))
        appointment = dict(cursor.fetchone())
        
        return jsonify({
            'success': True,
            'appointment': appointment,
            'message': 'Запись к врачу создана'
        }), 201
        
    except Exception as e:
        conn.rollback()
        return jsonify({
            'success': False,
            'message': f'Ошибка создания записи: {str(e)}'
        }), 500
        
    finally:
        conn.close()

@app.route('/api/appointments/<int:appointment_id>', methods=['DELETE'])
def delete_appointment(appointment_id):
    """Удаление записи к врачу"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM appointments WHERE id = ?', (appointment_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    
    if deleted:
        return jsonify({
            'success': True,
            'message': 'Запись удалена'
        })
    else:
        return jsonify({
            'success': False,
            'message': 'Запись не найдена'
        }), 404

@app.route('/api/appointments/<int:appointment_id>', methods=['PUT'])
def update_appointment(appointment_id):
    """Обновление записи к врачу"""
    data = request.get_json()
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Проверяем, существует ли запись
    cursor.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({
            'success': False,
            'message': 'Запись не найдена'
        }), 404
    
    try:
        cursor.execute('''
            UPDATE appointments 
            SET title = ?, start_time = ?, end_time = ?, 
                doctor = ?, specialty = ?, location = ?, 
                status = ?, notes = ?
            WHERE id = ?
        ''', (
            data.get('title'),
            data.get('start_time'),
            data.get('end_time'),
            data.get('doctor'),
            data.get('specialty'),
            data.get('location'),
            data.get('status'),
            data.get('notes'),
            appointment_id
        ))
        
        conn.commit()
        
        # Получаем обновленную запись
        cursor.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,))
        appointment = dict(cursor.fetchone())
        
        return jsonify({
            'success': True,
            'appointment': appointment,
            'message': 'Запись обновлена'
        })
        
    except Exception as e:
        conn.rollback()
        return jsonify({
            'success': False,
            'message': f'Ошибка обновления: {str(e)}'
        }), 500
        
    finally:
        conn.close()
@app.route('/api/appointments', methods=['GET'])
def get_appointments():
    """Получение всех записей пользователя"""
    user_id = request.args.get('user_id', 1, type=int)
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "SELECT * FROM appointments WHERE user_id = ? ORDER BY start_time DESC",
            (user_id,)
        )
        rows = cursor.fetchall()
        appointments = []
        
        for row in rows:
            appointment = dict(row)
            # Преобразуем datetime в строку для JSON
            appointment['start_time'] = row['start_time']
            appointment['end_time'] = row['end_time']
            appointments.append(appointment)
        
        return jsonify({
            'success': True,
            'appointments': appointments,
            'count': len(appointments)
        })
        
    except Exception as e:
        print(f"Ошибка при получении записей: {e}")
        return jsonify({
            'success': False,
            'message': f'Ошибка сервера: {str(e)}',
            'appointments': []
        }), 500
        
    finally:
        conn.close()
        
@app.route('/api/dashboard/stats', methods=['GET'])
def get_stats():
    user_id = request.args.get('user_id', 1)
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Количество анализов
    cursor.execute("SELECT COUNT(*) FROM analyses WHERE user_id = ?", (user_id,))
    total_analyses = cursor.fetchone()[0]
    
    # Количество приемов
    cursor.execute("SELECT COUNT(*) FROM appointments WHERE user_id = ?", (user_id,))
    total_appointments = cursor.fetchone()[0]
    
    # Последние анализы
    cursor.execute(
        "SELECT * FROM analyses WHERE user_id = ? ORDER BY date DESC LIMIT 3",
        (user_id,)
    )
    recent_analyses = [dict(row) for row in cursor.fetchall()]
    
    # Ближайшие приемы
    cursor.execute('''
        SELECT * FROM appointments 
        WHERE user_id = ? AND status = 'scheduled' 
        ORDER BY start_time ASC LIMIT 3
    ''', (user_id,))
    upcoming_appointments = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    return jsonify({
        'stats': {
            'total_analyses': total_analyses,
            'total_appointments': total_appointments
        },
        'recent_analyses': recent_analyses,
        'upcoming_appointments': upcoming_appointments
    })

if __name__ == '__main__':
    print("=" * 50)
    print("🚀 Медицинская книжка - Flask сервер")
    print("=" * 50)
    print(f"📂 База данных: {DB_PATH}")
    print("🔗 Адрес: http://localhost:5000")
    print("📝 Демо пользователь:")
    print("   Email: demo@example.com")
    print("   Пароль: demo123")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)