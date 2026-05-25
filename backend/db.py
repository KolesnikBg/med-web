import os
import shutil
import sqlite3
import bcrypt

from config import DATA_DIR, DB_PATH, UPLOAD_DIR

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def build_name_from_parts(lastname='', first_name='', patronymic='', fallback=''):
    """Склейка ФИО с формы регистрации."""
    return ' '.join(p for p in (lastname, first_name, patronymic) if p) or fallback


def _table_columns(cursor, table):
    cursor.execute(f'PRAGMA table_info({table})')
    return {row[1] for row in cursor.fetchall()}


def _column_notnull(cursor, table, column):
    cursor.execute(f'PRAGMA table_info({table})')
    for row in cursor.fetchall():
        if row[1] == column:
            return bool(row[3])
    return False


def _add_column_if_missing(cursor, table, column, definition):
    if column not in _table_columns(cursor, table):
        cursor.execute(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')


def _migrate_schema(cursor):
    """Добавить недостающие колонки и привести старые таблицы к актуальной схеме."""
    if 'users' in _existing_tables(cursor):
        for column, definition in (
            ('role', "TEXT DEFAULT 'user'"),
            ('email_verified', 'INTEGER DEFAULT 0'),
            ('verification_code', 'TEXT'),
            ('verification_expires', 'TEXT'),
            ('reset_code', 'TEXT'),
            ('reset_expires', 'TEXT'),
            ('two_factor_enabled', 'INTEGER DEFAULT 0'),
            ('two_fa_code', 'TEXT'),
            ('two_fa_expires', 'TEXT'),
        ):
            _add_column_if_missing(cursor, 'users', column, definition)

    if 'appointments' in _existing_tables(cursor):
        _add_column_if_missing(cursor, 'appointments', 'doctor_id', 'INTEGER')

    if 'analyses' in _existing_tables(cursor):
        _add_column_if_missing(cursor, 'analyses', 'panel_id', 'INTEGER')
        _add_column_if_missing(cursor, 'analyses', 'batch_id', 'TEXT')

    if 'user_vaccinations' in _existing_tables(cursor):
        _add_column_if_missing(cursor, 'user_vaccinations', 'custom_name', 'TEXT')

    if 'attachments' in _existing_tables(cursor):
        _migrate_attachments(cursor)


def _existing_tables(cursor):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return {row[0] for row in cursor.fetchall()}


def _migrate_attachments(cursor):
    cols = _table_columns(cursor, 'attachments')
    needs_rebuild = (
        'draft_key' not in cols
        or _column_notnull(cursor, 'attachments', 'record_type')
        or _column_notnull(cursor, 'attachments', 'record_id')
    )
    if not needs_rebuild:
        _add_column_if_missing(cursor, 'attachments', 'draft_key', 'TEXT')
        _add_column_if_missing(cursor, 'attachments', 'batch_id', 'TEXT')
        return

    cursor.execute('''
        CREATE TABLE attachments_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            record_type TEXT,
            record_id INTEGER,
            draft_key TEXT,
            batch_id TEXT,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')
    old_cols = _table_columns(cursor, 'attachments')
    insert_cols = ['id', 'user_id', 'record_type', 'record_id', 'draft_key', 'batch_id']
    insert_cols += [
        'original_filename', 'stored_filename', 'mime_type', 'size', 'created_at',
    ]
    select_exprs = []
    for col in ('id', 'user_id', 'record_type', 'record_id'):
        select_exprs.append(col if col in old_cols else 'NULL')
    select_exprs.append(
        'draft_key' if 'draft_key' in old_cols else 'NULL',
    )
    select_exprs.append(
        'batch_id' if 'batch_id' in old_cols else 'NULL',
    )
    for col in ('original_filename', 'stored_filename', 'mime_type', 'size', 'created_at'):
        select_exprs.append(col if col in old_cols else 'NULL')

    cursor.execute(f'''
        INSERT INTO attachments_new ({', '.join(insert_cols)})
        SELECT {', '.join(select_exprs)} FROM attachments
    ''')
    cursor.execute('DROP TABLE attachments')
    cursor.execute('ALTER TABLE attachments_new RENAME TO attachments')


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
            role TEXT DEFAULT 'user',
            email_verified INTEGER DEFAULT 0,
            verification_code TEXT,
            verification_expires TEXT,
            reset_code TEXT,
            reset_expires TEXT,
            two_factor_enabled INTEGER DEFAULT 0,
            two_fa_code TEXT,
            two_fa_expires TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            user_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            doctor_id INTEGER,
            description TEXT,
            appointment_date TEXT NOT NULL,
            diagnosis TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE SET NULL
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
            panel_id INTEGER,
            batch_id TEXT,
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
            record_type TEXT,
            record_id INTEGER,
            draft_key TEXT,
            batch_id TEXT,
            original_filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analysis_catalog (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            default_unit TEXT DEFAULT '',
            user_id INTEGER,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analysis_panels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            user_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS analysis_panel_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            panel_id INTEGER NOT NULL,
            catalog_id INTEGER,
            item_name TEXT NOT NULL,
            default_unit TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (panel_id) REFERENCES analysis_panels (id) ON DELETE CASCADE,
            FOREIGN KEY (catalog_id) REFERENCES analysis_catalog (id) ON DELETE SET NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vaccine_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vaccine_id INTEGER NOT NULL,
            schedule_type TEXT NOT NULL,
            interval_years INTEGER,
            age_years INTEGER,
            description TEXT,
            FOREIGN KEY (vaccine_id) REFERENCES vaccines (id) ON DELETE CASCADE
        )
    ''')

    _migrate_schema(cursor)

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attachments_record ON attachments(record_type, record_id)') 
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attachments_draft ON attachments(user_id, draft_key)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_attachments_batch ON attachments(user_id, batch_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_analyses_user_type ON analyses(user_id, type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_analyses_batch ON analyses(user_id, batch_id)')

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

    from reference import seed_reference_data
    seed_reference_data(cursor)

    _seed_user(cursor, 'demo@example.com', 'demo123', 'Пользователь Демо', verified=True)
    _seed_user(
        cursor, 'admin@med.local', 'admin123', 'Администратор Системы',
        verified=True, role='admin',
    )

    conn.commit()
    conn.close()


def _seed_user(cursor, email, password, name, verified=False, role='user'):
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        if role == 'admin':
            cursor.execute(
                "UPDATE users SET role = 'admin', email_verified = 1 WHERE email = ?",
                (email,),
            )
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


def delete_user_account(user_id):
    """Удалить пользователя, все записи (CASCADE) и файлы на диске."""
    from utils import delete_stored_file

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT stored_filename FROM attachments WHERE user_id = ?', (user_id,))
    files = [r['stored_filename'] for r in cursor.fetchall()]
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    for stored in files:
        delete_stored_file(user_id, stored)
    user_dir = os.path.join(UPLOAD_DIR, str(user_id))
    if os.path.isdir(user_dir):
        shutil.rmtree(user_dir, ignore_errors=True)
    return deleted > 0


def user_to_dict(row):
    if not row:
        return None
    d = dict(row)
    d['is_admin'] = d.get('role') == 'admin'
    d['two_factor_enabled'] = bool(d.get('two_factor_enabled'))
    d['email_verified'] = bool(d.get('email_verified'))
    for key in (
        'password_hash', 'verification_code', 'verification_expires',
        'reset_code', 'reset_expires', 'two_fa_code', 'two_fa_expires',
    ):
        d.pop(key, None)
    return d
