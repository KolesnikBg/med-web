import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
DB_PATH = os.path.join(DATA_DIR, 'medical.db')

SECRET_KEY = os.getenv('SECRET_KEY', 'super-secret-med-key')
JWT_ACCESS_TOKEN_EXPIRES_HOURS = int(os.getenv('JWT_EXPIRES_HOURS', '24'))

# Почта: console — коды в консоль (для разработки), smtp — реальная отправка
MAIL_MODE = os.getenv('MAIL_MODE', 'smtp').lower()
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
MAIL_FROM = os.getenv('MAIL_FROM', SMTP_USER or 'noreply@meddiary.local')

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # 10 МБ
ALLOWED_ATTACHMENT_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
    '.pdf', '.doc', '.docx', '.txt', '.heic',
}
ALLOWED_ATTACHMENT_MIMES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
}

VERIFICATION_CODE_TTL_MINUTES = 30
RESET_TOKEN_TTL_MINUTES = 60
TEMP_2FA_TOKEN_MINUTES = 10
