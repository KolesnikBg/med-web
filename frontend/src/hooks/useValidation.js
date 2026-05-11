export const useValidation = (formData) => {
    const validate = () => {
        const errors = {};

        // ФИО
        if (!formData.name?.trim() || formData.name.trim().length < 2) {
            errors.name = 'Введите имя';
        }
        if (!formData.lastname?.trim() || formData.lastname.trim().length < 2) {
            errors.lastname = 'Введите фамилию';
        }
        if (formData.patronymic?.trim()) {
            if (formData.patronymic.trim().length < 2) {
                errors.patronymic = 'Введите отчество';
            }
        }

        // почта 
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email || !emailRegex.test(formData.email)) {
            errors.email = 'Введите корректный email';
        }

        // дата рождения 
        if (!formData.birth_date?.trim()) {
            errors.birth_date = 'Введите дату рождения';
        } else if (new Date(formData.birth_date) > new Date()) {
            errors.birth_date = 'Дата не может быть в будущем';
        }

        // пароль
        if (!formData.password || formData.password.length < 6) {
            errors.password = 'Пароль должен быть от 6 символов';
        }

        // подтверждение пароля
        if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Пароли не совпадают';
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    };

    return { validate };
};