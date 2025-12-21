from flask_jwt_extended import create_access_token, create_refresh_token
from flask import jsonify
from datetime import datetime
from database import db

class Auth:
    @staticmethod
    def login(email, password):
        """Аутентификация пользователя"""
        if not db.verify_password(email, password):
            return None
        
        user = db.get_user_by_email(email)
        if not user:
            return None
        
        # Создаем JWT токены
        access_token = create_access_token(identity=user['id'])
        refresh_token = create_refresh_token(identity=user['id'])
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'birth_date': user['birth_date'],
                'sex_type': user['sex_type']
            }
        }
    
    @staticmethod
    def register(email, password, name, **kwargs):
        """Регистрация нового пользователя"""
        user = db.create_user(email, password, name, **kwargs)
        if not user:
            return None
        
        # Создаем JWT токены
        access_token = create_access_token(identity=user['id'])
        refresh_token = create_refresh_token(identity=user['id'])
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'birth_date': user['birth_date'],
                'sex_type': user['sex_type']
            }
        }