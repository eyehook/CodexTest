const STORAGE_KEY = 'codextest.weather.settings.v1';
export class SettingsStore {
  constructor(getStorage = () => globalThis.localStorage) { this.getStorage = getStorage; }
  load() {
    try {
      const text = this.getStorage()?.getItem(STORAGE_KEY);
      if (!text) return null;
      const data = JSON.parse(text);
      if (data?.version !== 1 || typeof data.activeMode !== 'string' || !data.modes || typeof data.modes !== 'object' || Array.isArray(data.modes)) return null;
      return data;
    } catch { return null; }
  }
  save(snapshot) {
    try {
      const storage = this.getStorage(); if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); return true;
    } catch { return false; }
  }
}
