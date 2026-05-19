import os
import secrets
import uuid
from datetime import datetime, timedelta
from functools import wraps

import pyotp
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from werkzeug.utils import secure_filename

from config import (
    ALLOWED_ATTACHMENT_EXTENSIONS,
    ALLOWED_ATTACHMENT_MIMES,
    MAX_ATTACHMENT_BYTES,
    UPLOAD_DIR,
    VERIFICATION_CODE_TTL_MINUTES,
    RESET_TOKEN_TTL_MINUTES,
)
from db import get_db

VALID_RECORD_TYPES = {'appointments', 'analyses', 'user_vaccinations'}


def generate_code(length=6):
    return ''.join(secrets.choice('0123456789') for _ in range(length))


def code_expires(minutes):
    return (datetime.utcnow() + timedelta(minutes=minutes)).isoformat()


def is_expired(iso_str):
    if not iso_str:
        return True
    try:
        return datetime.utcnow() > datetime.fromisoformat(iso_str)
    except ValueError:
        return True


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = int(get_jwt_identity())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT role FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        if not row or row['role'] != 'admin':
            return jsonify({'success': False, 'message': 'Доступ запрещён'}), 403
        return fn(*args, **kwargs)
    return wrapper


def owns_record(cursor, user_id, record_type, record_id):
    if record_type == 'appointments':
        cursor.execute(
            'SELECT id FROM appointments WHERE id = ? AND user_id = ?',
            (record_id, user_id),
        )
    elif record_type == 'analyses':
        cursor.execute(
            'SELECT id FROM analyses WHERE id = ? AND user_id = ?',
            (record_id, user_id),
        )
    elif record_type == 'user_vaccinations':
        cursor.execute(
            'SELECT id FROM user_vaccinations WHERE id = ? AND user_id = ?',
            (record_id, user_id),
        )
    else:
        return False
    return cursor.fetchone() is not None


def validate_upload(file):
    if not file or not file.filename:
        return 'Файл не выбран'
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        return f'Тип файла не разрешён. Допустимо: {", ".join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))}'
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_ATTACHMENT_BYTES:
        return 'Файл превышает 10 МБ'
    if size == 0:
        return 'Пустой файл'
    mime = file.content_type or ''
    if mime and mime not in ALLOWED_ATTACHMENT_MIMES and not mime.startswith('image/'):
        return 'Недопустимый тип содержимого'
    return None


def save_upload_file(file, user_id):
    ext = os.path.splitext(secure_filename(file.filename))[1].lower()
    stored = f'{user_id}_{uuid.uuid4().hex}{ext}'
    user_dir = os.path.join(UPLOAD_DIR, str(user_id))
    os.makedirs(user_dir, exist_ok=True)
    path = os.path.join(user_dir, stored)
    file.save(path)
    return stored, path


def delete_stored_file(user_id, stored_filename):
    path = os.path.join(UPLOAD_DIR, str(user_id), stored_filename)
    if os.path.isfile(path):
        os.remove(path)


def create_totp_secret():
    return pyotp.random_base32()


def verify_totp(secret, code):
    if not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(str(code).strip(), valid_window=1)


def get_totp_uri(secret, email):
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name='МедДневник')
