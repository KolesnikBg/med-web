from datetime import datetime

class User:
    def __init__(self, id, email, password_hash, name, birth_date=None, 
                 blood_type=None, allergies=None, chronic_diseases=None,
                 emergency_contact=None, created_at=None):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.name = name
        self.birth_date = birth_date
        self.blood_type = blood_type
        self.allergies = allergies
        self.chronic_diseases = chronic_diseases
        self.emergency_contact = emergency_contact
        self.created_at = created_at or datetime.now().isoformat()
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'birth_date': self.birth_date,
            'blood_type': self.blood_type,
            'allergies': self.allergies,
            'chronic_diseases': self.chronic_diseases,
            'emergency_contact': self.emergency_contact,
            'created_at': self.created_at
        }

class Analysis:
    def __init__(self, id, user_id, type, date, result, unit, 
                 norm_min, norm_max, doctor=None, notes=None, created_at=None):
        self.id = id
        self.user_id = user_id
        self.type = type
        self.date = date
        self.result = result
        self.unit = unit
        self.norm_min = norm_min
        self.norm_max = norm_max
        self.doctor = doctor
        self.notes = notes
        self.created_at = created_at or datetime.now().isoformat()
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'date': self.date,
            'result': self.result,
            'unit': self.unit,
            'norm_min': self.norm_min,
            'norm_max': self.norm_max,
            'doctor': self.doctor,
            'notes': self.notes,
            'created_at': self.created_at
        }

class Appointment:
    def __init__(self, id, user_id, title, start_time, end_time, doctor,
                 specialty, location, status='scheduled', notes=None, created_at=None):
        self.id = id
        self.user_id = user_id
        self.title = title
        self.start_time = start_time
        self.end_time = end_time
        self.doctor = doctor
        self.specialty = specialty
        self.location = location
        self.status = status  # scheduled, completed, canceled
        self.notes = notes
        self.created_at = created_at or datetime.now().isoformat()
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'doctor': self.doctor,
            'specialty': self.specialty,
            'location': self.location,
            'status': self.status,
            'notes': self.notes,
            'created_at': self.created_at
        }