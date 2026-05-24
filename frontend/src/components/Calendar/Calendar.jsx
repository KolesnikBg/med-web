import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import ruLocale from '@fullcalendar/core/locales/ru';
import timeGridPlugin from '@fullcalendar/timegrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import './Calendar.css';
import api from '../../services/api';
import Attachments from '../Attachments';

// Типы событий
const EVENT_TYPES = {
    APPOINTMENT: 'appointments',
    ANALYSIS: 'analyses',
    VACCINATION: 'user_vaccinations'
};

const TYPE_LABELS = {
    [EVENT_TYPES.APPOINTMENT]: 'Приём',
    [EVENT_TYPES.ANALYSIS]: 'Анализ',
    [EVENT_TYPES.VACCINATION]: 'Прививка'
};

const parseRecordId = (idStr) => {
    if (!idStr) return null;
    const m = String(idStr).match(/_(\d+)$/);
    return m ? Number(m[1]) : null;
};

const Calendar = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);

    // Состояния модальных окон
    const [showViewModal, setShowViewModal] = useState(false);   // просмотр
    const [showFormModal, setShowFormModal] = useState(false);   // создание/редактирование
    const [formMode, setFormMode] = useState('create');          // 'create' | 'edit'
    const [currentView, setCurrentView] = useState('dayGridMonth');
    const [attachmentRecordId, setAttachmentRecordId] = useState(null);

    // Функция для сохранения в localStorage:
    const handleViewChange = (viewName) => {
        setCurrentView(viewName);
        localStorage.setItem('calendar_view', viewName);
    };

    // В useEffect при загрузке:
    useEffect(() => {
        const savedView = localStorage.getItem('calendar_view');
        if (savedView && ['dayGridMonth', 'timeGridWeek', 'multiMonthYear'].includes(savedView)) {
            setCurrentView(savedView);
        }
    }, []);

    // Состояния формы
    const [formData, setFormData] = useState({
        table: EVENT_TYPES.APPOINTMENT,
        title: '',
        date: '',
        description: '',
        extra: {}
    });

    // Список прививок для выбора (загружается один раз)
    const [vaccines, setVaccines] = useState([]);

    useEffect(() => {
        fetchEvents();
        loadVaccines();
    }, []);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const data = await api.getCalendarEvents();
            if (data.success) {
                // ✅ Превращаем все события в all-day для корректного отображения в timeGrid
                const formattedEvents = data.events.map(event => ({
                    ...event,
                    allDay: true  // ← КЛЮЧЕВОЕ: событие на весь день
                }));
                setEvents(formattedEvents);
            }
            else throw new Error(data.message || 'Ошибка загрузки');
            setError(null);
        } catch (err) {
            console.error('Calendar error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadVaccines = async () => {
        try {
            const data = await api.getVaccines();
            if (data.success) setVaccines(data.vaccines);
        } catch (err) {
            console.error('Failed to load vaccines:', err);
        }
    };

    // === Обработчики формы ===

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleExtraChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            extra: { ...prev.extra, [field]: value }
        }));
    };

    const resetForm = () => {
        setFormData({
            table: EVENT_TYPES.APPOINTMENT,
            title: '',
            date: '',
            description: '',
            extra: {}
        });
        setAttachmentRecordId(null);
    };

    const openCreateForm = (date = null) => {
        resetForm();
        if (date) setFormData(prev => ({ ...prev, date }));
        setFormMode('create');
        setShowFormModal(true);
    };

    const openEditForm = (event) => {
        if (event.extra?.is_panel_group) {
            alert('Комплекс анализов редактируется в разделе «Анализы»');
            return;
        }
        setFormData({
            table: event.table,
            title: event.extra.diagnosis || event.extra.value || event.title.replace(/^[\🩺🧪💉\s⏰📋]+/, ''),
            date: event.start,
            description: event.description || '',
            extra: {
                unit: event.extra.unit,
                value: event.extra.value?.split(' ')[0],
                vaccine_id: event.table === EVENT_TYPES.VACCINATION ? event.recordId : undefined,
                custom_name: event.extra.category === 'custom' ? event.title : undefined
            }
        });
        setSelectedEvent(event);
        setAttachmentRecordId(event.recordId || null);
        setFormMode('edit');
        setShowFormModal(true);
        setShowViewModal(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (formMode === 'create') {
                const res = await api.addCalendarEvent(formData);
                const rid = parseRecordId(res.id);
                if (rid) {
                    setAttachmentRecordId(rid);
                    setFormMode('edit');
                    return;
                }
            } else {
                await api.updateCalendarEvent(
                    formData.table,
                    selectedEvent.recordId,
                    {
                        [formData.table === EVENT_TYPES.APPOINTMENT ? 'type' :
                            formData.table === EVENT_TYPES.ANALYSIS ? 'type' : 'custom_name']: formData.title,
                        [formData.table === EVENT_TYPES.APPOINTMENT ? 'appointment_date' :
                            formData.table === EVENT_TYPES.ANALYSIS ? 'analysis_date' : 'date_given']: formData.date,
                        description: formData.description,
                        ...(formData.table === EVENT_TYPES.ANALYSIS && {
                            unit: formData.extra.unit,
                            value: formData.extra.value
                        })
                    }
                );
            }

            await fetchEvents();
            setShowFormModal(false);
            resetForm();
        } catch (err) {
            alert(`Ошибка: ${err.message}`);
        }
    };

    // === Обработчики календаря ===

    const handleDeleteEvent = async () => {
        if (!selectedEvent) return;
        const isPanel = selectedEvent.extra?.is_panel_group;
        const msg = isPanel
            ? 'Удалить весь комплекс анализов?'
            : 'Удалить это событие?';
        if (!window.confirm(msg)) return;

        try {
            if (isPanel) {
                await api.deleteCalendarEvent('analysis_panel', null, {
                    batchId: selectedEvent.extra.batch_id,
                });
            } else {
                await api.deleteCalendarEvent(selectedEvent.table, selectedEvent.recordId);
            }
            await fetchEvents();
            setSelectedEvent(null);
            setShowViewModal(false);
        } catch (err) {
            alert(`Ошибка при удалении: ${err.message}`);
        }
    };

    const handleEventClick = (clickInfo) => {
        const props = clickInfo.event.extendedProps;
        setSelectedEvent({
            id: clickInfo.event.id,
            title: clickInfo.event.title,
            start: clickInfo.event.startStr,
            type: props.type,
            description: props.description,
            table: props.table,
            recordId: props.record_id,
            extra: props
        });
        setShowViewModal(true);
    };

    const attachmentRecordType = (table) => {
        if (table === 'analysis_panel') return 'analyses';
        return table;
    };

    const handleDateSelect = (selectInfo) => {
        openCreateForm(selectInfo.startStr);
    };

    const renderEventContent = (eventInfo) => (
        <div className="fc-event-content">
            <span className="event-title">{eventInfo.event.title}</span>
        </div>
    );

    // === Рендер ===

    if (loading) return <div className="calendar-loading">📅 Загрузка...</div>;
    if (error) {
        return (
            <div className="calendar-error">
                <p>❌ {error}</p>
                <button onClick={fetchEvents}>Обновить</button>
            </div>
        );
    }

    return (
        <div className="calendar-wrapper">
            <div className="calendar-header">
                <h2>📅 Календарь здоровья</h2>
                <div className="calendar-legend">
                    <span className="legend-item"><span className="dot appointment"></span>Приёмы</span>
                    <span className="legend-item"><span className="dot analysis"></span>Анализы</span>
                    <span className="legend-item"><span className="dot vaccine"></span>Прививки</span>
                </div>
            </div>

            <div className="calendar-fc-wrap">
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
                locale={ruLocale}
                events={events}
                eventContent={renderEventContent}
                eventClick={handleEventClick}
                selectable
                select={handleDateSelect}
                selectLongPressDelay={100}
                eventLongPressDelay={100}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,dayGridWeek,multiMonthYear'
                }}
                views={{
                    dayGridMonth: { dayMaxEvents: 3 },
                    dayGridWeek: { type: 'dayGrid', duration: { weeks: 1 }, dayMaxEvents: 5 },
                    multiMonthYear: {
                        type: 'multiMonth',
                        duration: { months: 12 },
                        multiMonthMaxColumns: 3,
                    },
                }}
                buttonText={{ today: 'Сегодня' }}
                firstDay={1}
                height="auto"
                aspectRatio={window.innerWidth < 480 ? 0.9 : 1.35}
                eventDisplay="block"
                handleWindowResize
                initialView={currentView}
                datesSet={(dateInfo) => {
                    const viewName = dateInfo.view.type;
                    if (viewName !== currentView) handleViewChange(viewName);
                }}
                eventDidMount={(info) => {
                    if (info.event.extendedProps.description) {
                        info.el.title = info.event.extendedProps.description;
                    }
                }}
                dateClick={(info) => {
                    if (window.innerWidth <= 768) openCreateForm(info.dateStr);
                }}
            />
            </div>

            {/* 🔍 Модальное окно ПРОСМОТРА */}
            {showViewModal && selectedEvent && (
                <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowViewModal(false)}>×</button>
                        <h3>{selectedEvent.title}</h3>
                        <div className="modal-body">
                            <p><strong>Тип:</strong> {selectedEvent.type}</p>
                            <p><strong>Дата:</strong> {new Date(selectedEvent.start).toLocaleDateString('ru-RU')}</p>
                            {selectedEvent.extra.is_panel_group && selectedEvent.extra.items?.length > 0 && (
                                <ul className="panel-items-list">
                                    {selectedEvent.extra.items.map((it) => (
                                        <li key={it.id}>
                                            <strong>{it.type}:</strong> {it.value} {it.unit}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {selectedEvent.extra.value && !selectedEvent.extra.is_panel_group && (
                                <p><strong>Значение:</strong> {selectedEvent.extra.value}</p>
                            )}
                            {selectedEvent.extra.diagnosis && (
                                <p><strong>Диагноз:</strong> {selectedEvent.extra.diagnosis}</p>
                            )}
                            {selectedEvent.description && (
                                <p><strong>Заметки:</strong> {selectedEvent.description}</p>
                            )}
                            {selectedEvent.extra.is_panel_group ? (
                                selectedEvent.extra.items?.map((it) => (
                                    <div key={it.id} className="modal-attachments-block">
                                        <p className="attachments-label">{it.type}</p>
                                        <Attachments recordType="analyses" recordId={it.id} compact />
                                    </div>
                                ))
                            ) : (
                                <Attachments
                                    recordType={attachmentRecordType(selectedEvent.table)}
                                    recordId={selectedEvent.recordId}
                                    compact
                                />
                            )}
                        </div>
                        <div className="modal-actions">
                            {!selectedEvent.extra.is_panel_group && (
                                <button type="button" className="btn-edit" onClick={() => openEditForm(selectedEvent)}>
                                    ✏️ Редактировать
                                </button>
                            )}
                            <button type="button" className="btn-delete" onClick={handleDeleteEvent}>
                                🗑️ Удалить
                            </button>
                            <button type="button" onClick={() => setShowViewModal(false)}>Закрыть</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✏️ Модальное окно ФОРМЫ (создание/редактирование) */}
            {showFormModal && (
                <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
                    <div className="modal-content modal-form" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowFormModal(false)}>×</button>
                        <h3>{formMode === 'create' ? '➕ Новое событие' : '✏️ Редактирование'}</h3>

                        <form onSubmit={handleSubmit} className="event-form">
                            {/* Выбор типа события (только при создании) */}
                            {formMode === 'create' && (
                                <div className="form-group">
                                    <label>Тип события *</label>
                                    <select
                                        value={formData.table}
                                        onChange={(e) => handleFormChange('table', e.target.value)}
                                        required
                                    >
                                        {Object.entries(EVENT_TYPES).map(([key, value]) => (
                                            <option key={key} value={value}>{TYPE_LABELS[value]}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Название */}
                            <div className="form-group">
                                <label>
                                    {formData.table === EVENT_TYPES.APPOINTMENT && 'Специальность врача *'}
                                    {formData.table === EVENT_TYPES.ANALYSIS && 'Тип анализа *'}
                                    {formData.table === EVENT_TYPES.VACCINATION && 'Название прививки *'}
                                </label>
                                {formData.table === EVENT_TYPES.VACCINATION && formMode === 'create' ? (
                                    <>
                                        <select
                                            value={formData.extra.vaccine_id || 'custom'}
                                            onChange={(e) => {
                                                if (e.target.value === 'custom') {
                                                    handleExtraChange('vaccine_id', null);
                                                    handleExtraChange('custom_name', '');
                                                } else {
                                                    handleExtraChange('vaccine_id', e.target.value);
                                                }
                                            }}
                                        >
                                            <option value="custom">➕ Добавить свою</option>
                                            {vaccines.map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                        {(!formData.extra.vaccine_id) && (
                                            <input
                                                type="text"
                                                placeholder="Название прививки"
                                                value={formData.extra.custom_name || ''}
                                                onChange={(e) => handleExtraChange('custom_name', e.target.value)}
                                                required
                                            />
                                        )}
                                    </>
                                ) : (
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => handleFormChange('title', e.target.value)}
                                        placeholder={
                                            formData.table === EVENT_TYPES.APPOINTMENT ? 'Терапевт, Кардиолог...' :
                                                formData.table === EVENT_TYPES.ANALYSIS ? 'Общий анализ крови, Холестерин...' :
                                                    'Название'
                                        }
                                        required
                                    />
                                )}
                            </div>

                            {/* Дата */}
                            <div className="form-group">
                                <label>Дата *</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => handleFormChange('date', e.target.value)}
                                    required
                                />
                            </div>

                            {/* Поля для Анализов */}
                            {formData.table === EVENT_TYPES.ANALYSIS && (
                                <>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Значение *</label>
                                            <input
                                                type="text"
                                                value={formData.extra.value || ''}
                                                onChange={(e) => handleExtraChange('value', e.target.value)}
                                                placeholder="Например: 5.2"
                                                required={formMode === 'create'}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Единица *</label>
                                            <input
                                                type="text"
                                                value={formData.extra.unit || ''}
                                                onChange={(e) => handleExtraChange('unit', e.target.value)}
                                                placeholder="ммоль/л, мг/дл..."
                                                required={formMode === 'create'}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Описание / Заметки */}
                            <div className="form-group">
                                <label>Заметки</label>
                                <textarea
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => handleFormChange('description', e.target.value)}
                                    placeholder={
                                        formData.table === EVENT_TYPES.APPOINTMENT ? 'Диагноз, рекомендации...' :
                                            formData.table === EVENT_TYPES.ANALYSIS ? 'Комментарий к результату...' :
                                                'Место, реакция, серия...'
                                    }
                                />
                            </div>

                            {(formMode === 'edit' || attachmentRecordId) && formData.table !== EVENT_TYPES.VACCINATION && (
                                <Attachments
                                    recordType={formData.table}
                                    recordId={attachmentRecordId || selectedEvent?.recordId}
                                    compact
                                />
                            )}

                            <div className="modal-actions">
                                <button type="submit" className="btn-primary">
                                    {formMode === 'create' ? '💾 Создать' : '💾 Сохранить'}
                                </button>
                                {attachmentRecordId && formMode === 'edit' && (
                                    <button type="button" onClick={() => { setShowFormModal(false); resetForm(); fetchEvents(); }}>
                                        Готово
                                    </button>
                                )}
                                <button type="button" onClick={() => { setShowFormModal(false); resetForm(); }}>
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendar;