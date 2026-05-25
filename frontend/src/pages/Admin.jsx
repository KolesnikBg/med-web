import React, { useEffect, useState } from 'react';
import api from '../services/api';

const TABS = [
  { id: 'stats', label: 'Статистика' },
  { id: 'doctors', label: 'Врачи' },
  { id: 'catalog', label: 'Анализы' },
  { id: 'panels', label: 'Панели' },
  { id: 'vaccines', label: 'Прививки' },
  { id: 'schedules', label: 'Периодизация' },
];

const Admin = () => {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [panels, setPanels] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [doctorForm, setDoctorForm] = useState({ name: '' });
  const [catalogForm, setCatalogForm] = useState({ name: '', default_unit: '' });
  const [panelForm, setPanelForm] = useState({ name: '', description: '', catalog_ids: [] });
  const [editingPanelId, setEditingPanelId] = useState(null);
  const [editPanelForm, setEditPanelForm] = useState({ name: '', catalog_ids: [] });
  const [vacForm, setVacForm] = useState({ name: '', description: '', category: 'standard' });
  const [schedForm, setSchedForm] = useState({
    vaccine_id: '',
    schedule_type: 'interval',
    interval_years: 1,
    age_years: '',
    description: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, vacRes, docRes, catRes, panRes, schRes] = await Promise.all([
        api.getAdminStats(),
        api.getVaccines(true),
        api.adminGetDoctors(),
        api.getAnalysisCatalog(),
        api.getAnalysisPanels(),
        api.getVaccineSchedules(),
      ]);
      setStats(statsRes.stats);
      setUsers(statsRes.recent_users || []);
      setVaccines(vacRes.vaccines || []);
      setDoctors(docRes.doctors || []);
      setCatalog((catRes.catalog || []).filter((c) => c.is_global));
      setPanels((panRes.panels || []).filter((p) => p.is_global));
      setSchedules(schRes.schedules || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Админ-панель</h1>
      </header>
      {error && <div className="error-message">{error}</div>}

      <nav className="tabs tabs--wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'stats' && stats && (
        <section className="card">
          <div className="stats-grid">
            <div className="stat-card"><strong>{stats.users}</strong><span>Пользователей</span></div>
            <div className="stat-card"><strong>{stats.appointments}</strong><span>Приёмов</span></div>
            <div className="stat-card"><strong>{stats.analyses}</strong><span>Анализов</span></div>
            <div className="stat-card"><strong>{stats.vaccinations}</strong><span>Прививок</span></div>
          </div>
          <h3>Пользователи</h3>
          <table className="data-table">
            <thead><tr><th>Имя</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name || '—'}</td>
                  <td>{u.email}</td>
                  <td>
                    {!u.is_admin && (
                      <button type="button" className="btn-link" onClick={async () => {
                        await api.adminDeleteUser(u.id);
                        load();
                      }}>Удалить</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'doctors' && (
        <section className="card">
          <form className="form-inline" onSubmit={async (e) => {
            e.preventDefault();
            await api.adminCreateDoctor({ name: doctorForm.name });
            setDoctorForm({ name: '' });
            load();
          }}>
            <input placeholder="Врач / специальность" value={doctorForm.name} onChange={(e) => setDoctorForm({ name: e.target.value })} required />
            <button type="submit" className="btn btn-primary">Добавить</button>
          </form>
          <ul className="simple-list">
            {doctors.map((d) => (
              <li key={d.id}>
                {d.name}
                <button type="button" className="btn-link" onClick={async () => { await api.adminDeleteDoctor(d.id); load(); }}>Удалить</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'catalog' && (
        <section className="card">
          <form className="form-inline" onSubmit={async (e) => {
            e.preventDefault();
            await api.adminCreateCatalogItem(catalogForm);
            setCatalogForm({ name: '', default_unit: '' });
            load();
          }}>
            <input placeholder="Название анализа" value={catalogForm.name} onChange={(e) => setCatalogForm({ ...catalogForm, name: e.target.value })} required />
            <input placeholder="Ед. изм." value={catalogForm.default_unit} onChange={(e) => setCatalogForm({ ...catalogForm, default_unit: e.target.value })} />
            <button type="submit" className="btn btn-primary">В справочник</button>
          </form>
          <ul className="simple-list">
            {catalog.map((c) => (
              <li key={c.id}>{c.name} — {c.default_unit || '—'}
                <button type="button" className="btn-link" onClick={async () => { await api.adminDeleteCatalogItem(c.id); load(); }}>Скрыть</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'panels' && (
        <section className="card">
          <h3>Новая панель (комплекс)</h3>
          <input placeholder="Название панели" value={panelForm.name} onChange={(e) => setPanelForm({ ...panelForm, name: e.target.value })} />
          <p className="page-lead">Отметьте анализы, входящие в комплекс:</p>
          <div className="checkbox-grid">
            {catalog.map((c) => (
              <label key={c.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={panelForm.catalog_ids.includes(c.id)}
                  onChange={(e) => {
                    const ids = e.target.checked
                      ? [...panelForm.catalog_ids, c.id]
                      : panelForm.catalog_ids.filter((id) => id !== c.id);
                    setPanelForm({ ...panelForm, catalog_ids: ids });
                  }}
                />
                {c.name}
              </label>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={async () => {
            const items = panelForm.catalog_ids.map((id) => {
              const c = catalog.find((x) => x.id === id);
              return { catalog_id: id, item_name: c?.name, default_unit: c?.default_unit };
            });
            await api.adminCreatePanel({ name: panelForm.name, items });
            setPanelForm({ name: '', description: '', catalog_ids: [] });
            load();
          }}>
            Создать панель
          </button>
          <ul className="simple-list">
            {panels.map((p) => (
              <li key={p.id}>
                {p.name}
                <span className="simple-list-actions">
                  <button
                    type="button"
                    className="btn-link"
                    onClick={async () => {
                      const res = await api.getAnalysisPanel(p.id);
                      const ids = (res.panel?.items || [])
                        .map((it) => it.catalog_id)
                        .filter(Boolean);
                      setEditingPanelId(p.id);
                      setEditPanelForm({ name: res.panel?.name || p.name, catalog_ids: ids });
                    }}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={async () => {
                      if (!window.confirm(`Удалить панель «${p.name}»?`)) return;
                      await api.adminDeletePanel(p.id);
                      if (editingPanelId === p.id) setEditingPanelId(null);
                      load();
                    }}
                  >
                    Удалить
                  </button>
                </span>
              </li>
            ))}
          </ul>

          {editingPanelId && (
            <div className="card card--nested">
              <h3>Редактирование панели</h3>
              <input
                placeholder="Название"
                value={editPanelForm.name}
                onChange={(e) => setEditPanelForm({ ...editPanelForm, name: e.target.value })}
              />
              <div className="checkbox-grid">
                {catalog.map((c) => (
                  <label key={c.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={editPanelForm.catalog_ids.includes(c.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...editPanelForm.catalog_ids, c.id]
                          : editPanelForm.catalog_ids.filter((id) => id !== c.id);
                        setEditPanelForm({ ...editPanelForm, catalog_ids: ids });
                      }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              <div className="form-inline">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const items = editPanelForm.catalog_ids.map((id) => {
                      const c = catalog.find((x) => x.id === id);
                      return { catalog_id: id, item_name: c?.name, default_unit: c?.default_unit };
                    });
                    await api.adminUpdatePanel(editingPanelId, {
                      name: editPanelForm.name,
                      items,
                    });
                    setEditingPanelId(null);
                    load();
                  }}
                >
                  Сохранить
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPanelId(null)}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'vaccines' && (
        <section className="card">
          <form className="form-inline" onSubmit={async (e) => {
            e.preventDefault();
            await api.adminCreateVaccine(vacForm);
            setVacForm({ name: '', description: '', category: 'standard' });
            load();
          }}>
            <input placeholder="Название" value={vacForm.name} onChange={(e) => setVacForm({ ...vacForm, name: e.target.value })} required />
            <select value={vacForm.category} onChange={(e) => setVacForm({ ...vacForm, category: e.target.value })}>
              <option value="standard">standard</option>
              <option value="travel">travel</option>
              <option value="work">work</option>
            </select>
            <button type="submit" className="btn btn-primary">Добавить</button>
          </form>
          <ul className="simple-list">
            {vaccines.map((v) => (
              <li key={v.id}>{v.name}
                <button type="button" className="btn-link" onClick={async () => { await api.adminDeleteVaccine(v.id); load(); }}>Удалить</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'schedules' && (
        <section className="card">
          <form className="form-grid" onSubmit={async (e) => {
            e.preventDefault();
            await api.adminCreateVaccineSchedule({
              vaccine_id: Number(schedForm.vaccine_id),
              schedule_type: schedForm.schedule_type,
              interval_years: schedForm.schedule_type === 'interval' ? Number(schedForm.interval_years) : null,
              age_years: schedForm.schedule_type === 'age' ? Number(schedForm.age_years) : null,
              description: schedForm.description,
            });
            load();
          }}>
            <label>
              Прививка
              <select value={schedForm.vaccine_id} onChange={(e) => setSchedForm({ ...schedForm, vaccine_id: e.target.value })} required>
                <option value="">—</option>
                {vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label>
              Тип
              <select value={schedForm.schedule_type} onChange={(e) => setSchedForm({ ...schedForm, schedule_type: e.target.value })}>
                <option value="interval">Раз в N лет после прошлой</option>
                <option value="age">По возрасту (с N лет)</option>
              </select>
            </label>
            {schedForm.schedule_type === 'interval' ? (
              <label>
                Интервал (лет)
                <input type="number" min={1} value={schedForm.interval_years} onChange={(e) => setSchedForm({ ...schedForm, interval_years: e.target.value })} />
              </label>
            ) : (
              <label>
                Возраст (лет)
                <input type="number" min={0} value={schedForm.age_years} onChange={(e) => setSchedForm({ ...schedForm, age_years: e.target.value })} />
              </label>
            )}
            <label className="span-2">
              Описание
              <input value={schedForm.description} onChange={(e) => setSchedForm({ ...schedForm, description: e.target.value })} />
            </label>
            <button type="submit" className="btn btn-primary">Добавить правило</button>
          </form>
          <table className="data-table">
            <thead>
              <tr><th>Прививка</th><th>Тип</th><th>Параметр</th><th></th></tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.vaccine_name}</td>
                  <td>{s.schedule_type === 'interval' ? 'Интервал' : 'Возраст'}</td>
                  <td>{s.schedule_type === 'interval' ? `${s.interval_years} лет` : `${s.age_years} лет`}</td>
                  <td>
                    <button type="button" className="btn-link" onClick={async () => {
                      await api.adminDeleteVaccineSchedule(s.id);
                      load();
                    }}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

export default Admin;
