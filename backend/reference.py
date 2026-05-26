"""Справочники: врачи, каталог анализов, панели, периодизация прививок."""

import uuid
from datetime import datetime

from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from db import get_db
from utils import admin_required


def seed_reference_data(cursor):
    cursor.execute('SELECT COUNT(*) FROM doctors WHERE user_id IS NULL')
    if cursor.fetchone()[0] == 0:
        for doc_name in (
            'Терапевт', 'Стоматолог', 'Травматолог', 'Кардиолог',
            'Окулист', 'Дерматолог', 'Эндокринолог', 'Невролог',
        ):
            cursor.execute(
                'INSERT INTO doctors (name, user_id) VALUES (?, NULL)',
                (doc_name,),
            )

    cursor.execute('SELECT COUNT(*) FROM analysis_catalog WHERE user_id IS NULL')
    if cursor.fetchone()[0] == 0:
        items = [
            ('Гемоглобин', 'г/л'),
            ('Эритроциты', '×10¹²/л'),
            ('Лейкоциты', '×10⁹/л'),
            ('Тромбоциты', '×10⁹/л'),
            ('Глюкоза', 'ммоль/л'),
            ('Холестерин', 'ммоль/л'),
            ('АЛТ', 'Ед/л'),
            ('АСТ', 'Ед/л'),
            ('Креатинин', 'мкмоль/л'),
        ]
        ids = []
        for name, unit in items:
            cursor.execute(
                'INSERT INTO analysis_catalog (name, default_unit, user_id) VALUES (?, ?, NULL)',
                (name, unit),
            )
            ids.append(cursor.lastrowid)

        cursor.execute(
            'INSERT INTO analysis_panels (name, description, user_id) VALUES (?, ?, NULL)',
            ('Общий анализ крови', 'Базовый комплекс показателей крови',),
        )
        panel_id = cursor.lastrowid
        for i, cid in enumerate(ids[:5]):
            cursor.execute(
                'SELECT name, default_unit FROM analysis_catalog WHERE id = ?',
                (cid,),
            )
            row = cursor.fetchone()
            cursor.execute('''
                INSERT INTO analysis_panel_items (panel_id, catalog_id, item_name, default_unit, sort_order)
                VALUES (?, ?, ?, ?, ?)
            ''', (panel_id, cid, row['name'], row['default_unit'], i))

    cursor.execute('SELECT COUNT(*) FROM vaccine_schedules')
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT id FROM vaccines WHERE name = 'Грипп'")
        flu = cursor.fetchone()
        if flu:
            cursor.execute('''
                INSERT INTO vaccine_schedules (vaccine_id, schedule_type, interval_years)
                VALUES (?, 'interval', 1)
            ''', (flu['id'],))
        cursor.execute("SELECT id FROM vaccines WHERE name = 'Столбняк'")
        tet = cursor.fetchone()
        if tet:
            cursor.execute('''
                INSERT INTO vaccine_schedules (vaccine_id, schedule_type, interval_years)
                VALUES (?, 'interval', 10)
            ''', (tet['id'],))


def _doctor_visible_clause(user_id):
    return '(user_id IS NULL OR user_id = ?)'


def _catalog_visible_clause(user_id):
    return '(user_id IS NULL OR user_id = ?) AND is_active = 1'


def _panel_visible_clause(user_id):
    return '(user_id IS NULL OR user_id = ?)'


def resolve_doctor(cursor, user_id, doctor_id=None, name=None, specialty=None, doctor_name=None):
    doc_name = (name or specialty or doctor_name or '').strip()
    if doctor_id:
        cursor.execute(
            f'SELECT id, name FROM doctors WHERE id = ? AND {_doctor_visible_clause(user_id)}',
            (doctor_id, user_id),
        )
        row = cursor.fetchone()
        if row:
            return row['id'], row['name']
    if not doc_name:
        return None, None
    cursor.execute(
        f'SELECT id, name FROM doctors WHERE name = ? AND {_doctor_visible_clause(user_id)}',
        (doc_name, user_id),
    )
    row = cursor.fetchone()
    if row:
        return row['id'], row['name']
    cursor.execute(
        'INSERT INTO doctors (name, user_id) VALUES (?, ?)',
        (doc_name, user_id),
    )
    return cursor.lastrowid, doc_name


