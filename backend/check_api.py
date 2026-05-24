"""Проверка БД и основных API после пересоздания medical.db."""
import json
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.chdir(BASE)

from db import DB_PATH, init_db, get_db
from app import app


def ok(msg):
    print(f'  OK  {msg}')


def fail(msg, detail=''):
    print(f'  FAIL {msg} {detail}')
    return False


def main():
    print('=== init_db ===')
    try:
        init_db()
        ok('init_db')
    except Exception as e:
        fail('init_db', str(e))
        return 1

    conn = get_db()
    cur = conn.cursor()
    for table in (
        'users', 'appointments', 'analyses', 'vaccines', 'user_vaccinations',
        'attachments', 'doctors', 'analysis_catalog', 'analysis_panels',
        'analysis_panel_items', 'vaccine_schedules',
    ):
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        )
        if not cur.fetchone():
            fail(f'таблица {table}')
            return 1
    ok('все таблицы на месте')

    cur.execute('SELECT COUNT(*) FROM users')
    users_n = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM doctors WHERE user_id IS NULL')
    doctors_n = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM analysis_panels WHERE user_id IS NULL')
    panels_n = cur.fetchone()[0]
    conn.close()
    ok(f'users={users_n}, doctors={doctors_n}, panels={panels_n}')

    client = app.test_client()
    errors = []

    def check(name, resp, expect=200):
        if resp.status_code != expect:
            errors.append(f'{name}: HTTP {resp.status_code} {resp.get_data(as_text=True)[:200]}')
            return None
        return resp.get_json()

    print('\n=== API без авторизации ===')
    data = check('GET /', client.get('/'))
    if data and data.get('status') == 'ok':
        ok('GET /')
    else:
        errors.append('GET /')

    print('\n=== demo login ===')
    data = check('login', client.post('/api/auth/login', json={
        'email': 'demo@example.com',
        'password': 'demo123',
    }))
    if not data or not data.get('access_token'):
        errors.append('demo login')
        for e in errors:
            print(' ', e)
        return 1
    token = data['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    ok('demo login')

    endpoints = [
        ('GET', '/api/user/profile'),
        ('GET', '/api/appointments'),
        ('GET', '/api/analyses'),
        ('GET', '/api/vaccines'),
        ('GET', '/api/user/vaccinations'),
        ('GET', '/api/doctors'),
        ('GET', '/api/analysis-catalog'),
        ('GET', '/api/analysis-panels'),
        ('GET', '/api/calendar/events'),
        ('GET', '/api/user/vaccination-recommendations'),
    ]
    print('\n=== API с токеном demo ===')
    for method, path in endpoints:
        resp = client.get(path, headers=headers)
        data = check(path, resp)
        if data and data.get('success') is not False:
            ok(path)
        else:
            errors.append(path)

    print('\n=== admin login ===')
    data = check('admin login', client.post('/api/auth/login', json={
        'email': 'admin@med.local',
        'password': 'admin123',
    }))
    if data and data.get('access_token'):
        ah = {'Authorization': f'Bearer {data["access_token"]}'}
        for path in ('/api/admin/stats', '/api/admin/doctors'):
            resp = client.get(path, headers=ah)
            if check(path, resp):
                ok(path)
            else:
                errors.append(path)
    else:
        errors.append('admin login')

    print('\n=== register (новый пользователь) ===')
    resp = client.post('/api/auth/register', json={
        'email': 'test_check@example.com',
        'password': 'test1234',
        'sex': 'male',
        'birth_date': '1995-05-05',
        'lastname': 'Тестов',
        'name': 'Проверка',
    })
    if resp.status_code in (201, 409):
        ok(f'register HTTP {resp.status_code}')
    else:
        errors.append(f'register HTTP {resp.status_code}')

    print(f'\nDB: {DB_PATH}')
    if errors:
        print('\nОшибки:')
        for e in errors:
            print(' -', e)
        return 1
    print('\nВсе проверки пройдены.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
