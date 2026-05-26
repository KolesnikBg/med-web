import React, { useEffect, useState } from 'react';
import api from '../services/api';

const MAX_SIZE = 10 * 1024 * 1024;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic)$/i;

const Attachments = ({
  recordType,
  recordId,
  draftKey,
  batchId,
  disabled = false,
  compact = false,
}) => {
  const [items, setItems] = useState([]);
  const [previews, setPreviews] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canAttach = Boolean(recordId || draftKey || batchId);

  const load = async () => {
    if (!canAttach) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getAttachments({
        recordType,
        recordId,
        draftKey,
        batchId,
      });
      setItems(data.attachments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [recordType, recordId, draftKey, batchId]);

  useEffect(() => {
    if (!canAttach || !items.length) return;
    let cancelled = false;
    const loadPreviews = async () => {
      const next = {};
      for (const att of items) {
        if (!IMAGE_EXT.test(att.original_filename || '')) continue;
        try {
          const blob = await api.fetchAttachmentBlob(att.id);
          if (!cancelled) next[att.id] = URL.createObjectURL(blob);
        } catch {
          /* skip */
        }
      }
      if (!cancelled) setPreviews(next);
    };
    loadPreviews();
    return () => { cancelled = true; };
  }, [items, canAttach]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_SIZE) {
      setError('Файл не должен превышать 10 МБ');
      return;
    }
    setError('');
    try {
      await api.uploadAttachment({
        recordType,
        recordId,
        draftKey,
        batchId,
        file,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить файл?')) return;
    try {
      await api.deleteAttachment(id);
      if (previews[id]) URL.revokeObjectURL(previews[id]);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!canAttach) {
    return null;
  }

  return (
    <div className={`attachments-block ${compact ? 'attachments-block--compact' : ''}`}>
      <div className="attachments-head">
        <h4>Фото и файлы</h4>
        {!disabled && (
          <label className="btn btn-upload">
            Добавить фото / файл
            <input
              type="file"
              hidden
              accept="image/*,.pdf,.doc,.docx,.txt"
              capture="environment"
              onChange={handleUpload}
            />
          </label>
        )}
      </div>
      {error && <div className="error-message attachments-error">{error}</div>}
      {loading && <p className="empty-text">Загрузка вложений...</p>}

      {items.length > 0 && (
        <div className="attachments-grid">
          {items.map((att) => (
            <div key={att.id} className="attachment-card">
              {previews[att.id] ? (
                <img src={previews[att.id]} alt="" className="attachment-thumb" />
              ) : (
                <div className="attachment-thumb attachment-thumb--file">📄</div>
              )}
              <div className="attachment-meta">
                <span className="attachment-name" title={att.original_filename}>
                  {att.original_filename}
                </span>
                <span className="attachment-size">{(att.size / 1024).toFixed(0)} КБ</span>
                <div className="attachment-actions">
                  <button
                    type="button"
                    className="btn-download"
                    onClick={() => api.downloadAttachment(att.id, att.original_filename)}
                  >
                    Скачать
                  </button>
                  {!disabled && (
                    <button type="button" className="btn-delete-little" onClick={() => handleDelete(att.id)}>
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!items.length && !loading && (
        <p className="empty-text">Нет вложений. Можно прикрепить файлы до 10МБ.</p>
      )}
    </div>
  );
};

export default Attachments;
