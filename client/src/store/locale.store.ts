import { create } from 'zustand';
import i18n from '../i18n';

interface LocaleStore {
  locale: string;
  setLocale: (locale: string) => void;
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: i18n.language || 'en',
  setLocale: (locale) => {
    i18n.changeLanguage(locale);
    set({ locale });
  },
}));
