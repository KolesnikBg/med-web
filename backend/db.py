import os
import sqlite3
import bcrypt

from config import DATA_DIR, DB_PATH, UPLOAD_DIR

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _add_column_if_missing(cursor, table, column, definition):
    cursor.execute(f'PRAGMA table_info({table})')
    cols = {row[1] for row in cursor.fetchall()}
    if column not in cols:
        cursor.execute(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')


def init_db():
    conn = get_db()
    cursor = conn.cursor()

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

    _add_column_if_missing(cursor, 'users', 'role', "TEXT DEFAULT 'user'")
    _add_column_if_missing(cursor, 'users', 'email_verified', 'INTEGER DEFAULT 0')
    _add_column_if_missing(cursor, 'users', 'verification_code', 'TEXT')
    _add_column_if_missing(cursor, 'users', 'verification_expires', 'TEXT')
    _add_column_if_missing(cursor, 'users', 'reset_code', 'TEXT')
    _add_column_if_missing(cursor, 'users', 'reset_expires', 'TEXT')
    _add_column_if_missing(cursor, 'users', 'totp_secret', 'TEXT')
    _add_column_if_missing(cursor, 'users', 'two_factor_enabled', 'INTEGER DEFAULT 0')

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

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vaccines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            category TEXT DEFAULT 'standard',
            is_active BOOLEAN DEFAULT 1
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_vaccinations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            vaccine_id INTEGER,
            date_given TEXT NOT NULL,
            notes TEXT,
            custom_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (vaccine_id) REFERENCES vaccines (id) ON DELETE SET NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            record_type TEXT NOT NULL,
            record_id INTEGER NOT NULL,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_type, record_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_analyses_user_type ON analyses(user_id, type)')

    from reference import init_reference_tables
    init_reference_tables(cursor)

    cursor.execute('SELECT COUNT(*) FROM vaccines')
    if cursor.fetchone()[0] == 0:
        standard_vaccines = [
            ('Гепатит B', 'Защита от вирусного гепатита B', 'standard'),
            ('Корь', 'Профилактика кори', 'standard'),
            ('Краснуха', 'Защита от краснухи', 'standard'),
            ('Свинка', 'Профилактика эпидемического паротита', 'standard'),
            ('Полиомиелит', 'Защита от полиомиелита', 'standard'),
            ('Дифтерия', 'Профилактика дифтерии', 'standard'),
            ('Коклюш', 'Защита от коклюша', 'standard'),
            ('Столбняк', 'Профилактика столбняка', 'standard'),
            ('Грипп', 'Ежегодная вакцинация от гриппа', 'standard'),
            ('HPV', 'Защита от вируса папилломы человека', 'standard'),
            ('Бешенство', 'Для лиц, работающих с животными', 'work'),
            ('Жёлтая лихорадка', 'Требуется для поездок в Африку/Южную Америку', 'travel'),
            ('Холера', 'Рекомендуется при поездках в эндемичные регионы', 'travel'),
        ]
        for name, desc, cat in standard_vaccines:
            cursor.execute(
                'INSERT INTO vaccines (name, description, category) VALUES (?, ?, ?)',
                (name, desc, cat),
            )

    _seed_user(cursor, 'demo@example.com', 'demo123', 'Демо Пользователь', verified=True)
    _seed_user(cursor, 'admin@med.local', 'admin123', 'Администратор', verified=True, role='admin')

    cursor.execute('''
        UPDATE users SET email_verified = 1
        WHERE email IN ('demo@example.com', 'admin@med.local')
    ''')
    cursor.execute("UPDATE users SET role = 'admin' WHERE email = 'admin@med.local'")

    conn.commit()
    conn.close()


def _seed_user(cursor, email, password, name, verified=False, role='user'):
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        cursor.execute(
            "UPDATE users SET role = ?, email_verified = 1 WHERE email = ? AND role != 'admin'",
            (role, email),
        )
        if role == 'admin':
            cursor.execute("UPDATE users SET role = 'admin' WHERE email = ?", (email,))
        return

    pwd = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    cursor.execute('''
        INSERT INTO users (name, email, password_hash, sex, birth_date, role, email_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (name, email, pwd, 'male', '1990-01-01', role, 1 if verified else 0))
    user_id = cursor.lastrowid

    if email == 'demo@example.com':
        cursor.execute('''
            INSERT INTO appointments (user_id, type, description, appointment_date, diagnosis)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, 'Терапевт', 'Ежегодный осмотр', '2025-01-10', 'Всё в норме'))
        cursor.execute('''
            INSERT INTO analyses (user_id, type, analysis_date, unit, value, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, 'Гемоглобин', '2025-01-05', 'г/л', '135', ''))
        cursor.execute('''
            INSERT INTO analyses (user_id, type, analysis_date, unit, value, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, 'Гемоглобин', '2025-06-01', 'г/л', '142', ''))
        cursor.execute('SELECT id FROM vaccines WHERE name = ?', ('Гепатит B',))
        vac = cursor.fetchone()
        if vac:
            cursor.execute('''
                INSERT INTO user_vaccinations (user_id, vaccine_id, date_given, notes)
                VALUES (?, ?, ?, ?)
            ''', (user_id, vac[0], '2023-05-20', 'Без побочных эффектов'))


def user_to_dict(row):
    if not row:
        return None
    d = dict(row)
    d['is_admin'] = d.get('role') == 'admin'
    d['two_factor_enabled'] = bool(d.get('two_factor_enabled'))
    d['email_verified'] = bool(d.get('email_verified'))
    for key in ('password_hash', 'verification_code', 'verification_expires',
                'reset_code', 'reset_expires', 'totp_secret'):
        d.pop(key, None)
    return d
