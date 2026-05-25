import os
from datetime import datetime, timedelta

import bcrypt
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    jwt_required,
    get_jwt_identity,
    create_access_token,
    create_refresh_token,
    get_jwt,
)

from config import JWT_ACCESS_TOKEN_EXPIRES_HOURS, UPLOAD_DIR
from db import get_db, init_db, user_to_dict, build_name_from_parts, delete_user_account
from services.email_service import send_verification_code, send_password_reset, send_2fa_code
from reference import register_reference_routes, resolve_doctor
from utils import (
    VALID_RECORD_TYPES,
    admin_required,
    owns_record,
    owns_batch,
    validate_upload,
    save_upload_file,
    delete_stored_file,
    generate_code,
    code_expires,
    is_expired,
    link_draft_attachments,
    link_draft_to_batch,
)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'super-secret-med-key')
app.config['JWT_SECRET_KEY'] = app.config['SECRET_KEY']
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=JWT_ACCESS_TOKEN_EXPIRES_HOURS)

CORS(
    app,
    origins=['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allow_headers=['Content-Type', 'Authorization'],
    supports_credentials=True,
)
jwt = JWTManager(app)


def _public_user(row):
    u = user_to_dict(row)
    if u and row and 'created_at' in row.keys():
        u['created_at'] = row['created_at']
    return u


# ─── Health ───────────────────────────────────────────────────────────────────

@app.route('/')
def home():
    return jsonify({'message': 'Medical Tracker API', 'status': 'ok'})


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    required = ['email', 'password', 'sex', 'birth_date']
    if not all(k in data and data[k] for k in required):
        return jsonify({'success': False, 'message': 'Заполните обязательные поля'}), 400

    display_name = build_name_from_parts(
        data.get('lastname', '').strip(),
        data.get('name', '').strip(),
        data.get('patronymic', '').strip(),
        data.get('email', '').split('@')[0],
    )

    email = data['email'].strip().lower()
    if '@' not in email:
        return jsonify({'success': False, 'message': 'Неверный email'}), 400
    if len(data['password']) < 6:
        return jsonify({'success': False, 'message': 'Пароль минимум 6 символов'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'success': False, 'message': 'Email уже используется'}), 409

    code = generate_code()
    pwd_hash = bcrypt.hashpw(data['password'].encode(), bcrypt.gensalt()).decode()
    cursor.execute('''
        INSERT INTO users (name, email, password_hash, sex, birth_date,
                           verification_code, verification_expires, email_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    ''', (
        display_name, email, pwd_hash, data['sex'], data['birth_date'],
        code, code_expires(30),
    ))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    send_verification_code(email, code)
    return jsonify({
        'success': True,
        'needs_verification': True,
        'message': 'На почту отправлен код подтверждения',
        'email': email,
        'dev_code': code if os.getenv('MAIL_MODE', 'console') == 'console' else None,
    }), 201


@app.route('/api/auth/verify-email', methods=['POST'])
def verify_email():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    code = (data.get('code') or '').strip()
    if not email or not code:
        return jsonify({'success': False, 'message': 'Email и код обязательны'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM users WHERE email = ? AND verification_code = ?
    ''', (email, code))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Неверный код'}), 400
    if is_expired(user['verification_expires']):
        conn.close()
        return jsonify({'success': False, 'message': 'Код истёк. Запросите новый'}), 400

    cursor.execute('''
        UPDATE users SET email_verified = 1, verification_code = NULL,
        verification_expires = NULL WHERE id = ?
    ''', (user['id'],))
    conn.commit()
    conn.close()

    access_token = create_access_token(identity=str(user['id']))
    return jsonify({
        'success': True,
        'access_token': access_token,
        'user': _public_user(user),
    })


@app.route('/api/auth/resend-verification', methods=['POST'])
def resend_verification():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, email_verified FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'success': True, 'message': 'Если email зарегистрирован, код отправлен'})
    if user['email_verified']:
        conn.close()
        return jsonify({'success': False, 'message': 'Email уже подтверждён'}), 400

    code = generate_code()
    cursor.execute('''
        UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?
    ''', (code, code_expires(30), user['id']))
    conn.commit()
    conn.close()
    send_verification_code(email, code)
    return jsonify({
        'success': True,
        'message': 'Код отправлен',
        'dev_code': code if os.getenv('MAIL_MODE', 'console') == 'console' else None,
    })


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        return jsonify({'success': False, 'message': 'Неверные учётные данные'}), 401

    if not user['email_verified']:
        return jsonify({
            'success': False,
            'needs_verification': True,
            'email': email,
            'message': 'Подтвердите email перед входом',
        }), 403

    if user['two_factor_enabled']:
        code = generate_code()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE users SET two_fa_code = ?, two_fa_expires = ? WHERE id = ?
        ''', (code, code_expires(10), user['id']))
        conn.commit()
        conn.close()
        send_2fa_code(email, code)
        temp_token = create_access_token(
            identity=str(user['id']),
            additional_claims={'2fa_pending': True},
            expires_delta=timedelta(minutes=10),
        )
        return jsonify({
            'success': True,
            'requires_2fa': True,
            'temp_token': temp_token,
            'user': _public_user(user),
            'dev_code': code if os.getenv('MAIL_MODE', 'console') == 'console' else None,
        })

    access_token = create_access_token(identity=str(user['id']))
    return jsonify({
        'success': True,
        'access_token': access_token,
        'user': _public_user(user),
    })


@app.route('/api/auth/2fa/verify-login', methods=['POST'])
def verify_2fa_login():
    data = request.get_json() or {}
    temp_token = data.get('temp_token')
    code = (data.get('code') or '').strip()
    if not temp_token or not code:
        return jsonify({'success': False, 'message': 'Токен и код обязательны'}), 400

    from flask_jwt_extended import decode_token
    try:
        decoded = decode_token(temp_token)
        if not decoded.get('2fa_pending'):
            return jsonify({'success': False, 'message': 'Неверный токен'}), 401
        user_id = int(decoded['sub'])
    except Exception:
        return jsonify({'success': False, 'message': 'Сессия истекла'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user or user['two_fa_code'] != code:
        return jsonify({'success': False, 'message': 'Неверный код'}), 401
    if is_expired(user['two_fa_expires']):
        return jsonify({'success': False, 'message': 'Код истёк. Войдите снова'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE users SET two_fa_code = NULL, two_fa_expires = NULL WHERE id = ?',
        (user_id,),
    )
    conn.commit()
    conn.close()

    access_token = create_access_token(identity=str(user_id))
    return jsonify({
        'success': True,
        'access_token': access_token,
        'user': _public_user(user),
    })


@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    email = (request.get_json() or {}).get('email', '').strip().lower()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    dev_code = None
    if user:
        code = generate_code()
        dev_code = code if os.getenv('MAIL_MODE', 'console') == 'console' else None
        cursor.execute('''
            UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?
        ''', (code, code_expires(60), user['id']))
        conn.commit()
        send_password_reset(email, code)
    conn.close()
    return jsonify({
        'success': True,
        'message': 'Если email зарегистрирован, код отправлен',
        'dev_code': dev_code,
    })


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    code = (data.get('code') or '').strip()
    new_password = data.get('new_password', '')
    if not all([email, code, new_password]) or len(new_password) < 6:
        return jsonify({'success': False, 'message': 'Заполните все поля (пароль от 6 символов)'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id FROM users WHERE email = ? AND reset_code = ?
    ''', (email, code))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Неверный код'}), 400

    cursor.execute('SELECT reset_expires FROM users WHERE id = ?', (user['id'],))
    exp = cursor.fetchone()['reset_expires']
    if is_expired(exp):
        conn.close()
        return jsonify({'success': False, 'message': 'Код истёк'}), 400

    pwd_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    cursor.execute('''
        UPDATE users SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?
    ''', (pwd_hash, user['id']))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Пароль обновлён'})


# ─── Profile & 2FA settings ─────────────────────────────────────────────────────

@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def profile():
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT id, name, email, sex, birth_date, role, '
        'email_verified, two_factor_enabled, created_at FROM users WHERE id = ?',
        (user_id,),
    )
    user = cursor.fetchone()
    conn.close()
    if user:
        return jsonify({'success': True, 'user': _public_user(user)})
    return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404


@app.route('/api/user/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT password_hash FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404

    fields, values = [], []
    if 'name' in data and (data.get('name') or '').strip():
        fields.append('name = ?')
        values.append(data['name'].strip())
    if 'sex' in data and data['sex'] in ('male', 'female'):
        fields.append('sex = ?')
        values.append(data['sex'])
    if 'birth_date' in data and data['birth_date']:
        fields.append('birth_date = ?')
        values.append(data['birth_date'])

    new_password = data.get('new_password', '')
    if new_password:
        old_password = data.get('password', '')
        if not old_password or not bcrypt.checkpw(
            old_password.encode(), user['password_hash'].encode()
        ):
            conn.close()
            return jsonify({'success': False, 'message': 'Неверный текущий пароль'}), 401
        if len(new_password) < 6:
            conn.close()
            return jsonify({'success': False, 'message': 'Новый пароль минимум 6 символов'}), 400
        fields.append('password_hash = ?')
        values.append(bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode())

    if fields:
        values.append(user_id)
        cursor.execute(
            f"UPDATE users SET {', '.join(fields)} WHERE id = ?",
            values,
        )
        conn.commit()

    cursor.execute(
        'SELECT id, name, email, sex, birth_date, role, '
        'email_verified, two_factor_enabled, created_at FROM users WHERE id = ?',
        (user_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return jsonify({'success': True, 'user': _public_user(row)})


@app.route('/api/user/2fa', methods=['PUT'])
@jwt_required()
def toggle_2fa():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    enabled = bool(data.get('enabled'))
    password = data.get('password', '')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT password_hash FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    if not user or not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        conn.close()
        return jsonify({'success': False, 'message': 'Неверный пароль'}), 401

    cursor.execute(
        'UPDATE users SET two_factor_enabled = ?, two_fa_code = NULL, two_fa_expires = NULL WHERE id = ?',
        (1 if enabled else 0, user_id),
    )
    conn.commit()
    conn.close()
    return jsonify({
        'success': True,
        'two_factor_enabled': enabled,
        'message': '2FA включена — при входе код придёт на email' if enabled else '2FA отключена',
    })


@app.route('/api/user/account', methods=['DELETE'])
@jwt_required()
def delete_own_account():
    user_id = int(get_jwt_identity())
    password = (request.get_json() or {}).get('password', '')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT password_hash, role FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
    if user['role'] == 'admin':
        conn.close()
        return jsonify({'success': False, 'message': 'Администратор не может удалить аккаунт здесь'}), 400
    if not bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        conn.close()
        return jsonify({'success': False, 'message': 'Неверный пароль'}), 401
    conn.close()
    if not delete_user_account(user_id):
        return jsonify({'success': False, 'message': 'Ошибка удаления'}), 500
    return jsonify({'success': True, 'message': 'Аккаунт и все данные удалены'})


# ─── Appointments ─────────────────────────────────────────────────────────────

@app.route('/api/appointments', methods=['POST'])
@jwt_required()
def create_appointment():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    if not data.get('appointment_date'):
        return jsonify({'success': False, 'message': 'Дата обязательна'}), 400

    conn = get_db()
    cursor = conn.cursor()
    doctor_id, doc_name = resolve_doctor(
        cursor, user_id,
        doctor_id=data.get('doctor_id'),
        name=data.get('type') or data.get('name') or data.get('specialty') or data.get('doctor_name'),
    )
    if not doc_name:
        conn.close()
        return jsonify({'success': False, 'message': 'Укажите врача'}), 400

    cursor.execute('''
        INSERT INTO appointments (user_id, type, doctor_id, description, appointment_date, diagnosis)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        user_id, doc_name, doctor_id, data.get('description', ''),
        data['appointment_date'], data.get('diagnosis', ''),
    ))
    aid = cursor.lastrowid
    link_draft_attachments(cursor, user_id, data.get('draft_key'), 'appointments', aid)
    conn.commit()
    cursor.execute('SELECT * FROM appointments WHERE id = ?', (aid,))
    row = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'appointment': row}), 201


@app.route('/api/appointments', methods=['GET'])
@jwt_required()
def get_appointments():
    user_id = int(get_jwt_identity())
    doctor_id = request.args.get('doctor_id', type=int)
    doctor = request.args.get('doctor', '').strip()
    date_from = request.args.get('date_from', '').strip()
    date_to = request.args.get('date_to', '').strip()
    conn = get_db()
    cursor = conn.cursor()
    q = 'SELECT a.*, d.name as doctor_name FROM appointments a LEFT JOIN doctors d ON a.doctor_id = d.id WHERE a.user_id = ?'
    params = [user_id]
    if doctor_id:
        q += ' AND a.doctor_id = ?'
        params.append(doctor_id)
    elif doctor:
        q += ' AND a.type = ?'
        params.append(doctor)
    if date_from:
        q += ' AND a.appointment_date >= ?'
        params.append(date_from)
    if date_to:
        q += ' AND a.appointment_date <= ?'
        params.append(date_to)
    q += ' ORDER BY a.appointment_date DESC'
    cursor.execute(q, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'appointments': rows})


@app.route('/api/appointments/doctors', methods=['GET'])
@jwt_required()
def get_appointment_doctor_filter():
    """Устаревший alias — список имён из записей."""
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT DISTINCT type FROM appointments WHERE user_id = ? ORDER BY type', (user_id,))
    doctors = [r['type'] for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'doctors': doctors})


@app.route('/api/appointments/<int:appointment_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appointment_id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()
    if not owns_record(cursor, user_id, 'appointments', appointment_id):
        conn.close()
        return jsonify({'success': False, 'message': 'Приём не найден'}), 404
    fields, values = [], []
    if 'doctor_id' in data or 'type' in data or 'doctor_name' in data or 'specialty' in data:
        did, dname = resolve_doctor(
            cursor, user_id,
            doctor_id=data.get('doctor_id'),
            name=data.get('type') or data.get('name') or data.get('specialty') or data.get('doctor_name'),
        )
        if dname:
            fields.extend(['type = ?', 'doctor_id = ?'])
            values.extend([dname, did])
    for key in ('description', 'appointment_date', 'diagnosis'):
        if key in data:
            fields.append(f'{key} = ?')
            values.append(data[key])
    if fields:
        values.extend([appointment_id, user_id])
        cursor.execute(
            f"UPDATE appointments SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
            values,
        )
        conn.commit()
    cursor.execute('SELECT * FROM appointments WHERE id = ?', (appointment_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'appointment': row})


@app.route('/api/appointments/<int:appointment_id>', methods=['DELETE'])
@jwt_required()
def delete_appointment(appointment_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    _delete_attachments_for_record(cursor, user_id, 'appointments', appointment_id)
    cursor.execute('DELETE FROM appointments WHERE id = ? AND user_id = ?', (appointment_id, user_id))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    if not deleted:
        return jsonify({'success': False, 'message': 'Приём не найден'}), 404
    return jsonify({'success': True})


# ─── Analyses ─────────────────────────────────────────────────────────────────

@app.route('/api/analyses', methods=['POST'])
@jwt_required()
def create_analysis():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    required = ['type', 'analysis_date', 'unit', 'value']
    if not all(data.get(k) for k in required):
        return jsonify({'success': False, 'message': 'Название, дата, единица и значение обязательны'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO analyses (user_id, type, analysis_date, unit, value, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        user_id, data['type'].strip(), data['analysis_date'],
        data['unit'].strip(), str(data['value']).strip(), data.get('notes', ''),
    ))
    aid = cursor.lastrowid
    link_draft_attachments(cursor, user_id, data.get('draft_key'), 'analyses', aid)
    conn.commit()
    cursor.execute('SELECT * FROM analyses WHERE id = ?', (aid,))
    row = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'analysis': row}), 201


@app.route('/api/analyses', methods=['GET'])
@jwt_required()
def get_analyses():
    user_id = int(get_jwt_identity())
    analysis_type = request.args.get('type', '').strip()
    search = request.args.get('search', '').strip()
    date_from = request.args.get('date_from', '').strip()
    date_to = request.args.get('date_to', '').strip()
    conn = get_db()
    cursor = conn.cursor()
    q = 'SELECT * FROM analyses WHERE user_id = ?'
    params = [user_id]
    if analysis_type:
        q += ' AND type = ?'
        params.append(analysis_type)
    if search:
        q += ' AND type LIKE ?'
        params.append(f'%{search}%')
    if date_from:
        q += ' AND analysis_date >= ?'
        params.append(date_from)
    if date_to:
        q += ' AND analysis_date <= ?'
        params.append(date_to)
    order = ' ORDER BY analysis_date ASC' if analysis_type and not date_from else ' ORDER BY analysis_date DESC, created_at DESC'
    cursor.execute(q + order, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'analyses': rows})


@app.route('/api/analyses/types', methods=['GET'])
@jwt_required()
def get_analysis_types():
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT DISTINCT type FROM analyses WHERE user_id = ? ORDER BY type
    ''', (user_id,))
    types = [r['type'] for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'types': types})


@app.route('/api/analyses/<int:analysis_id>', methods=['PUT'])
@jwt_required()
def update_analysis(analysis_id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()
    if not owns_record(cursor, user_id, 'analyses', analysis_id):
        conn.close()
        return jsonify({'success': False, 'message': 'Анализ не найден'}), 404
    fields, values = [], []
    for key in ('type', 'analysis_date', 'unit', 'value', 'notes'):
        if key in data:
            fields.append(f'{key} = ?')
            values.append(data[key])
    if fields:
        values.extend([analysis_id, user_id])
        cursor.execute(
            f"UPDATE analyses SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
            values,
        )
        conn.commit()
    cursor.execute('SELECT * FROM analyses WHERE id = ?', (analysis_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'analysis': row})


@app.route('/api/analyses/<int:analysis_id>', methods=['DELETE'])
@jwt_required()
def delete_analysis(analysis_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    _delete_attachments_for_record(cursor, user_id, 'analyses', analysis_id)
    cursor.execute('DELETE FROM analyses WHERE id = ? AND user_id = ?', (analysis_id, user_id))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    if not deleted:
        return jsonify({'success': False, 'message': 'Анализ не найден'}), 404
    return jsonify({'success': True})


# ─── Vaccines ─────────────────────────────────────────────────────────────────

@app.route('/api/vaccines', methods=['GET'])
def get_vaccines():
    show_all = request.args.get('all', 'false').lower() == 'true'
    conn = get_db()
    cursor = conn.cursor()
    if show_all:
        cursor.execute('SELECT * FROM vaccines ORDER BY category, name')
    else:
        cursor.execute('SELECT * FROM vaccines WHERE is_active = 1 ORDER BY category, name')
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'vaccines': rows})


@app.route('/api/user/vaccinations', methods=['GET'])
@jwt_required()
def get_user_vaccinations():
    user_id = int(get_jwt_identity())
    vaccine_id = request.args.get('vaccine_id', type=int)
    search = request.args.get('search', '').strip()
    date_from = request.args.get('date_from', '').strip()
    date_to = request.args.get('date_to', '').strip()
    conn = get_db()
    cursor = conn.cursor()
    q = '''
        SELECT uv.*, v.name as vaccine_name, v.category
        FROM user_vaccinations uv
        LEFT JOIN vaccines v ON uv.vaccine_id = v.id
        WHERE uv.user_id = ?
    '''
    params = [user_id]
    if vaccine_id:
        q += ' AND uv.vaccine_id = ?'
        params.append(vaccine_id)
    if search:
        q += ' AND (v.name LIKE ? OR uv.custom_name LIKE ?)'
        params.extend([f'%{search}%', f'%{search}%'])
    if date_from:
        q += ' AND uv.date_given >= ?'
        params.append(date_from)
    if date_to:
        q += ' AND uv.date_given <= ?'
        params.append(date_to)
    q += ' ORDER BY uv.date_given DESC'
    cursor.execute(q, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'vaccinations': rows})


@app.route('/api/user/vaccinations', methods=['POST'])
@jwt_required()
def add_user_vaccination():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    if not data.get('date_given'):
        return jsonify({'success': False, 'message': 'Дата обязательна'}), 400

    conn = get_db()
    cursor = conn.cursor()
    vaccine_id = data.get('vaccine_id')
    custom_name = None
    if vaccine_id:
        cursor.execute('SELECT id FROM vaccines WHERE id = ?', (vaccine_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Прививка не найдена'}), 404
    else:
        custom_name = data.get('custom_name')
        if not custom_name:
            conn.close()
            return jsonify({'success': False, 'message': 'Укажите название прививки'}), 400

    cursor.execute('''
        INSERT INTO user_vaccinations (user_id, vaccine_id, date_given, notes, custom_name)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, vaccine_id, data['date_given'], data.get('notes', ''), custom_name))
    conn.commit()
    vid = cursor.lastrowid
    cursor.execute('''
        SELECT uv.*, v.name as vaccine_name FROM user_vaccinations uv
        LEFT JOIN vaccines v ON uv.vaccine_id = v.id WHERE uv.id = ?
    ''', (vid,))
    row = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'vaccination': row}), 201


