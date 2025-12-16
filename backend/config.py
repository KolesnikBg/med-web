import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

# Абсолютный путь к папке с данными
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Создаем папку, если ее нет
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-super-secret-key-change-in-production')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-me')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    DATABASE = os.path.join(DATA_DIR, 'medical.db')  # Абсолютный путь
    CORS_ORIGINS = ['http://localhost:3000']  # React dev server