def _panel_with_items(cursor, panel_id):
    cursor.execute('SELECT * FROM analysis_panels WHERE id = ?', (panel_id,))
    panel = cursor.fetchone()
    if not panel:
        return None
    cursor.execute('''
        SELECT pi.*, c.name as catalog_name, c.default_unit as catalog_unit
        FROM analysis_panel_items pi
        LEFT JOIN analysis_catalog c ON pi.catalog_id = c.id
        WHERE pi.panel_id = ?
        ORDER BY pi.sort_order, pi.id
    ''', (panel_id,))
    items = [dict(r) for r in cursor.fetchall()]
    d = dict(panel)
    d['items'] = items
    return d


def register_reference_routes(app):
    # ─── Doctors ──────────────────────────────────────────────────────────────

    @app.route('/api/doctors', methods=['GET'])
    @jwt_required()
    def list_doctors():
        user_id = int(get_jwt_identity())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(f'''
            SELECT id, name, user_id,
                   CASE WHEN user_id IS NULL THEN 1 ELSE 0 END as is_global
            FROM doctors
            WHERE {_doctor_visible_clause(user_id)}
            ORDER BY is_global DESC, name
        ''', (user_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'doctors': rows})

    @app.route('/api/doctors', methods=['POST'])
    @jwt_required()
    def create_user_doctor():
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        doc_name = (data.get('name') or '').strip()
        if not doc_name:
            return jsonify({'success': False, 'message': 'Укажите название'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id FROM doctors WHERE name = ? AND user_id = ?',
            (doc_name, user_id),
        )
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Уже есть в списке'}), 400
        cursor.execute(
            'INSERT INTO doctors (name, user_id) VALUES (?, ?)',
            (doc_name, user_id),
        )
        conn.commit()
        did = cursor.lastrowid
        cursor.execute('SELECT id, name, user_id FROM doctors WHERE id = ?', (did,))
        row = dict(cursor.fetchone())
        conn.close()
        return jsonify({'success': True, 'doctor': row}), 201

    @app.route('/api/admin/doctors', methods=['GET'])
    @admin_required
    def admin_list_doctors():
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, name, user_id FROM doctors WHERE user_id IS NULL ORDER BY name
        ''')
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'doctors': rows})

    @app.route('/api/admin/doctors', methods=['POST'])
    @admin_required
    def admin_create_doctor():
        data = request.get_json() or {}
        doc_name = (data.get('name') or '').strip()
        if not doc_name:
            return jsonify({'success': False, 'message': 'Название обязательно'}), 400
        conn = get_db()
        cursor = conn.cursor()
        try:
            cursor.execute(
                'INSERT INTO doctors (name, user_id) VALUES (?, NULL)',
                (doc_name,),
            )
            conn.commit()
            did = cursor.lastrowid
            cursor.execute('SELECT id, name FROM doctors WHERE id = ?', (did,))
            row = dict(cursor.fetchone())
        except Exception:
            conn.close()
            return jsonify({'success': False, 'message': 'Уже существует'}), 400
        conn.close()
        return jsonify({'success': True, 'doctor': row}), 201

    @app.route('/api/admin/doctors/<int:doctor_id>', methods=['DELETE'])
    @admin_required
    def admin_delete_doctor(doctor_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM doctors WHERE id = ? AND user_id IS NULL', (doctor_id,))
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        if not deleted:
            return jsonify({'success': False, 'message': 'Не найден'}), 404
        return jsonify({'success': True})

    # ─── Analysis catalog ─────────────────────────────────────────────────────

    @app.route('/api/analysis-catalog', methods=['GET'])
    @jwt_required()
    def list_catalog():
        user_id = int(get_jwt_identity())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(f'''
            SELECT id, name, default_unit, user_id,
                   CASE WHEN user_id IS NULL THEN 1 ELSE 0 END as is_global
            FROM analysis_catalog
            WHERE {_catalog_visible_clause(user_id)}
            ORDER BY is_global DESC, name
        ''', (user_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'catalog': rows})

    @app.route('/api/analysis-catalog', methods=['POST'])
    @jwt_required()
    def create_catalog_item():
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'success': False, 'message': 'Название обязательно'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO analysis_catalog (name, default_unit, user_id) VALUES (?, ?, ?)',
            (name, data.get('default_unit', ''), user_id),
        )
        conn.commit()
        cid = cursor.lastrowid
        cursor.execute('SELECT * FROM analysis_catalog WHERE id = ?', (cid,))
        row = dict(cursor.fetchone())
        conn.close()
        return jsonify({'success': True, 'item': row}), 201

    @app.route('/api/admin/analysis-catalog', methods=['POST'])
    @admin_required
    def admin_create_catalog():
        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'success': False, 'message': 'Название обязательно'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO analysis_catalog (name, default_unit, user_id) VALUES (?, ?, NULL)',
            (name, data.get('default_unit', '')),
        )
        conn.commit()
        cid = cursor.lastrowid
        cursor.execute('SELECT * FROM analysis_catalog WHERE id = ?', (cid,))
        row = dict(cursor.fetchone())
        conn.close()
        return jsonify({'success': True, 'item': row}), 201

    @app.route('/api/admin/analysis-catalog/<int:item_id>', methods=['DELETE'])
    @admin_required
    def admin_delete_catalog(item_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE analysis_catalog SET is_active = 0 WHERE id = ? AND user_id IS NULL',
            (item_id,),
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    # ─── Analysis panels ──────────────────────────────────────────────────────

    @app.route('/api/analysis-panels', methods=['GET'])
    @jwt_required()
    def list_panels():
        user_id = int(get_jwt_identity())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(f'''
            SELECT id, name, description, user_id,
                   CASE WHEN user_id IS NULL THEN 1 ELSE 0 END as is_global
            FROM analysis_panels
            WHERE {_panel_visible_clause(user_id)}
            ORDER BY is_global DESC, name
        ''', (user_id,))
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'panels': rows})

    @app.route('/api/analysis-panels/<int:panel_id>', methods=['GET'])
    @jwt_required()
    def get_panel(panel_id):
        user_id = int(get_jwt_identity())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(f'''
            SELECT id FROM analysis_panels WHERE id = ? AND {_panel_visible_clause(user_id)}
        ''', (panel_id, user_id))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Панель не найдена'}), 404
        panel = _panel_with_items(cursor, panel_id)
        conn.close()
        return jsonify({'success': True, 'panel': panel})

    @app.route('/api/analysis-panels', methods=['POST'])
    @jwt_required()
    def create_panel():
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        items = data.get('items') or []
        if not name:
            return jsonify({'success': False, 'message': 'Название панели обязательно'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO analysis_panels (name, description, user_id) VALUES (?, ?, ?)',
            (name, data.get('description', ''), user_id),
        )
        panel_id = cursor.lastrowid
        for i, it in enumerate(items):
            cursor.execute('''
                INSERT INTO analysis_panel_items (panel_id, catalog_id, item_name, default_unit, sort_order)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                panel_id,
                it.get('catalog_id'),
                it.get('item_name', '').strip() or 'Показатель',
                it.get('default_unit', ''),
                i,
            ))
        conn.commit()
        panel = _panel_with_items(cursor, panel_id)
        conn.close()
        return jsonify({'success': True, 'panel': panel}), 201

    @app.route('/api/admin/analysis-panels', methods=['POST'])
    @admin_required
    def admin_create_panel():
        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        items = data.get('items') or []
        if not name:
            return jsonify({'success': False, 'message': 'Название обязательно'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO analysis_panels (name, description, user_id) VALUES (?, ?, NULL)',
            (name, data.get('description', '')),
        )
        panel_id = cursor.lastrowid
        for i, it in enumerate(items):
            iname = it.get('item_name', '').strip()
            if not iname and it.get('catalog_id'):
                cursor.execute('SELECT name, default_unit FROM analysis_catalog WHERE id = ?', (it['catalog_id'],))
                c = cursor.fetchone()
                iname, unit = c['name'], c['default_unit'] if c else ('', '')
            else:
                unit = it.get('default_unit', '')
            cursor.execute('''
                INSERT INTO analysis_panel_items (panel_id, catalog_id, item_name, default_unit, sort_order)
                VALUES (?, ?, ?, ?, ?)
            ''', (panel_id, it.get('catalog_id'), iname, unit, i))
        conn.commit()
        panel = _panel_with_items(cursor, panel_id)
        conn.close()
        return jsonify({'success': True, 'panel': panel}), 201

    @app.route('/api/admin/analysis-panels/<int:panel_id>', methods=['PUT'])
    @admin_required
    def admin_update_panel(panel_id):
        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        items = data.get('items')
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id FROM analysis_panels WHERE id = ? AND user_id IS NULL',
            (panel_id,),
        )
        if not cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'Панель не найдена'}), 404
        if name:
            cursor.execute(
                'UPDATE analysis_panels SET name = ?, description = ? WHERE id = ?',
                (name, data.get('description', ''), panel_id),
            )
        elif 'description' in data:
            cursor.execute(
                'UPDATE analysis_panels SET description = ? WHERE id = ?',
                (data.get('description', ''), panel_id),
            )
        if items is not None:
            cursor.execute('DELETE FROM analysis_panel_items WHERE panel_id = ?', (panel_id,))
            for i, it in enumerate(items):
                iname = (it.get('item_name') or '').strip()
                unit = it.get('default_unit', '')
                if not iname and it.get('catalog_id'):
                    cursor.execute(
                        'SELECT name, default_unit FROM analysis_catalog WHERE id = ?',
                        (it['catalog_id'],),
                    )
                    c = cursor.fetchone()
                    if c:
                        iname, unit = c['name'], c['default_unit']
                if not iname:
                    continue
                cursor.execute('''
                    INSERT INTO analysis_panel_items (panel_id, catalog_id, item_name, default_unit, sort_order)
                    VALUES (?, ?, ?, ?, ?)
                ''', (panel_id, it.get('catalog_id'), iname, unit, i))
        conn.commit()
        panel = _panel_with_items(cursor, panel_id)
        conn.close()
        return jsonify({'success': True, 'panel': panel})

    @app.route('/api/admin/analysis-panels/<int:panel_id>', methods=['DELETE'])
    @admin_required
    def admin_delete_panel(panel_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'DELETE FROM analysis_panels WHERE id = ? AND user_id IS NULL',
            (panel_id,),
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        if not deleted:
            return jsonify({'success': False, 'message': 'Панель не найдена'}), 404
        return jsonify({'success': True})

    @app.route('/api/analyses/batch', methods=['POST'])
    @jwt_required()
    def create_analyses_batch():
        user_id = int(get_jwt_identity())
        data = request.get_json() or {}
        analysis_date = data.get('analysis_date')
        rows = data.get('results') or []
        panel_id = data.get('panel_id')
        draft_key = (data.get('draft_key') or '').strip()
        if not analysis_date or not rows:
            return jsonify({'success': False, 'message': 'Дата и результаты обязательны'}), 400
        batch_id = str(uuid.uuid4())
        conn = get_db()
        cursor = conn.cursor()
        if panel_id:
            cursor.execute(f'''
                SELECT id FROM analysis_panels WHERE id = ? AND {_panel_visible_clause(user_id)}
            ''', (panel_id, user_id))
            if not cursor.fetchone():
                conn.close()
                return jsonify({'success': False, 'message': 'Панель не найдена'}), 404
        created = []
        for r in rows:
            if not r.get('type') or r.get('value') in (None, ''):
                continue
            cursor.execute('''
                INSERT INTO analyses (user_id, type, analysis_date, unit, value, panel_id, batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                r['type'].strip(),
                analysis_date,
                (r.get('unit') or '').strip(),
                str(r['value']).strip(),
                panel_id,
                batch_id,
            ))
            aid = cursor.lastrowid
            cursor.execute('SELECT * FROM analyses WHERE id = ?', (aid,))
            created.append(dict(cursor.fetchone()))
        if not created:
            conn.close()
            return jsonify({'success': False, 'message': 'Нет данных для сохранения'}), 400
        from utils import link_draft_to_batch
        link_draft_to_batch(cursor, user_id, draft_key, batch_id)
        conn.commit()
        conn.close()
        return jsonify({
            'success': True,
            'analyses': created,
            'count': len(created),
            'batch_id': batch_id,
            'panel_id': panel_id,
        }), 201

    @app.route('/api/analyses/batch/<batch_id>', methods=['DELETE'])
    @jwt_required()
    def delete_analyses_batch(batch_id):
        from utils import delete_stored_file
        user_id = int(get_jwt_identity())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id FROM analyses WHERE user_id = ? AND batch_id = ?',
            (user_id, batch_id),
        )
        ids = [r['id'] for r in cursor.fetchall()]
        if not ids:
            conn.close()
            return jsonify({'success': False, 'message': 'Комплекс не найден'}), 404
        for aid in ids:
            cursor.execute(
                'SELECT stored_filename FROM attachments WHERE user_id = ? AND record_type = ? AND record_id = ?',
                (user_id, 'analyses', aid),
            )
            for att in cursor.fetchall():
                delete_stored_file(user_id, att['stored_filename'])
            cursor.execute(
                'DELETE FROM attachments WHERE user_id = ? AND record_type = ? AND record_id = ?',
                (user_id, 'analyses', aid),
            )
        cursor.execute(
            'SELECT stored_filename FROM attachments WHERE user_id = ? AND batch_id = ?',
            (user_id, batch_id),
        )
        for att in cursor.fetchall():
            delete_stored_file(user_id, att['stored_filename'])
        cursor.execute(
            'DELETE FROM attachments WHERE user_id = ? AND batch_id = ?',
            (user_id, batch_id),
        )
        cursor.execute(
            'DELETE FROM analyses WHERE user_id = ? AND batch_id = ?',
            (user_id, batch_id),
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'deleted': len(ids)})

    # ─── Vaccine schedules ────────────────────────────────────────────────────

    @app.route('/api/vaccine-schedules', methods=['GET'])
    @jwt_required()
    def list_vaccine_schedules():
        vaccine_id = request.args.get('vaccine_id', type=int)
        conn = get_db()
        cursor = conn.cursor()
        if vaccine_id:
            cursor.execute(
                'SELECT * FROM vaccine_schedules WHERE vaccine_id = ? ORDER BY schedule_type, age_years',
                (vaccine_id,),
            )
        else:
            cursor.execute('''
                SELECT vs.*, v.name as vaccine_name
                FROM vaccine_schedules vs
                JOIN vaccines v ON v.id = vs.vaccine_id
                ORDER BY v.name
            ''')
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'schedules': rows})

    @app.route('/api/admin/vaccine-schedules', methods=['POST'])
    @admin_required
    def admin_create_schedule():
        data = request.get_json() or {}
        vaccine_id = data.get('vaccine_id')
        schedule_type = data.get('schedule_type')
        if not vaccine_id or schedule_type not in ('interval', 'age'):
            return jsonify({'success': False, 'message': 'Некорректные данные'}), 400
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO vaccine_schedules (vaccine_id, schedule_type, interval_years, age_years)
            VALUES (?, ?, ?, ?)
        ''', (
            vaccine_id,
            schedule_type,
            data.get('interval_years'),
            data.get('age_years'),
        ))
        conn.commit()
        sid = cursor.lastrowid
        cursor.execute('SELECT * FROM vaccine_schedules WHERE id = ?', (sid,))
        row = dict(cursor.fetchone())
        conn.close()
        return jsonify({'success': True, 'schedule': row}), 201

    @app.route('/api/admin/vaccine-schedules/<int:schedule_id>', methods=['DELETE'])
    @admin_required
    def admin_delete_schedule(schedule_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM vaccine_schedules WHERE id = ?', (schedule_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True})

    @app.route('/api/user/vaccination-recommendations', methods=['GET'])
    @jwt_required()
    def vaccination_recommendations():
        user_id = int(get_jwt_identity())
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT birth_date FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        birth = user['birth_date'] if user else None
        age = None
        if birth:
            today = datetime.utcnow().date()
            bd = datetime.strptime(birth[:10], '%Y-%m-%d').date()
            age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))

        cursor.execute('''
            SELECT uv.vaccine_id, uv.date_given, v.name as vaccine_name, uv.custom_name
            FROM user_vaccinations uv
            LEFT JOIN vaccines v ON v.id = uv.vaccine_id
            WHERE uv.user_id = ?
        ''', (user_id,))
        history = cursor.fetchall()
        last_by_vaccine = {}
        for h in history:
            vid = h['vaccine_id']
            if vid and (vid not in last_by_vaccine or h['date_given'] > last_by_vaccine[vid]['date']):
                last_by_vaccine[vid] = {'date': h['date_given'], 'name': h['vaccine_name']}

        cursor.execute('''
            SELECT vs.*, v.name as vaccine_name
            FROM vaccine_schedules vs
            JOIN vaccines v ON v.id = vs.vaccine_id
            WHERE v.is_active = 1
        ''')
        schedules = cursor.fetchall()
        recommendations = []

        for sch in schedules:
            vid = sch['vaccine_id']
            vname = sch['vaccine_name']
            if sch['schedule_type'] == 'interval' and sch['interval_years']:
                last = last_by_vaccine.get(vid)
                if last:
                    from datetime import datetime as dt
                    last_d = dt.strptime(last['date'][:10], '%Y-%m-%d').date()
                    years = (datetime.utcnow().date() - last_d).days / 365.25
                    if years >= sch['interval_years']:
                        recommendations.append({
                            'vaccine_id': vid,
                            'vaccine_name': vname,
                            'reason': f'Прошло {years:.1f} лет с последней прививки',
                            'schedule_type': 'interval',
                        })
                else:
                    recommendations.append({
                        'vaccine_id': vid,
                        'vaccine_name': vname,
                        'reason': 'Ещё не отмечена в истории',
                        'schedule_type': 'interval',
                    })
            elif sch['schedule_type'] == 'age' and sch['age_years'] is not None and age is not None:
                if age >= sch['age_years'] and vid not in last_by_vaccine:
                    recommendations.append({
                        'vaccine_id': vid,
                        'vaccine_name': vname,
                        'reason': f'Рекомендуется с {sch["age_years"]} лет (вам {age})',
                        'schedule_type': 'age',
                    })

        conn.close()
        return jsonify({'success': True, 'recommendations': recommendations, 'age': age})