@app.route('/api/user/vaccinations/<int:vaccination_id>', methods=['PUT'])
@jwt_required()
def update_user_vaccination(vaccination_id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()
    if not owns_record(cursor, user_id, 'user_vaccinations', vaccination_id):
        conn.close()
        return jsonify({'success': False, 'message': 'Прививка не найдена'}), 404
    fields, values = [], []
    for key in ('date_given', 'notes', 'custom_name'):
        if key in data:
            fields.append(f'{key} = ?')
            values.append(data[key])
    if fields:
        values.extend([vaccination_id, user_id])
        cursor.execute(
            f"UPDATE user_vaccinations SET {', '.join(fields)} WHERE id = ? AND user_id = ?",
            values,
        )
        conn.commit()
    cursor.execute('''
        SELECT uv.*, v.name as vaccine_name, v.category FROM user_vaccinations uv
        LEFT JOIN vaccines v ON uv.vaccine_id = v.id WHERE uv.id = ?
    ''', (vaccination_id,))
    row = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'vaccination': row})


@app.route('/api/user/vaccinations/<int:vaccination_id>', methods=['DELETE'])
@jwt_required()
def delete_user_vaccination(vaccination_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    _delete_attachments_for_record(cursor, user_id, 'user_vaccinations', vaccination_id)
    cursor.execute(
        'DELETE FROM user_vaccinations WHERE id = ? AND user_id = ?',
        (vaccination_id, user_id),
    )
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    if not deleted:
        return jsonify({'success': False, 'message': 'Прививка не найдена'}), 404
    return jsonify({'success': True})


# ─── Attachments ──────────────────────────────────────────────────────────────

def _delete_attachments_for_record(cursor, user_id, record_type, record_id):
    cursor.execute('''
        SELECT stored_filename FROM attachments
        WHERE user_id = ? AND record_type = ? AND record_id = ?
    ''', (user_id, record_type, record_id))
    for row in cursor.fetchall():
        delete_stored_file(user_id, row['stored_filename'])
    cursor.execute('''
        DELETE FROM attachments WHERE user_id = ? AND record_type = ? AND record_id = ?
    ''', (user_id, record_type, record_id))


def _attachment_count(cursor, user_id, record_type=None, record_id=None,
                      draft_key=None, batch_id=None):
    if draft_key:
        cursor.execute(
            'SELECT COUNT(*) FROM attachments WHERE user_id = ? AND draft_key = ?',
            (user_id, draft_key),
        )
    elif batch_id:
        cursor.execute(
            'SELECT COUNT(*) FROM attachments WHERE user_id = ? AND batch_id = ?',
            (user_id, batch_id),
        )
    else:
        cursor.execute(
            'SELECT COUNT(*) FROM attachments WHERE user_id = ? AND record_type = ? AND record_id = ?',
            (user_id, record_type, record_id),
        )
    return cursor.fetchone()[0]


@app.route('/api/attachments', methods=['GET'])
@jwt_required()
def list_attachments():
    user_id = int(get_jwt_identity())
    record_type = request.args.get('record_type', '')
    record_id = request.args.get('record_id', type=int)
    draft_key = request.args.get('draft_key', '').strip()
    batch_id = request.args.get('batch_id', '').strip()

    conn = get_db()
    cursor = conn.cursor()

    if draft_key:
        cursor.execute('''
            SELECT id, original_filename, mime_type, size, created_at,
                   record_type, record_id, draft_key, batch_id
            FROM attachments WHERE user_id = ? AND draft_key = ?
            ORDER BY created_at DESC
        ''', (user_id, draft_key))
    elif batch_id:
        if not owns_batch(cursor, user_id, batch_id):
            conn.close()
            return jsonify({'success': False, 'message': 'Комплекс не найден'}), 404
        cursor.execute('''
            SELECT id, original_filename, mime_type, size, created_at,
                   record_type, record_id, draft_key, batch_id
            FROM attachments WHERE user_id = ? AND batch_id = ?
            ORDER BY created_at DESC
        ''', (user_id, batch_id))
    elif record_type in VALID_RECORD_TYPES and record_id:
        if not owns_record(cursor, user_id, record_type, record_id):
            conn.close()
            return jsonify({'success': False, 'message': 'Запись не найдена'}), 404
        cursor.execute('''
            SELECT id, original_filename, mime_type, size, created_at,
                   record_type, record_id, draft_key, batch_id
            FROM attachments WHERE user_id = ? AND record_type = ? AND record_id = ?
            ORDER BY created_at DESC
        ''', (user_id, record_type, record_id))
    else:
        conn.close()
        return jsonify({'success': False, 'message': 'Укажите record, draft_key или batch_id'}), 400

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'success': True, 'attachments': rows})


