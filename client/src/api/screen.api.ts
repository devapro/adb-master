import api from './axios-client';

export const captureScreenshot = (serial: string): Promise<string> =>
  api
    .get(`/devices/${serial}/screen/capture`, { responseType: 'blob' })
    .then((r) => URL.createObjectURL(r.data));

export const getFrame = (serial: string, quality = 70): Promise<ArrayBuffer> =>
  api
    .get(`/devices/${serial}/screen/frame`, {
      params: { quality },
      responseType: 'arraybuffer',
    })
    .then((r) => r.data);

export const startRecording = (serial: string): Promise<void> =>
  api.post(`/devices/${serial}/screen/record/start`).then(() => undefined);

export const stopRecording = (serial: string): Promise<void> =>
  api.post(`/devices/${serial}/screen/record/stop`).then(() => undefined);

export const getRecordingStatus = (serial: string): Promise<boolean> =>
  api
    .get<{ recording: boolean }>(`/devices/${serial}/screen/record/status`)
    .then((r) => r.data.recording);

export const downloadRecording = async (serial: string): Promise<void> => {
  const response = await api.get(`/devices/${serial}/screen/record/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording_${serial}_${Date.now()}.mp4`;
  a.click();
  URL.revokeObjectURL(url);
};
