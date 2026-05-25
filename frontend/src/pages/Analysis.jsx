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

const buildListItems = (analyses, panels) => {
  const batchMap = new Map();
  const singles = [];
  analyses.forEach((a) => {
    if (a.batch_id) {
      const key = `${a.analysis_date}_${a.batch_id}`;
      if (!batchMap.has(key)) {
        const panel = panels.find((p) => p.id === a.panel_id);
        batchMap.set(key, {
          id: `panel_${a.batch_id}`,
          is_panel_group: true,
          batch_id: a.batch_id,
          panel_id: a.panel_id,
          panel_name: panel?.name || 'Комплекс анализов',
          analysis_date: a.analysis_date,
          items: [],
        });
      }
      batchMap.get(key).items.push(a);
    } else {
      singles.push({ ...a, is_panel_group: false });
    }
  });
  const panelGroups = [...batchMap.values()];
  return { panelGroups, singles, all: [...panelGroups, ...singles] };
};

const Analysis = () => {
  const [mode, setMode] = useState('single');
  const [listFilter, setListFilter] = useState('all');
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
  const [catalog, setCatalog] = useState([]);
  const [panels, setPanels] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [chartType, setChartType] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState('view');
  const [editForm, setEditForm] = useState(null);
  const [editPanelRows, setEditPanelRows] = useState([]);
  const [newCatalog, setNewCatalog] = useState({ name: '', default_unit: '' });
  const [newPanel, setNewPanel] = useState({ name: '', selectedIds: [] });
  const [singleDraftKey, setSingleDraftKey] = useState(() => api.createDraftKey());
  const [panelDraftKey, setPanelDraftKey] = useState(() => api.createDraftKey());

  const { panelGroups, singles, all: allListItems } = useMemo(
    () => buildListItems(analyses, panels),
    [analyses, panels]
  );

  const listItems = useMemo(() => {
    if (listFilter === 'panels') return panelGroups;
    if (listFilter === 'singles') return singles;
    return allListItems.sort((a, b) =>
      (b.analysis_date || '').localeCompare(a.analysis_date || '')
    );
  }, [listFilter, panelGroups, singles, allListItems]);

  const catalogSelected = catalog.some((c) => c.name === form.type);

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

  const resetCreateForm = () => {
    setForm({ type: '', analysis_date: '', unit: '', value: '', notes: '' });
    setSingleDraftKey(api.createDraftKey());
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.createAnalysis({ ...form, draft_key: singleDraftKey });
      resetCreateForm();
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
      setPanelDate('');
      setPanelDraftKey(api.createDraftKey());
      await loadList();
      await loadMeta();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openViewModal = (item) => {
    setModalItem(item);
    setModalMode('view');
    setEditForm(null);
    setEditPanelRows([]);
  };

  const openEditModal = (item) => {
    setModalItem(item);
    setModalMode('edit');
    if (item.is_panel_group) {
      setEditForm({
        analysis_date: item.analysis_date,
        notes: '',
      });
      setEditPanelRows(
        item.items.map((a) => ({
          id: a.id,
          type: a.type,
          unit: a.unit,
          value: a.value,
          notes: a.notes || '',
        }))
      );
    } else {
      setEditForm({
        type: item.type,
        analysis_date: item.analysis_date,
        unit: item.unit,
        value: item.value,
        notes: item.notes || '',
      });
      setEditPanelRows([]);
    }
  };

  const saveModalEdit = async () => {
    setLoading(true);
    setError('');
    try {
      if (modalItem.is_panel_group) {
        await Promise.all(
          editPanelRows.map((row) =>
            api.updateAnalysis(row.id, {
              analysis_date: editForm.analysis_date,
              value: row.value,
              unit: row.unit,
              notes: row.notes || editForm.notes,
            })
          )
        );
      } else {
        await api.updateAnalysis(modalItem.id, editForm);
      }
      setModalMode('view');
      await loadList();
      setModalItem(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteModalItem = async () => {
    const msg = modalItem.is_panel_group
      ? 'Удалить весь комплекс анализов?'
      : 'Удалить запись?';
    if (!window.confirm(msg)) return;
    try {
      if (modalItem.is_panel_group) {
        await api.deleteAnalysesBatch(modalItem.batch_id);
      } else {
        await api.deleteAnalysis(modalItem.id);
      }
      setModalItem(null);
      await loadList();
    } catch (err) {
      setError(err.message);
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

  const editCatalogSelected = editForm && catalog.some((c) => c.name === editForm.type);

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
            <h2>Новый анализ</h2>
            <div className="form-grid">
              <label>
                Из справочника
                <select value={form.type} onChange={(e) => onCatalogPick(e.target.value)}>
                  <option value="">— выберите —</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.default_unit}){c.is_global ? '' : ' (свой)'}
                    </option>
                  ))}
                </select>
              </label>
              {!catalogSelected && (
                <label>
                  Или название
                  <input
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    required={!catalogSelected}
                  />
                </label>
              )}
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
            <Attachments recordType="analyses" draftKey={singleDraftKey} />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '...' : 'Добавить'}
            </button>
            
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
                checked={newPanel.selectedIds.includes(c.id)}
                onChange={(e) => {
                  const ids = e.target.checked
                    ? [...newPanel.selectedIds, c.id]
                    : newPanel.selectedIds.filter((id) => id !== c.id);
                  setNewPanel({ ...newPanel, selectedIds: ids });
                }}
              />
              {c.name} ({c.default_unit})
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
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button type="button" className={listFilter === 'all' ? 'tab active' : 'tab'} onClick={() => setListFilter('all')}>
            Все записи
          </button>
          <button type="button" className={listFilter === 'panels' ? 'tab active' : 'tab'} onClick={() => setListFilter('panels')}>
            Комплексы / панели
          </button>
          <button type="button" className={listFilter === 'singles' ? 'tab active' : 'tab'} onClick={() => setListFilter('singles')}>
            Один показатель
          </button>
        </div>
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
        ) : listItems.length ? (
          <div className="record-list">
            {listItems.map((item) => (
              <article
                key={item.is_panel_group ? item.id : item.id}
                className="record-card"
                onClick={() => openViewModal(item)}
              >
                {item.is_panel_group ? (
                  <>
                    <h3>{item.panel_name} ({item.items.length})</h3>
                    <p>{new Date(item.analysis_date).toLocaleDateString('ru-RU')}</p>
                  </>
                ) : (
                  <>
                    <h3>{item.type}</h3>
                    <p>{new Date(item.analysis_date).toLocaleDateString('ru-RU')} — {item.value} {item.unit}</p>
                  </>
                )}
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
              <div className="modal-title">
                {modalItem.is_panel_group ? modalItem.panel_name : modalItem.type}
              </div>
              <button type="button" className="modal-close" onClick={() => setModalItem(null)}>×</button>
            </div>
            <div className="modal-body">
              {modalMode === 'view' ? (
                <>
                  <p><strong>Дата:</strong> {new Date(modalItem.analysis_date).toLocaleDateString('ru-RU')}</p>
                  {modalItem.is_panel_group ? (
                    <ul className="panel-items-list">
                      {modalItem.items.map((it) => (
                        <li key={it.id}><strong>{it.type}:</strong> {it.value} {it.unit}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{modalItem.value} {modalItem.unit}</p>
                  )}
                  {modalItem.is_panel_group ? (
                    <Attachments batchId={modalItem.batch_id} />
                  ) : (
                    <Attachments recordType="analyses" recordId={modalItem.id} />
                  )}
                  <div className="modal-actions">
                    <button type="button" className="btn-edit" onClick={() => openEditModal(modalItem)}>Редактировать</button>
                    <button type="button" onClick={() => setModalItem(null)}>Закрыть</button>
                    <button type="button" className="btn-delete" onClick={deleteModalItem}>Удалить</button>
                  </div>
                </>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); saveModalEdit(); }}>
                  {modalItem.is_panel_group ? (
                    <>
                      <label>
                        Дата комплекса
                        <input
                          type="date"
                          value={editForm.analysis_date}
                          onChange={(e) => setEditForm({ ...editForm, analysis_date: e.target.value })}
                          required
                        />
                      </label>
                      <div className="panel-grid">
                        {editPanelRows.map((row, idx) => (
                          <div key={row.id} className="panel-row">
                            <strong>{row.type}</strong>
                            <input
                              value={row.value}
                              onChange={(e) => {
                                const next = [...editPanelRows];
                                next[idx] = { ...row, value: e.target.value };
                                setEditPanelRows(next);
                              }}
                              required
                            />
                            <span className="unit-tag">{row.unit}</span>
                          </div>
                        ))}
                      </div>
                      <Attachments batchId={modalItem.batch_id} />
                    </>
                  ) : (
                    <>
                      <div className="form-grid">
                        <label>
                          Из справочника
                          <select value={editForm.type} onChange={(e) => {
                            const item = catalog.find((c) => c.name === e.target.value);
                            setEditForm({
                              ...editForm,
                              type: e.target.value,
                              unit: item?.default_unit || editForm.unit,
                            });
                          }}>
                            <option value="">—</option>
                            {catalog.map((c) => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </label>
                        {!editCatalogSelected && (
                          <label>
                            Или название
                            <input
                              value={editForm.type}
                              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                              required
                            />
                          </label>
                        )}
                        <label>
                          Дата
                          <input type="date" value={editForm.analysis_date} onChange={(e) => setEditForm({ ...editForm, analysis_date: e.target.value })} required />
                        </label>
                        <label>
                          Значение
                          <input value={editForm.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} required />
                        </label>
                        <label>
                          Единица
                          <input value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} required />
                        </label>
                      </div>
                      <Attachments recordType="analyses" recordId={modalItem.id} />
                    </>
                  )}
                  <div className="modal-actions">
                    <button type="submit" className="btn-primary" disabled={loading}>Сохранить</button>
                    <button type="button" onClick={() => setModalMode('view')}>Отмена</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analysis;