@app.route('/api/attachments', methods=['POST'])
@jwt_required()
def upload_attachment():
    user_id = int(get_jwt_identity())
    record_type = request.form.get('record_type', '')
    record_id = request.form.get('record_id', type=int)
    draft_key = request.form.get('draft_key', '').strip()
    batch_id = request.form.get('batch_id', '').strip()
    file = request.files.get('file')

    err = validate_upload(file)
    if err:
        return jsonify({'success': False, 'message': err}), 400

    conn = get_db()
    cursor = conn.cursor()

    if draft_key:
        target_filter = ('draft', draft_key)
    elif batch_id:
        if not owns_batch(cursor, user_id, batch_id):
            conn.close()
            return jsonify({'success': False, 'message': 'Комплекс не найден'}), 404
        target_filter = ('batch', batch_id)
    elif record_type in VALID_RECORD_TYPES and record_id:
        if not owns_record(cursor, user_id, record_type, record_id):
            conn.close()
            return jsonify({'success': False, 'message': 'Запись не найдена'}), 404
        target_filter = ('record', record_type, record_id)
    else:
        conn.close()
        return jsonify({'success': False, 'message': 'Укажите draft_key, batch_id или запись'}), 400

    if target_filter[0] == 'draft':
        cnt = _attachment_count(cursor, user_id, draft_key=target_filter[1])
    elif target_filter[0] == 'batch':
        cnt = _attachment_count(cursor, user_id, batch_id=target_filter[1])
    else:
        cnt = _attachment_count(cursor, user_id, record_type=target_filter[1], record_id=target_filter[2])
    if cnt >= 10:
        conn.close()
        return jsonify({'success': False, 'message': 'Не более 10 файлов'}), 400

    stored, _path = save_upload_file(file, user_id)
    if target_filter[0] == 'draft':
        cursor.execute('''
            INSERT INTO attachments (user_id, draft_key, original_filename,
                                     stored_filename, mime_type, size)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, draft_key, file.filename, stored, file.content_type or '', os.path.getsize(_path)))
    elif target_filter[0] == 'batch':
        cursor.execute('''
            INSERT INTO attachments (user_id, batch_id, original_filename,
                                     stored_filename, mime_type, size)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, batch_id, file.filename, stored, file.content_type or '', os.path.getsize(_path)))
    else:
        cursor.execute('''
            INSERT INTO attachments (user_id, record_type, record_id, original_filename,
                                     stored_filename, mime_type, size)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id, record_type, record_id, file.filename, stored,
            file.content_type or '', os.path.getsize(_path),
        ))
    conn.commit()
    aid = cursor.lastrowid
    cursor.execute('SELECT * FROM attachments WHERE id = ?', (aid,))
    row = dict(cursor.fetchone())
    conn.close()
    return jsonify({'success': True, 'attachment': row}), 201


@app.route('/api/attachments/<int:attachment_id>', methods=['GET'])
@jwt_required()
def download_attachment(attachment_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM attachments WHERE id = ? AND user_id = ?
    ''', (attachment_id, user_id))
    att = cursor.fetchone()
    conn.close()
    if not att:
        return jsonify({'success': False, 'message': 'Файл не найден'}), 404
    path = os.path.join(UPLOAD_DIR, str(user_id), att['stored_filename'])
    if not os.path.isfile(path):
        return jsonify({'success': False, 'message': 'Файл отсутствует на диске'}), 404
    return send_file(path, as_attachment=True, download_name=att['original_filename'])


