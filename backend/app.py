import os
import sqlite3
import bcrypt
from flask_jwt_extended import JWTManager
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, create_access_token
from datetime import datetime, timedelta

# конфиг
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'super-secret-med-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
CORS(app, origins=['http://localhost:3000'])
jwt = JWTManager(app)

# пути глобалки (бд)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = os.path.join(DATA_DIR, 'medical.db')
os.makedirs(DATA_DIR, exist_ok=True)

# инит бд 
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # пользователь
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            sex TEXT NOT NULL,
            birth_date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # приемы
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            appointment_date TEXT NOT NULL,
            diagnosis TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # анализы
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            analysis_date TEXT NOT NULL,
            unit TEXT NOT NULL,
            value TEXT NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # справочник прививок 
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vaccines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            category TEXT DEFAULT 'standard',  -- standard, travel, work, custom
            is_active BOOLEAN DEFAULT 1        -- скрыть/показать
        )
    ''')

    # прививки, сделанные пользователем 
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_vaccinations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            vaccine_id INTEGER NOT NULL,
            date_given TEXT NOT NULL,
            notes TEXT,
            custom_name TEXT,  -- если прививка добавлена вручную (не из справочника)
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (vaccine_id) REFERENCES vaccines (id) ON DELETE SET NULL
        )
    ''')

    #  справочник прививок
    cursor.execute("SELECT COUNT(*) FROM vaccines")
    if cursor.fetchone()[0] == 0:
        standard_vaccines = [
            ("Гепатит B", "Защита от вирусного гепатита B", "standard"),
            ("Корь", "Профилактика кори", "standard"),
            ("Краснуха", "Защита от краснухи", "standard"),
            ("Свинка", "Профилактика эпидемического паротита", "standard"),
            ("Полиомиелит", "Защита от полиомиелита", "standard"),
            ("Дифтерия", "Профилактика дифтерии", "standard"),
            ("Коклюш", "Защита от коклюша", "standard"),
            ("Столбняк", "Профилактика столбняка", "standard"),
            ("Грипп", "Ежегодная вакцинация от гриппа", "standard"),
            ("HPV", "Защита от вируса папилломы человека", "standard"),
            ("Бешенство", "Для лиц, работающих с животными", "work"),
            ("Жёлтая лихорадка", "Требуется для поездок в Африку/Южную Америку", "travel"),
            ("Холера", "Рекомендуется при поездках в эндемичные регионы", "travel"),
        ]
        for name, desc, cat in standard_vaccines:
            cursor.execute(
                "INSERT INTO vaccines (name, description, category) VALUES (?, ?, ?)",
                (name, desc, cat)
            )

    # демо пользователь
    cursor.execute("SELECT 1 FROM users WHERE email = 'demo@example.com'")
    if not cursor.fetchone():
        pwd = bcrypt.hashpw('demo123'.encode(), bcrypt.gensalt()).decode()
        cursor.execute('''
            INSERT INTO users (name, email, password_hash, sex, birth_date)
            VALUES (?, ?, ?, ?, ?)
        ''', ('Демо Пользователь', 'demo@example.com', pwd, 'male', '1990-01-01'))
        user_id = cursor.lastrowid
        
        cursor.execute('''
            INSERT INTO appointments (user_id, type, description, appointment_date, diagnosis)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, 'Терапевт', 'Ежегодный осмотр', '2025-01-10', 'Всё в норме'))

        # демо прививка
        cursor.execute("SELECT id FROM vaccines WHERE name = 'Гепатит B'")
        vac_id = cursor.fetchone()
        if vac_id:
            cursor.execute('''
                INSERT INTO user_vaccinations (user_id, vaccine_id, date_given, notes)
                VALUES (?, ?, ?, ?)
            ''', (user_id, vac_id[0], '2023-05-20', 'Без побочных эффектов'))

    conn.commit()
    conn.close()

# РОУТЫ
@app.route('/')
def home():
    return jsonify({'message': 'Medical Tracker API', 'status': 'ok'})

# авторизация
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    required = ['name', 'email', 'password', 'sex', 'birth_date']
    if not all(k in data for k in required):
        return jsonify({'success': False, 'message': 'Все поля обязательны'}), 400

    # проверка почты
    if '@' not in data['email']:
        return jsonify({'success': False, 'message': 'Неверный email'}), 400

    conn = get_db()
    cursor = conn.cursor()
    
    # уникальность почты 
    cursor.execute("SELECT id FROM users WHERE email = ?", (data['email'],))
    if cursor.fetchone():
        return jsonify({'success': False, 'message': 'Email уже используется'}), 400

    # хеширование пароля 
    pwd_hash = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt()).decode()
    cursor.execute('''
        INSERT INTO users (name, email, password_hash, sex, birth_date)
        VALUES (?, ?, ?, ?, ?)
    ''', (data['name'], data['email'], pwd_hash, data['sex'], data['birth_date']))
    
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    access_token = create_access_token(identity=str(user_id))
    return jsonify({
        'success': True,
        'access_token': access_token,
        'user': {
            'id': user_id,
            'name': data['name'],
            'email': data['email'],
            'sex': data['sex'],
            'birth_date': data['birth_date']
        }
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'success': False, 'message': 'Email и пароль обязательны'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, sex, birth_date, password_hash FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        return jsonify({'success': False, 'message': 'Неверные учетные данные'}), 401

    access_token = create_access_token(identity=str(user['id']))
    return jsonify({
        'success': True,
        'access_token': access_token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'sex': user['sex'],
            'birth_date': user['birth_date']
        }
    })

# ЗАЩ РОУТЫ 
@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def profile():
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, sex, birth_date FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    if user:
        return jsonify({'success': True, 'user': dict(user)})
    return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404

@app.route('/api/appointments', methods=['POST'])
@jwt_required()
def create_appointment():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    required = ['type', 'appointment_date']
    if not all(k in data for k in required):
        return jsonify({'success': False, 'message': 'Тип и дата обязательны'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO appointments (user_id, type, description, appointment_date, diagnosis)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        user_id,
        data['type'],
        data.get('description', ''),
        data['appointment_date'],
        data.get('diagnosis', '')
    ))
    conn.commit()
    appointment_id = cursor.lastrowid
    cursor.execute("SELECT * FROM appointments WHERE id = ?", (appointment_id,))
    appointment = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'appointment': appointment}), 201

@app.route('/api/appointments', methods=['GET'])
@jwt_required()
def get_appointments():
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM appointments
        WHERE user_id = ?
        ORDER BY appointment_date DESC
    ''', (user_id,))
    appointments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'appointments': appointments})


