'use client';

import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { DEFAULT_LOCALE, LOCALE_DISPLAY_ORDER, LOCALE_ENDONYMS } from '@/app/lib/locale';
import { saveWorkspaceLocale } from '@/app/lib/workspace-locale-api';
import type { AppLanguage } from '../helpers/navigation-config';

interface Language {
  code: AppLanguage;
  label: string;
  note?: string;
}

interface UseLanguageSelectionParams {
  locale: string;
  availableLocales: unknown[];
  setLocale: (code: AppLanguage) => void;
  languageModal: { defaultLanguageNote: { value: string }; savedToastPrefix: { value: string } };
  setMobileMenuOpen: (open: boolean) => void;
}

export function useLanguageSelection({
  locale,
  availableLocales,
  setLocale,
  languageModal,
  setMobileMenuOpen,
}: UseLanguageSelectionParams) {
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const workspace = useWorkspace().currentWorkspace;
  // The choice is this workspace's; a past version has none of its own.
  const workspaceId = workspace && workspace.kind !== 'version' ? workspace.id : null;

  const languages = useMemo((): Language[] => {
    const available = availableLocales.map(String);
    return LOCALE_DISPLAY_ORDER.filter(code => available.includes(code)).map(code => ({
      code,
      label: LOCALE_ENDONYMS[code],
      ...(code === DEFAULT_LOCALE ? { note: languageModal.defaultLanguageNote.value } : {}),
    }));
  }, [availableLocales, languageModal.defaultLanguageNote]);

  const normalizedLocale = (locale as AppLanguage) || 'ru';

  const languageLabel = useMemo(() => {
    return (
      languages.find(l => l.code === normalizedLocale)?.label ??
      LOCALE_ENDONYMS[DEFAULT_LOCALE] ??
      DEFAULT_LOCALE
    );
  }, [languages, normalizedLocale]);

  const filteredLanguages = useMemo(() => {
    const query = languageSearch.trim().toLowerCase();
    if (!query) return languages;
    return languages.filter(lang => lang.label.toLowerCase().includes(query));
  }, [languageSearch, languages]);

  const handleLanguageSelect = useCallback(
    (code: AppLanguage) => {
      setLanguageModalOpen(false);
      setLanguageSearch('');
      // Saved before switching: the next page load takes the workspace's stored language.
      const saved = workspaceId ? saveWorkspaceLocale(workspaceId, code) : Promise.resolve();
      saved.then(
        () => {
          setLocale(code);
          const selectedLabel =
            languages.find(l => l.code === code)?.label ??
            LOCALE_ENDONYMS[DEFAULT_LOCALE] ??
            DEFAULT_LOCALE;
          toast.success(`${languageModal.savedToastPrefix.value}: ${selectedLabel}`);
          setTimeout(() => {
            window.location.reload();
          }, 50);
        },
        (error: unknown) => {
          toast.error(getApiErrorMessage(error));
        },
      );
    },
    [languageModal.savedToastPrefix.value, languages, setLocale, workspaceId],
  );

  const openLanguageMenu = useCallback(() => {
    setLanguageSearch('');
    setLanguageModalOpen(true);
    setMobileMenuOpen(false);
  }, [setMobileMenuOpen]);

  const closeLanguageMenu = useCallback(() => {
    setLanguageModalOpen(false);
    setLanguageSearch('');
  }, []);

  return {
    languageModalOpen,
    languageSearch,
    setLanguageSearch,
    languages,
    languageLabel,
    normalizedLocale,
    filteredLanguages,
    handleLanguageSelect,
    openLanguageMenu,
    closeLanguageMenu,
  };
}
