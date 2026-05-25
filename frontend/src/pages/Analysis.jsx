import React, { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import api from '../services/api';
import Attachments from '../components/Attachments';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const parseNumeric = (val) => {
  const m = String(val).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

const emptyFilters = { type: '', search: '', date_from: '', date_to: '' };

const Analysis = () => {
  const [mode, setMode] = useState('single');
  const [form, setForm] = useState({
    type: '',
    analysis_date: '',
    unit: '',
    value: '',
    notes: '',
  });
  const [panelId, setPanelId] = useState('');
  const [panelDate, setPanelDate] = useState('');
  const [panelRows, setPanelRows] = useState([]);
  const [catalog, setCatalog] = useState([]); // Массив справочника анализа
  const [panels, setPanels] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [chartType, setChartType] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [activeRecordId, setActiveRecordId] = useState(null);
  const [modalItem, setModalItem] = useState(null);
  const [newCatalog, setNewCatalog] = useState({ name: '', default_unit: '' });
  const [newPanel, setNewPanel] = useState({ name: '', selectedIds: [] });
  const [singleDraftKey, setSingleDraftKey] = useState(() => api.createDraftKey());
  const [panelDraftKey, setPanelDraftKey] = useState(() => api.createDraftKey());

  const loadMeta = async () => {
    const [cat, pan, typesRes] = await Promise.all([
      api.getAnalysisCatalog(),
      api.getAnalysisPanels(),
      api.getAnalysisTypes(),
    ]);
    setCatalog(cat.catalog || []);
    setPanels(pan.panels || []);
    const types = typesRes.types || [];
    if (!chartType && types.length) setChartType(types[0]);
  };

  const loadList = async () => {
    setListLoading(true);
    setError('');
    try {
      const data = await api.getAnalyses(filters);
      setAnalyses(data.analyses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setListLoading(false);
    }
  };

  const loadChart = async () => {
    if (!chartType) {
      setChartData([]);
      return;
    }
    const data = await api.getAnalyses({ type: chartType });
    setChartData(data.analyses || []);
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadList();
  }, [filters]);

  useEffect(() => {
    loadChart();
  }, [chartType]);

  const onCatalogPick = (name) => {
    const item = catalog.find((c) => c.name === name);
    setForm((f) => ({
      ...f,
      type: name,
      unit: item?.default_unit || f.unit,
    }));
  };

  const onPanelSelect = async (id) => {
    setPanelId(id);
    if (!id) {
      setPanelRows([]);
      return;
    }
    try {
      const data = await api.getAnalysisPanel(id);
      setPanelRows(
        (data.panel?.items || []).map((it) => ({
          type: it.item_name,
          unit: it.default_unit || it.catalog_unit || '',
          value: '',
          notes: '',
        }))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let id = editingId;
      if (editingId) {
        await api.updateAnalysis(editingId, form);
      } else {
        const res = await api.createAnalysis({ ...form, draft_key: singleDraftKey });
        id = res.analysis?.id;
        setSingleDraftKey(api.createDraftKey());
      }
      setActiveRecordId(id);
      setEditingId(id);
      setForm({ type: '', analysis_date: '', unit: '', value: '', notes: '' });
      await loadList();
      await loadMeta();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePanelSubmit = async (e) => {
    e.preventDefault();
    if (!panelDate) {
      setError('Укажите дату сдачи комплекса');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const results = panelRows.filter((r) => r.value !== '' && r.value != null);
      if (!results.length) {
        setError('Заполните хотя бы одно значение');
        setLoading(false);
        return;
      }
      await api.createAnalysesBatch({
        analysis_date: panelDate,
        panel_id: panelId ? Number(panelId) : undefined,
        results,
        draft_key: panelDraftKey,
      });
      setPanelRows([]);
      setPanelId('');
      setPanelDraftKey(api.createDraftKey());
      await loadList();
      await loadMeta();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const chartConfig = useMemo(() => {
    const points = chartData
      .map((a) => ({ date: a.analysis_date, num: parseNumeric(a.value) }))
      .filter((p) => p.num !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      hasNumeric: points.length > 0,
      data: {
        labels: points.map((p) => new Date(p.date).toLocaleDateString('ru-RU')),
        datasets: [{
          label: chartType,
          data: points.map((p) => p.num),
          borderColor: '#2563eb',
          tension: 0.25,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { title: { display: true, text: chartType } },
      },
    };
  }, [chartData, chartType]);

  const typeOptions = [...new Set([
    ...catalog.map((c) => c.name),
    ...analyses.map((a) => a.type),
  ])].sort();

  return (
    <div className="page">
      <header className="page-header">
        <h1>Анализы</h1>
        <p className="page-lead">Справочник от администратора, свои панели и вложения к каждой записи.</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="tabs">
        <button type="button" className={mode === 'single' ? 'tab active' : 'tab'} onClick={() => setMode('single')}>
          Один показатель
        </button>
        <button type="button" className={mode === 'panel' ? 'tab active' : 'tab'} onClick={() => setMode('panel')}>
          Комплекс / панель
        </button>

      </div>

      <section className="card">
        {mode === 'single' ? (
          <form onSubmit={handleSingleSubmit}>
            <h2>{editingId ? 'Редактирование' : 'Новый анализ'}</h2>
            <div className="form-grid">
              <label>
                Из справочника
                {/* Выбираем анализ из справочника */}
                <select
                  // Выбираем анализ из справочника
                  value={form.type}
                  // Обработка выбора анализа из справочника
                  onChange={(e) => onCatalogPick(e.target.value)} // Вызываем функцию onCatalogPick с выбранным анализом
                >
                  <option value="">— выберите —</option>
                  {/* Отображаем анализы из справочника */}
                  {catalog.map((c) => (
                    // Отображаем анализ из справочника
                    <option key={c.id} value={c.name}>{c.name + ' (' + c.default_unit + ')'}{c.is_global ? '' : ' (свой)'}</option>
                  ))}
                </select>
              </label>
              <label>
                Или название
                <input
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  required
                />
              </label>
              <label>
                Дата
                <input type="date" value={form.analysis_date} onChange={(e) => setForm({ ...form, analysis_date: e.target.value })} required />
              </label>
              <label>
                Значение
                <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
              </label>
              <label>
                Единица
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : 'Сохранить'}
            </button>
            {editingId && (
              <button type="button" className="btn-link" onClick={() => { setEditingId(null); setActiveRecordId(null); }}>
                Отмена
              </button>
            )}
            <Attachments
              recordType="analyses"
              recordId={activeRecordId || editingId}
              draftKey={mode === 'single' ? singleDraftKey : panelDraftKey}
            />
          </form>
        ) : (
          <form onSubmit={handlePanelSubmit}>
            <h2>Комплекс анализов</h2>
            <div className="form-grid">
              <label>
                Панель
                <select value={panelId} onChange={(e) => onPanelSelect(e.target.value)} required>
                  <option value="">— выберите панель —</option>
                  {panels.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.is_global ? '' : ' (своя)'}</option>
                  ))}
                </select>
              </label>
              <label>
                Дата сдачи
                <input type="date" value={panelDate} onChange={(e) => setPanelDate(e.target.value)} required />
              </label>
            </div>
            {panelRows.length > 0 && (
              <div className="panel-grid">
                {panelRows.map((row, idx) => (
                  <div key={row.type} className="panel-row">
                    <strong>{row.type}</strong>
                    <input
                      placeholder="Значение"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...panelRows];
                        next[idx] = { ...row, value: e.target.value };
                        setPanelRows(next);
                      }}
                    />
                    <span className="unit-tag">{row.unit}</span>
                  </div>
                ))}
              </div>
            )}
            <Attachments recordType="analyses" draftKey={panelDraftKey} />
            <button type="submit" className="btn btn-primary" disabled={loading || !panelRows.length}>
              Сохранить комплекс
            </button>
          </form>
        )}
      </section>

      <section className="card">
        <h2>График</h2>
        <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="filter-select">
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="chart-wrap">
          {chartConfig.hasNumeric ? (
            <Line data={chartConfig.data} options={chartConfig.options} />
          ) : (
            <p className="empty-text">Выберите показатель с числовыми значениями.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Свой справочник и панель</h2>
        <p className="page-lead">Добавьте показатель или соберите комплекс (как «общий анализ крови»).</p>
        <div className="form-inline">
          <input
            placeholder="Новый показатель"
            value={newCatalog.name}
            onChange={(e) => setNewCatalog({ ...newCatalog, name: e.target.value })}
          />
          <input
            placeholder="Ед. изм."
            value={newCatalog.default_unit}
            onChange={(e) => setNewCatalog({ ...newCatalog, default_unit: e.target.value })}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await api.createAnalysisCatalogItem(newCatalog);
              setNewCatalog({ name: '', default_unit: '' });
              loadMeta();
            }}
          >
            В справочник
          </button>
        </div>
        <input
          placeholder="Название своей панели"
          value={newPanel.name}
          onChange={(e) => setNewPanel({ ...newPanel, name: e.target.value })}
          style={{ width: '100%', marginBottom: 8, padding: 10 }}
        />
        <div className="checkbox-grid">
          {catalog.map((c) => (
            <label key={c.id} className="checkbox-row">
              <input
                type="checkbox"
                // Проверяем, выбран ли анализ в панели
                checked={newPanel.selectedIds.includes(c.id)}
                onChange={(e) => {
                  const ids = e.target.checked
                    // Если анализ выбран, то добавляем его id в массив selectedIds
                    ? [...newPanel.selectedIds, c.id]
                    : newPanel.selectedIds.filter((id) => id !== c.id);
                  setNewPanel({ ...newPanel, selectedIds: ids });
                }}
              />
              {c.name + ' (' + c.default_unit + ')'}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            const items = newPanel.selectedIds.map((id) => {
              const c = catalog.find((x) => x.id === id);
              return { catalog_id: id, item_name: c?.name, default_unit: c?.default_unit };
            });
            await api.createAnalysisPanel({ name: newPanel.name, items });
            setNewPanel({ name: '', selectedIds: [] });
            loadMeta();
          }}
        >
          Создать панель
        </button>
      </section>

      <section className="card">
        <h2>Записи</h2>
        <div className="filters">
          <div className="form-grid">
            <label>Поиск по названию<input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label>

            <label>Поиск по типу<select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
              <option value="">Все типы</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select></label>

            <label>Дата с<input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /></label>
            <label>Дата по<input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /></label>

          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setFilters(emptyFilters)}>
            Сброс
          </button>
        </div>
        {listLoading ? (
          <p className="loading">Загрузка...</p>
        ) : analyses.length ? (
          <div className="record-list">
            {analyses.map((item) => (
              <article key={item.id} className="record-card" onClick={() => setModalItem(item)}>
                <h3>{item.type}</h3>
                <p>{new Date(item.analysis_date).toLocaleDateString('ru-RU')} — {item.value} {item.unit}</p>
                <div className="record-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setEditingId(item.id);
                    setActiveRecordId(item.id);
                    setForm({
                      type: item.type,
                      analysis_date: item.analysis_date,
                      unit: item.unit,
                      value: item.value,
                      notes: item.notes || '',
                    });
                    setMode('single');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>
                    Изменить
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-text">Нет записей по фильтру.</p>
        )}
      </section>

      {modalItem && (
        <div className="modal-backdrop" onClick={() => setModalItem(null)}>
          <div className="modal-card modal-card--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modalItem.type}</div>
              <button type="button" className="modal-close" onClick={() => setModalItem(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>{modalItem.value} {modalItem.unit} · {new Date(modalItem.analysis_date).toLocaleDateString('ru-RU')}</p>
              <Attachments recordType="analyses" recordId={modalItem.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;