@app.route('/api/appointments/<int:appointment_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appointment_id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    conn = get_db()
    cursor = conn.cursor()

    # принадлежность записи пользователю 
    cursor.execute(
        "SELECT id FROM appointments WHERE id = ? AND user_id = ?",
        (appointment_id, user_id),
    )
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Приём не найден'}), 404

    fields = []
    values = []
    for key in ['type', 'description', 'appointment_date', 'diagnosis']:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])

    if not fields:
        conn.close()
        return jsonify({'success': False, 'message': 'Нет данных для обновления'}), 400

    values.extend([appointment_id, user_id])
    cursor.execute(
        f"UPDATE appointments SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
        values,
    )
    conn.commit()
    cursor.execute(
        "SELECT * FROM appointments WHERE id = ? AND user_id = ?",
        (appointment_id, user_id),
    )
    appointment = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'appointment': appointment})


@app.route('/api/appointments/<int:appointment_id>', methods=['DELETE'])
@jwt_required()
def delete_appointment(appointment_id):
    user_id = int(get_jwt_identity())

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM appointments WHERE id = ? AND user_id = ?",
        (appointment_id, user_id),
    )
    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    if not deleted:
        return jsonify({'success': False, 'message': 'Приём не найден'}), 404

    return jsonify({'success': True}), 200


@app.route('/api/analyses', methods=['POST'])
@jwt_required()
def create_analysis():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    required = ['type', 'analysis_date', 'unit', 'value']
    if not all(k in data and data[k] for k in required):
        return jsonify({'success': False, 'message': 'Тип, дата, единица и значение обязательны'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO analyses (user_id, type, analysis_date, unit, value, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        user_id,
        data['type'],
        data['analysis_date'],
        data['unit'],
        str(data['value']),
        data.get('notes', '')
    ))
    conn.commit()
    analysis_id = cursor.lastrowid
    cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
    analysis = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'analysis': analysis}), 201


@app.route('/api/analyses', methods=['GET'])
@jwt_required()
def get_analyses():
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM analyses
        WHERE user_id = ?
        ORDER BY analysis_date DESC, created_at DESC
    ''', (user_id,))
    analyses = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'analyses': analyses})

# прививки
@app.route('/api/vaccines', methods=['GET'])
def get_vaccines():
    """Получить список всех прививок (справочник)"""
    show_all = request.args.get('all', 'false').lower() == 'true'
    conn = get_db()
    cursor = conn.cursor()
    if show_all:
        cursor.execute("SELECT * FROM vaccines ORDER BY category, name")
    else:
        cursor.execute("SELECT * FROM vaccines WHERE is_active = 1 ORDER BY category, name")
    vaccines = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'vaccines': vaccines})


@app.route('/api/user/vaccinations', methods=['GET'])
@jwt_required()
def get_user_vaccinations():
    """Получить прививки, сделанные пользователем"""
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT uv.*, v.name as vaccine_name, v.category
        FROM user_vaccinations uv
        LEFT JOIN vaccines v ON uv.vaccine_id = v.id
        WHERE uv.user_id = ?
        ORDER BY uv.date_given DESC
    ''', (user_id,))
    vaccinations = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'vaccinations': vaccinations})


