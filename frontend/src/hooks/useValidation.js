const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[А-Яа-яA-Za-z\s-]+$/;

export const computeRegistrationErrors = (formData) => {
    const errors = {};

    if (!formData.name?.trim() || formData.name.trim().length < 2) {
      errors.name = 'Введите имя (минимум 2 символа)';
    } else if (!NAME_REGEX.test(formData.name.trim())) {
      errors.name = 'Только буквы, пробелы и дефис';
    }

    if (!formData.lastname?.trim() || formData.lastname.trim().length < 2) {
      errors.lastname = 'Введите фамилию (минимум 2 символа)';
    } else if (!NAME_REGEX.test(formData.lastname.trim())) {
      errors.lastname = 'Только буквы, пробелы и дефис';
    }

    if (formData.patronymic?.trim()) {
      if (formData.patronymic.trim().length < 2) {
        errors.patronymic = 'Отчество — минимум 2 символа';
      } else if (!NAME_REGEX.test(formData.patronymic.trim())) {
        errors.patronymic = 'Только буквы, пробелы и дефис';
      }
    }

    if (!formData.email?.trim() || !EMAIL_REGEX.test(formData.email.trim())) {
      errors.email = 'Введите корректный email';
    }

    if (!formData.birth_date?.trim()) {
      errors.birth_date = 'Введите дату рождения';
    } else if (new Date(formData.birth_date) > new Date()) {
      errors.birth_date = 'Дата не может быть в будущем';
    }

    if (!formData.password || formData.password.length < 6) {
      errors.password = 'Пароль — минимум 6 символов';
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Нужны буквы и цифры';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Подтвердите пароль';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }

  return errors;
};

export const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return 'Пароль — минимум 6 символов';
  }
  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
    return 'Нужны буквы и цифры';
  }
  return '';
};

export const useValidation = (formData) => {
  const validate = () => {
    const errors = computeRegistrationErrors(formData);
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  return { validate };
};
