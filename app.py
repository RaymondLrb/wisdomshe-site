from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, make_response, redirect, request, send_from_directory, session
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / 'data' / 'applications.sqlite3'
ADMIN_USER = os.environ.get('WISDOMSHE_ADMIN_USER', 'admin')
ADMIN_PASS = os.environ.get('WISDOMSHE_ADMIN_PASS', 'Aa112211')
app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('WISDOMSHE_SECRET_KEY', 'wisdomshe-local-dev-secret')
app.config.update(SESSION_COOKIE_NAME='wisdomshe_admin_session', SESSION_COOKIE_SAMESITE='Lax')
CORS(app, supports_credentials=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with db() as conn:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                kind TEXT NOT NULL,
                name TEXT,
                company TEXT,
                phone TEXT,
                email TEXT,
                business_line TEXT,
                source_page TEXT,
                service_interest TEXT,
                project_stage TEXT,
                current_issue TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            '''
        )
        conn.commit()


def seed_if_empty() -> None:
    with db() as conn:
        count = conn.execute('SELECT COUNT(*) AS count FROM applications').fetchone()['count']
        if count:
            return
        samples = [
            {'kind': 'diagnostic', 'name': '王先生', 'company': '示例客户公司', 'phone': '+852 9123 4567', 'email': 'wang@example.com', 'business_line': 'industry', 'source_page': '/industry/', 'service_interest': '战略诊断', 'project_stage': '初步了解', 'current_issue': '希望先看项目方向是否匹配', 'status': 'new'},
            {'kind': 'membership', 'name': '李女士', 'company': '', 'phone': '+86 138 0000 0000', 'email': 'li@example.com', 'business_line': 'capital', 'source_page': '/portfolio/', 'service_interest': '组合结构设计', 'project_stage': '已沟通', 'current_issue': '需要查看组合管理的需求入口', 'status': 'reviewing'},
        ]
        for index, sample in enumerate(samples, start=1):
            timestamp = now_iso()
            conn.execute(
                '''
                INSERT INTO applications
                (code, kind, name, company, phone, email, business_line, source_page, service_interest, project_stage, current_issue, status, payload, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (f'REQ-{index:04d}', sample['kind'], sample.get('name'), sample.get('company'), sample.get('phone'), sample.get('email'), sample.get('business_line'), sample.get('source_page'), sample.get('service_interest'), sample.get('project_stage'), sample.get('current_issue'), sample.get('status', 'new'), json.dumps(sample, ensure_ascii=False), timestamp, timestamp),
            )
        conn.commit()


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    item = dict(row)
    item['payload'] = json.loads(item['payload'])
    return item


def bootstrap_storage() -> None:
    init_db(); seed_if_empty()


def is_admin_logged_in() -> bool:
    return bool(session.get('admin_logged_in'))


def require_admin():
    if not is_admin_logged_in():
        return jsonify({'success': False, 'error': '未登录'}), 401
    return None


@app.get('/')
def public_index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.get('/assets/<path:filename>')
def assets(filename: str):
    return send_from_directory(BASE_DIR / 'assets', filename)


@app.get('/admin/')
def admin_root():
    if is_admin_logged_in():
        return send_from_directory(BASE_DIR / 'admin', 'index.html')
    return send_from_directory(BASE_DIR / 'admin', 'login.html')


@app.get('/admin/index.html')
def admin_index():
    if not is_admin_logged_in():
        return redirect('/admin/login.html')
    return send_from_directory(BASE_DIR / 'admin', 'index.html')


@app.get('/admin/login.html')
def admin_login_page():
    return send_from_directory(BASE_DIR / 'admin', 'login.html')


@app.post('/api/admin/login')
def admin_login():
    payload = request.get_json(force=True, silent=False) or {}
    username = str(payload.get('username', '')).strip()
    password = str(payload.get('password', '')).strip()
    if username != ADMIN_USER or password != ADMIN_PASS:
        return jsonify({'success': False, 'error': '用户名或密码错误'}), 401
    session['admin_logged_in'] = True
    session['admin_user'] = ADMIN_USER
    return jsonify({'success': True})


@app.post('/api/admin/logout')
def admin_logout():
    session.clear()
    return jsonify({'success': True})


@app.get('/api/admin/me')
def admin_me():
    if not is_admin_logged_in():
        return jsonify({'success': False, 'logged_in': False}), 401
    return jsonify({'success': True, 'logged_in': True, 'username': ADMIN_USER})


@app.get('/api/health')
def health():
    return jsonify({'success': True, 'service': 'wisdomshe-site', 'time': now_iso()})


@app.get('/api/applications')
def list_applications():
    auth = require_admin()
    if auth:
        return auth
    with db() as conn:
        rows = conn.execute('SELECT * FROM applications ORDER BY created_at DESC, id DESC').fetchall()
    return jsonify({'success': True, 'items': [row_to_dict(row) for row in rows], 'count': len(rows)})


@app.post('/api/applications')
def create_application():
    payload = request.get_json(force=True, silent=False) or {}
    required = ['kind', 'name', 'phone', 'business_line', 'source_page', 'current_issue']
    missing = [field for field in required if not str(payload.get(field, '')).strip()]
    if missing:
        return jsonify({'success': False, 'error': f"缺少字段: {', '.join(missing)}"}), 400
    timestamp = now_iso(); kind = str(payload.get('kind', 'diagnostic')).strip() or 'diagnostic'
    with db() as conn:
        next_id = conn.execute('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM applications').fetchone()['next_id']
        code = f'REQ-{next_id:04d}'
        conn.execute('INSERT INTO applications (code, kind, name, company, phone, email, business_line, source_page, service_interest, project_stage, current_issue, status, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', (code, kind, str(payload.get('name', '')).strip(), str(payload.get('company', '')).strip(), str(payload.get('phone', '')).strip(), str(payload.get('email', '')).strip(), str(payload.get('business_line', 'general')).strip(), str(payload.get('source_page', '')).strip(), str(payload.get('service_interest', '')).strip(), str(payload.get('project_stage', '')).strip(), str(payload.get('current_issue', '')).strip(), 'new', json.dumps(payload, ensure_ascii=False), timestamp, timestamp))
        conn.commit()
    return jsonify({'success': True, 'application': {'code': code, 'created_at': timestamp}})


@app.patch('/api/applications/<int:application_id>')
def update_application(application_id: int):
    auth = require_admin()
    if auth:
        return auth
    payload = request.get_json(force=True, silent=False) or {}
    status = str(payload.get('status', '')).strip().lower()
    if status not in {'new', 'reviewing', 'closed'}:
        return jsonify({'success': False, 'error': '状态值不合法'}), 400
    timestamp = now_iso()
    with db() as conn:
        updated = conn.execute('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?', (status, timestamp, application_id))
        conn.commit()
        if updated.rowcount == 0:
            return jsonify({'success': False, 'error': '记录不存在'}), 404
        row = conn.execute('SELECT * FROM applications WHERE id = ?', (application_id,)).fetchone()
    return jsonify({'success': True, 'application': row_to_dict(row)})


@app.delete('/api/applications/<int:application_id>')
def delete_application(application_id: int):
    auth = require_admin()
    if auth:
        return auth
    with db() as conn:
        deleted = conn.execute('DELETE FROM applications WHERE id = ?', (application_id,))
        conn.commit()
        if deleted.rowcount == 0:
            return jsonify({'success': False, 'error': '记录不存在'}), 404
    return jsonify({'success': True})


if __name__ == '__main__':
    bootstrap_storage()
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '8801')), debug=True)