@app.route('/api/user/vaccinations', methods=['POST'])
@jwt_required()
def add_user_vaccination():
    """Отметить прививку как сделанную"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    date_given = data.get('date_given')
    notes = data.get('notes', '')
    
    if not date_given:
        return jsonify({'success': False, 'message': 'Дата обязательна'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # Вариант 1: прививка из справочника
    vaccine_id = data.get('vaccine_id')
    custom_name = None

    if vaccine_id:
        # Проверяем, существует ли такая прививка
        cursor.execute("SELECT id FROM vaccines WHERE id = ?", (vaccine_id,))
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Прививка не найдена'}), 404
    else:
        # Вариант 2: пользователь добавляет свою прививку
        custom_name = data.get('custom_name')
        if not custom_name:
            return jsonify({'success': False, 'message': 'Укажите название прививки'}), 400

    cursor.execute('''
        INSERT INTO user_vaccinations (user_id, vaccine_id, date_given, notes, custom_name)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, vaccine_id, date_given, notes, custom_name))

    conn.commit()
    vaccination_id = cursor.lastrowid
    cursor.execute('''
        SELECT uv.*, v.name as vaccine_name
        FROM user_vaccinations uv
        LEFT JOIN vaccines v ON uv.vaccine_id = v.id
        WHERE uv.id = ?
    ''', (vaccination_id,))
    vaccination = dict(cursor.fetchone())
    conn.close()

    return jsonify({'success': True, 'vaccination': vaccination}), 201


@app.route('/api/user/vaccinations/<int:vaccination_id>', methods=['DELETE'])
@jwt_required()
def delete_user_vaccination(vaccination_id):
    """Удалить запись о прививке"""
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM user_vaccinations WHERE id = ? AND user_id = ?",
        (vaccination_id, user_id)
    )
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    if not deleted:
        return jsonify({'success': False, 'message': 'Прививка не найдена'}), 404
    return jsonify({'success': True}), 200

# ============ 📅 КАЛЕНДАРЬ: получение всех событий ============
@app.route('/api/calendar/events', methods=['GET'])
@jwt_required()
def get_calendar_events():
    """
    Агрегирует события из appointments, analyses и user_vaccinations
    для отображения в календаре FullCalendar
    """
    user_id = int(get_jwt_identity())
    events = []
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # ===== 1. ПРИЁМЫ У ВРАЧЕЙ (appointments) =====
        cursor.execute('''
            SELECT id, type, description, appointment_date, diagnosis
            FROM appointments
            WHERE user_id = ? AND appointment_date IS NOT NULL
            ORDER BY appointment_date DESC
        ''', (user_id,))
        appointments = cursor.fetchall()
        
        for appt in appointments:
            events.append({
                'id': f'appt_{appt["id"]}',
                'title': f'🩺 {appt["type"]}',
                'start': appt['appointment_date'],  # YYYY-MM-DD
                'className': 'event-appointment',
                'backgroundColor': '#3b82f6',
                'borderColor': '#2563eb',
                'extendedProps': {
                    'type': 'Приём',
                    'description': appt['description'] or '',
                    'diagnosis': appt['diagnosis'] or '',
                    'table': 'appointments',
                    'record_id': appt['id']
                }
            })
        
        # ===== 2. АНАЛИЗЫ (analyses) =====
        cursor.execute('''
            SELECT id, type, value, unit, analysis_date, notes
            FROM analyses
            WHERE user_id = ? AND analysis_date IS NOT NULL
            ORDER BY analysis_date DESC
        ''', (user_id,))
        analyses = cursor.fetchall()
        
        for analysis in analyses:
            events.append({
                'id': f'analysis_{analysis["id"]}',
                'title': f'🧪 {analysis["type"]}: {analysis["value"]} {analysis["unit"]}',
                'start': analysis['analysis_date'],
                'className': 'event-analysis',
                'backgroundColor': '#8b5cf6',
                'borderColor': '#7c3aed',
                'extendedProps': {
                    'type': 'Анализ',
                    'description': analysis['notes'] or '',
                    'value': f'{analysis["value"]} {analysis["unit"]}',
                    'table': 'analyses',
                    'record_id': analysis['id']
                }
            })
        
        # ===== 3. ПРИВИВКИ (user_vaccinations + vaccines) =====
        cursor.execute('''
            SELECT uv.id, uv.date_given, uv.notes, uv.custom_name,
                   v.name as vaccine_name, v.category
            FROM user_vaccinations uv
            LEFT JOIN vaccines v ON uv.vaccine_id = v.id
            WHERE uv.user_id = ? AND uv.date_given IS NOT NULL
            ORDER BY uv.date_given DESC
        ''', (user_id,))
        vaccinations = cursor.fetchall()
        
        for vac in vaccinations:
            vaccine_name = vac['custom_name'] or vac['vaccine_name'] or 'Прививка'
            category = vac['category'] or 'standard'
            
            # Цвет в зависимости от категории
            colors = {
                'standard': ('#10b981', '#059669'),
                'travel': ('#f59e0b', '#d97706'),
                'work': ('#ef4444', '#dc2626'),
                'custom': ('#6b7280', '#4b5563')
            }
            bg, border = colors.get(category, colors['standard'])
            
            events.append({
                'id': f'vac_{vac["id"]}',
                'title': f'💉 {vaccine_name}',
                'start': vac['date_given'],
                'className': f'event-vaccine event-{category}',
                'backgroundColor': bg,
                'borderColor': border,
                'extendedProps': {
                    'type': 'Прививка',
                    'description': vac['notes'] or '',
                    'category': category,
                    'table': 'user_vaccinations',
                    'record_id': vac['id']
                }
            })
        
        conn.close()
        
        # Сортируем все события по дате (опционально, FullCalendar сам сортирует)
        events.sort(key=lambda x: x['start'])
        
        return jsonify({'success': True, 'events': events}), 200
        
    except Exception as e:
        print(f"Calendar error: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


# ============ 📅 КАЛЕНДАРЬ: добавление события (универсальный) ============
@app.route('/api/calendar/events', methods=['POST'])
@jwt_required()
def add_calendar_event():
    """
    Универсальный эндпоинт для добавления события в любую таблицу
    Body:
    {
        "table": "appointments" | "analyses" | "user_vaccinations",
        "title": "Название",
        "date": "2024-12-25",
        "description": "Описание",
        "extra": {...}  # доп. поля для конкретной таблицы
    }
    """
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    table = data.get('table')
    title = data.get('title')
    event_date = data.get('date')
    description = data.get('description', '')
    
    # Валидация
    if not all([table, title, event_date]):
        return jsonify({'success': False, 'message': 'table, title и date обязательны'}), 400
    
    # Проверка формата даты
    try:
        datetime.strptime(event_date, '%Y-%m-%d')
    except ValueError:
        return jsonify({'success': False, 'message': 'Дата в формате YYYY-MM-DD'}), 400
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        if table == 'appointments':
            cursor.execute('''
                INSERT INTO appointments (user_id, type, description, appointment_date)
                VALUES (?, ?, ?, ?)
            ''', (user_id, title, description, event_date))
            
        elif table == 'analyses':
            extra = data.get('extra', {})
            cursor.execute('''
                INSERT INTO analyses (user_id, type, analysis_date, unit, value, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                title,
                event_date,
                extra.get('unit', ''),
                str(extra.get('value', '')),
                description
            ))
            
        elif table == 'user_vaccinations':
            extra = data.get('extra', {})
            vaccine_id = extra.get('vaccine_id')  # может быть None
            custom_name = extra.get('custom_name')
            
            cursor.execute('''
                INSERT INTO user_vaccinations (user_id, vaccine_id, date_given, notes, custom_name)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, vaccine_id, event_date, description, custom_name))
            
        else:
            return jsonify({'success': False, 'message': 'Неизвестная таблица'}), 400
        
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Событие создано',
            'id': f'{table}_{new_id}'
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/user/vaccinations/<int:vaccination_id>', methods=['PUT'])
@jwt_required()
def update_user_vaccination(vaccination_id):
    """Обновить запись о прививке"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Проверка принадлежности
    cursor.execute(
        "SELECT id FROM user_vaccinations WHERE id = ? AND user_id = ?",
        (vaccination_id, user_id)
    )
    if not cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Прививка не найдена'}), 404
    
    # Обновление полей
    fields = []
    values = []
    for key in ['date_given', 'notes', 'custom_name']:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    
    if fields:
        values.extend([vaccination_id, user_id])
        cursor.execute(
            f"UPDATE user_vaccinations SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
            values
        )
        conn.commit()
    
    cursor.execute('''
        SELECT uv.*, v.name as vaccine_name, v.category
        FROM user_vaccinations uv
        LEFT JOIN vaccines v ON uv.vaccine_id = v.id
        WHERE uv.id = ?
    ''', (vaccination_id,))
    result = dict(cursor.fetchone())
    conn.close()
    
    return jsonify({'success': True, 'vaccination': result})

# Старт
if __name__ == '__main__':
    init_db()
    print("API запущен")
    print("Демо-пользователь: demo@example.com | demo123")
    app.run(debug=True, host='0.0.0.0', port=5000)