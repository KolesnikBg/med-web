import smtplib
from email.mime.text import MIMEText

from config import (
    MAIL_MODE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM,
)


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Отправка письма. В режиме console печатает в лог."""
    if MAIL_MODE == 'console':
        print('\n' + '=' * 50)
        print(f'[EMAIL] To: {to_email}')
        print(f'[EMAIL] Subject: {subject}')
        print(body)
        print('=' * 50 + '\n')
        return True

    if not SMTP_USER or not SMTP_PASSWORD:
        print(f'[EMAIL ERROR] SMTP не настроен. Письмо для {to_email}: {subject}')
        return False

    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = MAIL_FROM
    msg['To'] = to_email

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f'[EMAIL ERROR] {e}')
        return False


def send_verification_code(email: str, code: str) -> bool:
    body = (
        f'Здравствуйте!\n\n'
        f'Код подтверждения регистрации в МедДневник: {code}\n\n'
        f'Код действует 30 минут.\n'
    )
    return send_email(email, 'Подтверждение регистрации — МедДневник', body)


def send_password_reset(email: str, code: str) -> bool:
    body = (
        f'Здравствуйте!\n\n'
        f'Код для сброса пароля: {code}\n\n'
        f'Если вы не запрашивали сброс, проигнорируйте это письмо.\n'
    )
    return send_email(email, 'Сброс пароля — МедДневник', body)
