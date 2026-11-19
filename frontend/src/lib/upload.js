import { API_URL } from '../app/api';

// XMLHttpRequest gives real upload progress events (fetch does not).
export function uploadVideo({ lessonId, file, token, onProgress }) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('lessonId', lessonId);
    form.append('video', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/videos/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let body; try { body = JSON.parse(xhr.responseText); } catch { body = {}; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body.data); else reject(new Error(body.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

export async function downloadCertificate(certId, token) {
  const res = await fetch(`${API_URL}/api/certificates/${certId}/download`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Could not download certificate');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a'); a.href = url; a.download = `${certId}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