@app.route('/api/attachments/<int:attachment_id>', methods=['DELETE'])
@jwt_required()
def delete_attachment(attachment_id):
    user_id = int(get_jwt_identity())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM attachments WHERE id = ? AND user_id = ?', (attachment_id, user_id))
    att = cursor.fetchone()
    if not att:
        conn.close()
        return jsonify({'success': False, 'message': 'Файл не найден'}), 404
    delete_stored_file(user_id, att['stored_filename'])
    cursor.execute('DELETE FROM attachments WHERE id = ?', (attachment_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ─── Admin ────────────────────────────────────────────────────────────────────

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as c FROM users')
    users_count = cursor.fetchone()['c']
    cursor.execute('SELECT COUNT(*) as c FROM appointments')
    appointments_count = cursor.fetchone()['c']
    cursor.execute('SELECT COUNT(*) as c FROM analyses')
    analyses_count = cursor.fetchone()['c']
    cursor.execute('SELECT COUNT(*) as c FROM user_vaccinations')
    vaccinations_count = cursor.fetchone()['c']
    cursor.execute('''
        SELECT id, name, email, role, email_verified, created_at FROM users
        ORDER BY created_at DESC LIMIT 50
    ''')
    recent_users = [_public_user(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({
        'success': True,
        'stats': {
            'users': users_count,
            'appointments': appointments_count,
            'analyses': analyses_count,
            'vaccinations': vaccinations_count,
        },
        'recent_users': recent_users,
    })


@app.route('/api/admin/vaccines', methods=['POST'])
@admin_required
def admin_create_vaccine():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'success': False, 'message': 'Название обязательно'}), 400
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO vaccines (name, description, category, is_active)
            VALUES (?, ?, ?, ?)
        ''', (name, data.get('description', ''), data.get('category', 'standard'),
              1 if data.get('is_active', True) else 0))
        conn.commit()
        vid = cursor.lastrowid
        cursor.execute('SELECT * FROM vaccines WHERE id = ?', (vid,))
        row = dict(cursor.fetchone())
    except Exception:
        conn.close()
        return jsonify({'success': False, 'message': 'Прививка уже существует'}), 400
    conn.close()
    return jsonify({'success': True, 'vaccine': row}), 201


@app.route('/api/admin/vaccines/<int:vaccine_id>', methods=['PUT'])
@admin_required
def admin_update_vaccine(vaccine_id):
    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()
    fields, values = [], []
    for key in ('name', 'description', 'category'):
        if key in data:
            fields.append(f'{key} = ?')
            values.append(data[key])
    if 'is_active' in data:
        fields.append('is_active = ?')
        values.append(1 if data['is_active'] else 0)
    if not fields:
        conn.close()
        return jsonify({'success': False, 'message': 'Нет данных'}), 400
    values.append(vaccine_id)
    cursor.execute(f"UPDATE vaccines SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    cursor.execute('SELECT * FROM vaccines WHERE id = ?', (vaccine_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({'success': False, 'message': 'Не найдено'}), 404
    return jsonify({'success': True, 'vaccine': dict(row)})


@app.route('/api/admin/vaccines/<int:vaccine_id>', methods=['DELETE'])
@admin_required
def admin_delete_vaccine(vaccine_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM vaccines WHERE id = ?', (vaccine_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    if not deleted:
        return jsonify({'success': False, 'message': 'Не найдено'}), 404
    return jsonify({'success': True})


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(user_id):
    admin_id = int(get_jwt_identity())
    if user_id == admin_id:
        return jsonify({'success': False, 'message': 'Нельзя удалить себя'}), 400
    if not delete_user_account(user_id):
        return jsonify({'success': False, 'message': 'Пользователь не найден'}), 404
    return jsonify({'success': True})


# ─── Calendar ─────────────────────────────────────────────────────────────────

@app.route('/api/calendar/events', methods=['GET'])
@jwt_required()
def get_calendar_events():
    user_id = int(get_jwt_identity())
    events = []
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, type, description, appointment_date, diagnosis
            FROM appointments WHERE user_id = ? AND appointment_date IS NOT NULL
        ''', (user_id,))
        for appt in cursor.fetchall():
            events.append({
                'id': f'appt_{appt["id"]}',
                'title': f'🩺 {appt["type"]}',
                'start': appt['appointment_date'],
                'className': 'event-appointment',
                'backgroundColor': '#3b82f6',
                'borderColor': '#2563eb',
                'extendedProps': {
                    'type': 'Приём',
                    'description': appt['description'] or '',
                    'diagnosis': appt['diagnosis'] or '',
                    'table': 'appointments',
                    'record_id': appt['id'],
                },
            })

        cursor.execute('''
            SELECT a.id, a.type, a.value, a.unit, a.analysis_date, a.notes,
                   a.batch_id, a.panel_id, p.name as panel_name
            FROM analyses a
            LEFT JOIN analysis_panels p ON a.panel_id = p.id
            WHERE a.user_id = ? AND a.analysis_date IS NOT NULL
            ORDER BY a.analysis_date, a.batch_id, a.id
        ''', (user_id,))
        analyses = [dict(r) for r in cursor.fetchall()]
        batch_groups = {}
        singles = []
        for a in analyses:
            if a.get('batch_id'):
                key = (a['analysis_date'], a['batch_id'])
                batch_groups.setdefault(key, []).append(a)
            else:
                singles.append(a)

        for a in singles:
            events.append({
                'id': f'analysis_{a["id"]}',
                'title': f'🧪 {a["type"]}: {a["value"]} {a["unit"]}',
                'start': a['analysis_date'],
                'className': 'event-analysis',
                'backgroundColor': '#8b5cf6',
                'borderColor': '#7c3aed',
                'extendedProps': {
                    'type': 'Анализ',
                    'description': a['notes'] or '',
                    'value': f'{a["value"]} {a["unit"]}',
                    'table': 'analyses',
                    'record_id': a['id'],
                    'is_panel_group': False,
                },
            })

        for (date, batch_id), items in batch_groups.items():
            panel_name = items[0].get('panel_name') or 'Комплекс анализов'
            summary = ', '.join(
                f'{it["type"]}: {it["value"]} {it["unit"]}' for it in items[:3]
            )
            if len(items) > 3:
                summary += f' (+{len(items) - 3})'
            events.append({
                'id': f'panel_{batch_id}',
                'title': f'🧪 {panel_name} ({len(items)})',
                'start': date,
                'className': 'event-analysis event-panel-group',
                'backgroundColor': '#7c3aed',
                'borderColor': '#5b21b6',
                'extendedProps': {
                    'type': 'Комплекс анализов',
                    'description': summary,
                    'table': 'analysis_panel',
                    'is_panel_group': True,
                    'batch_id': batch_id,
                    'panel_id': items[0].get('panel_id'),
                    'panel_name': panel_name,
                    'record_id': items[0]['id'],
                    'items': [
                        {
                            'id': it['id'],
                            'type': it['type'],
                            'value': it['value'],
                            'unit': it['unit'],
                            'notes': it.get('notes') or '',
                            'table': 'analyses',
                        }
                        for it in items
                    ],
                },
            })

        cursor.execute('''
            SELECT uv.id, uv.date_given, uv.notes, uv.custom_name,
                   v.name as vaccine_name, v.category
            FROM user_vaccinations uv
            LEFT JOIN vaccines v ON uv.vaccine_id = v.id
            WHERE uv.user_id = ? AND uv.date_given IS NOT NULL
        ''', (user_id,))
        colors = {
            'standard': ('#10b981', '#059669'),
            'travel': ('#f59e0b', '#d97706'),
            'work': ('#ef4444', '#dc2626'),
        }
        for vac in cursor.fetchall():
            name = vac['custom_name'] or vac['vaccine_name'] or 'Прививка'
            cat = vac['category'] or 'standard'
            bg, border = colors.get(cat, ('#6b7280', '#4b5563'))
            events.append({
                'id': f'vac_{vac["id"]}',
                'title': f'💉 {name}',
                'start': vac['date_given'],
                'className': f'event-vaccine event-{cat}',
                'backgroundColor': bg,
                'borderColor': border,
                'extendedProps': {
                    'type': 'Прививка',
                    'description': vac['notes'] or '',
                    'category': cat,
                    'table': 'user_vaccinations',
                    'record_id': vac['id'],
                },
            })
        conn.close()
        events.sort(key=lambda x: x['start'])
        return jsonify({'success': True, 'events': events})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@app.route('/api/calendar/events', methods=['POST'])
@jwt_required()
def add_calendar_event():
    import uuid as uuid_mod
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    table = data.get('table')
    event_date = data.get('date')
    description = data.get('description', '')
    extra = data.get('extra') or {}
    draft_key = (data.get('draft_key') or extra.get('draft_key') or '').strip()

    if not table or not event_date:
        return jsonify({'success': False, 'message': 'table и date обязательны'}), 400
    try:
        datetime.strptime(event_date, '%Y-%m-%d')
    except ValueError:
        return jsonify({'success': False, 'message': 'Дата в формате YYYY-MM-DD'}), 400

    conn = get_db()
    cursor = conn.cursor()
    new_id = None
    batch_id = None

    if table == 'appointments':
        doctor_id, doc_name = resolve_doctor(
            cursor, user_id,
            doctor_id=extra.get('doctor_id') or data.get('doctor_id'),
            name=data.get('title') or extra.get('doctor_name') or extra.get('type'),
        )
        if not doc_name:
            conn.close()
            return jsonify({'success': False, 'message': 'Укажите врача'}), 400
        cursor.execute('''
            INSERT INTO appointments (user_id, type, doctor_id, description, appointment_date, diagnosis)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, doc_name, doctor_id, description, event_date, extra.get('diagnosis', '')))
        new_id = cursor.lastrowid
        link_draft_attachments(cursor, user_id, draft_key, 'appointments', new_id)

    elif table == 'analyses':
        if extra.get('panel_results'):
            batch_id = str(uuid_mod.uuid4())
            panel_id = extra.get('panel_id')
            for r in extra['panel_results']:
                if not r.get('type') or r.get('value') in (None, ''):
                    continue
                cursor.execute('''
                    INSERT INTO analyses (user_id, type, analysis_date, unit, value, notes, panel_id, batch_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id, r['type'].strip(), event_date,
                    (r.get('unit') or '').strip(), str(r['value']).strip(),
                    r.get('notes', description), panel_id, batch_id,
                ))
            link_draft_to_batch(cursor, user_id, draft_key, batch_id)
            conn.commit()
            conn.close()
            return jsonify({
                'success': True,
                'message': 'Комплекс создан',
                'id': f'panel_{batch_id}',
                'batch_id': batch_id,
            }), 201

        analysis_type = (data.get('title') or extra.get('type') or '').strip()
        if extra.get('catalog_id'):
            cursor.execute('SELECT name, default_unit FROM analysis_catalog WHERE id = ?', (extra['catalog_id'],))
            cat = cursor.fetchone()
            if cat:
                analysis_type = cat['name']
                if not extra.get('unit'):
                    extra['unit'] = cat['default_unit']
        if not analysis_type:
            conn.close()
            return jsonify({'success': False, 'message': 'Укажите анализ'}), 400
        cursor.execute('''
            INSERT INTO analyses (user_id, type, analysis_date, unit, value, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            user_id, analysis_type, event_date,
            extra.get('unit', ''), str(extra.get('value', '')), description,
        ))
        new_id = cursor.lastrowid
        link_draft_attachments(cursor, user_id, draft_key, 'analyses', new_id)

    elif table == 'user_vaccinations':
        custom = extra.get('custom_name') or data.get('title')
        cursor.execute('''
            INSERT INTO user_vaccinations (user_id, vaccine_id, date_given, notes, custom_name)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, extra.get('vaccine_id'), event_date, description, custom))
        new_id = cursor.lastrowid
        link_draft_attachments(cursor, user_id, draft_key, 'user_vaccinations', new_id)
    else:
        conn.close()
        return jsonify({'success': False, 'message': 'Неизвестная таблица'}), 400

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Событие создано', 'id': f'{table}_{new_id}'}), 201


register_reference_routes(app)


@app.before_request
def _ensure_db_initialized():
    """При удалении БД на лету — пересоздать схему при первом запросе."""
    if not getattr(app, '_db_ready', False):
        try:
            init_db()
            app._db_ready = True
        except Exception:
            pass


if __name__ == '__main__':
    init_db()
    app._db_ready = True
    print('API запущен: http://localhost:5000')
    print('Демо: demo@example.com / demo123')
    print('Админ: admin@med.local / admin123')
    print('Коды email выводятся в консоль (MAIL_MODE=console)')
    app.run(debug=True, host='0.0.0.0', port=5000)
