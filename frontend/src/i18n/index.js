import { useEffect, useState } from "react";

import en from "./en";
import te from "./te";
import hi from "./hi";

// ==========================================================
// LANGUAGE DICTIONARIES
// ==========================================================
//
// Add future languages here.
//
// Example:
// import ta from "./ta";
//
// export const translations = {
//   English: en,
//   Telugu: te,
//   Hindi: hi,
//   Tamil: ta,
// };
//
// The rest of this file will automatically support them
// once their language metadata is added below.
// ==========================================================

export const translations = {
  English: en,
  Telugu: te,
  Hindi: hi,
};

// ==========================================================
// LANGUAGE CONFIGURATION
// ==========================================================

export const LANGUAGE_OPTIONS = [
  {
    value: "English",
    code: "en",
    label: "English",
    nativeLabel: "English",
    flag: "🇬🇧",
  },
  {
    value: "Telugu",
    code: "te",
    label: "Telugu",
    nativeLabel: "తెలుగు",
    flag: "🇮🇳",
  },
  {
    value: "Hindi",
    code: "hi",
    label: "Hindi",
    nativeLabel: "हिन्दी",
    flag: "🇮🇳",
  },
];

// ==========================================================
// FONT CONFIGURATION
// ==========================================================
//
// Keep font handling centralized here instead of maintaining
// another font definition inside main.jsx.
// ==========================================================

export const FONT_OPTIONS = [
  {
    value: "Inter",
    label: "Inter",
    description: "Clean modern UI font",
    family: "Inter, system-ui, sans-serif",
  },
  {
    value: "Noto Sans",
    label: "Noto Sans",
    description: "Clear multilingual font",
    family: '"Noto Sans", system-ui, sans-serif',
  },
  {
    value: "Poppins",
    label: "Poppins",
    description: "Modern rounded font",
    family: "Poppins, system-ui, sans-serif",
  },
];

// ==========================================================
// LANGUAGE CODE MAPPING
// ==========================================================

const LANGUAGE_CODES = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
};

const LANGUAGE_NAMES = {
  English: "en",
  Telugu: "te",
  Hindi: "hi",
};

// ==========================================================
// NORMALIZE LANGUAGE
// ==========================================================

export function normalizeLanguage(language) {
  if (!language) {
    return "English";
  }

  if (translations[language]) {
    return language;
  }

  if (LANGUAGE_CODES[language]) {
    return LANGUAGE_CODES[language];
  }

  return "English";
}

// ==========================================================
// GET LANGUAGE CODE
// ==========================================================

export function getLanguageCode(language) {
  const normalizedLanguage = normalizeLanguage(language);

  return (
    LANGUAGE_NAMES[normalizedLanguage] || "en"
  );
}

// ==========================================================
// GET CURRENT LANGUAGE
// ==========================================================

export function getCurrentLanguage() {
  const storedLanguage =
    localStorage.getItem("ld_language");

  return normalizeLanguage(storedLanguage);
}

// ==========================================================
// GET CURRENT LANGUAGE CODE
// ==========================================================

export function getCurrentLanguageCode() {
  return getLanguageCode(
    getCurrentLanguage()
  );
}

// ==========================================================
// SET CURRENT LANGUAGE
// ==========================================================
//
// This is the SINGLE place responsible for changing the
// application language.
//
// It:
//   1. Normalizes the language
//   2. Stores the language code
//   3. Updates HTML language metadata
//   4. Notifies React/application immediately
//   5. Allows other tabs to synchronize through storage
// ==========================================================

export function setCurrentLanguage(language) {
  const normalizedLanguage =
    normalizeLanguage(language);

  const languageCode =
    getLanguageCode(normalizedLanguage);

  localStorage.setItem(
    "ld_language",
    languageCode
  );

  if (typeof document !== "undefined") {
    document.documentElement.lang =
      languageCode;

    document.documentElement.dataset.language =
      languageCode;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("languageChanged", {
        detail: {
          language: normalizedLanguage,
          code: languageCode,
        },
      })
    );
  }

  return normalizedLanguage;
}

// ==========================================================
// TRANSLATION VALUE RESOLVER
// ==========================================================
//
// Supports BOTH:
//
// Flat dictionaries:
//
// {
//   Dashboard: "డాష్‌బోర్డ్"
// }
//
// And future semantic/nested dictionaries:
//
// {
//   navigation: {
//     dashboard: "డాష్‌బోర్డ్"
//   }
// }
//
// This lets us gradually improve the translation architecture
// without breaking the existing application.
// ==========================================================

function getTranslationValue(
  dictionary,
  key
) {
  if (!dictionary || !key) {
    return undefined;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      dictionary,
      key
    )
  ) {
    return dictionary[key];
  }

  if (key.includes(".")) {
    const parts = key.split(".");

    let current = dictionary;

    for (const part of parts) {
      if (
        current &&
        typeof current === "object" &&
        Object.prototype.hasOwnProperty.call(
          current,
          part
        )
      ) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    if (
      typeof current === "string" ||
      typeof current === "number"
    ) {
      return current;
    }
  }

  return undefined;
}

// ==========================================================
// TRANSLATE
// ==========================================================
//
// Example:
//
// t("Dashboard")
//
// English:
// Dashboard
//
// Telugu:
// డాష్‌బోర్డ్
//
// Hindi:
// डैशबोर्ड
//
// If a translation is missing, English is used as fallback.
// If English is also missing, the original key is returned.
// ==========================================================

export function t(
  text,
  language = getCurrentLanguage()
) {
  if (
    text === null ||
    text === undefined ||
    text === ""
  ) {
    return text;
  }

  const normalizedLanguage =
    normalizeLanguage(language);

  const currentDictionary =
    translations[normalizedLanguage];

  const currentTranslation =
    getTranslationValue(
      currentDictionary,
      text
    );

  if (
    currentTranslation !== undefined &&
    currentTranslation !== null
  ) {
    return currentTranslation;
  }

  const englishTranslation =
    getTranslationValue(
      translations.English,
      text
    );

  if (
    englishTranslation !== undefined &&
    englishTranslation !== null
  ) {
    return englishTranslation;
  }

  return text;
}

// ==========================================================
// TRANSLATE BACKEND / DYNAMIC MESSAGE
// ==========================================================
//
// Backend messages can be translated when the exact message
// exists in the translation dictionaries.
//
// If no translation exists, the original backend message
// remains untouched.
// ==========================================================

export function translateMessage(message) {
  if (
    message === null ||
    message === undefined ||
    message === ""
  ) {
    return message;
  }

  return t(message);
}

// ==========================================================
// LEGACY TRANSLATION SUPPORT
// ==========================================================
//
// main.jsx currently uses English UI strings directly as
// translation keys.
//
// Example:
//
// t("Dashboard")
//
// or:
//
// translateLegacy("Dashboard")
//
// Both continue to work.
//
// This is intentionally kept so we can gradually migrate
// the application to semantic translation keys without
// breaking existing functionality.
// ==========================================================

export function translateLegacy(
  text,
  language = getCurrentLanguage()
) {
  if (
    text === null ||
    text === undefined ||
    text === ""
  ) {
    return text;
  }

  return t(text, language);
}

export function validateTranslations() {
  const englishKeys = Object.keys(translations.English);
  const result = {
    english: englishKeys.length,
    Telugu: englishKeys.filter((key) =>
      Object.prototype.hasOwnProperty.call(translations.Telugu, key)
    ).length,
    Hindi: englishKeys.filter((key) =>
      Object.prototype.hasOwnProperty.call(translations.Hindi, key)
    ).length,
    missing: {
      Telugu: englishKeys.filter((key) =>
        !Object.prototype.hasOwnProperty.call(translations.Telugu, key)
      ),
      Hindi: englishKeys.filter((key) =>
        !Object.prototype.hasOwnProperty.call(translations.Hindi, key)
      ),
    },
  };

  if (import.meta?.env?.DEV && (result.missing.Telugu.length || result.missing.Hindi.length)) {
    console.warn("Missing translations detected:", result.missing);
  }

  return result;
}

// ==========================================================
// GET CURRENT FONT
// ==========================================================

export function getCurrentFont() {
  return (
    localStorage.getItem("ld_font") ||
    "Inter"
  );
}

// ==========================================================
// SET CURRENT FONT
// ==========================================================
//
// Centralized font handling.
//
// This keeps font selection independent from the language
// translation system while allowing both to be controlled
// through the same Settings page.
// ==========================================================

export function setCurrentFont(font) {
  const selectedFont =
    FONT_OPTIONS.find(
      (option) => option.value === font
    );

  if (!selectedFont) {
    return getCurrentFont();
  }

  localStorage.setItem(
    "ld_font",
    selectedFont.value
  );

  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty(
      "--app-font-family",
      selectedFont.family
    );

    document.documentElement.dataset.font =
      selectedFont.value
        .toLowerCase()
        .replace(/\s+/g, "-");
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("fontChanged", {
        detail: {
          font: selectedFont.value,
          family: selectedFont.family,
        },
      })
    );
  }

  return selectedFont.value;
}

// ==========================================================
// APPLY CURRENT FONT
// ==========================================================

export function applyCurrentFont() {
  const currentFont = getCurrentFont();

  const selectedFont =
    FONT_OPTIONS.find(
      (option) =>
        option.value === currentFont
    );

  if (!selectedFont) {
    return;
  }

  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty(
      "--app-font-family",
      selectedFont.family
    );

    document.documentElement.dataset.font =
      selectedFont.value
        .toLowerCase()
        .replace(/\s+/g, "-");
  }
}

// ==========================================================
// APPLY CURRENT LANGUAGE METADATA
// ==========================================================

export function applyCurrentLanguage() {
  const currentLanguage =
    getCurrentLanguage();

  const languageCode =
    getLanguageCode(currentLanguage);

  if (typeof document !== "undefined") {
    document.documentElement.lang =
      languageCode;

    document.documentElement.dataset.language =
      languageCode;
  }
}

// ==========================================================
// CENTRAL LANGUAGE + FONT HOOK
// ==========================================================

export function useLanguage() {
  const [language, setLanguageState] =
    useState(() =>
      getCurrentLanguage()
    );

  const [font, setFontState] =
    useState(() =>
      getCurrentFont()
    );

  // --------------------------------------------------------
  // INITIAL APPLICATION
  // --------------------------------------------------------

  useEffect(() => {
    applyCurrentLanguage();
    applyCurrentFont();
  }, []);

  // --------------------------------------------------------
  // LANGUAGE EVENT
  // --------------------------------------------------------

  useEffect(() => {
    const handleLanguageChanged = (
      event
    ) => {
      const nextLanguage =
        normalizeLanguage(
          event?.detail?.language ||
            event?.detail?.code ||
            getCurrentLanguage()
        );

      setLanguageState(
        nextLanguage
      );
    };

    window.addEventListener(
      "languageChanged",
      handleLanguageChanged
    );

    return () => {
      window.removeEventListener(
        "languageChanged",
        handleLanguageChanged
      );
    };
  }, []);

  // --------------------------------------------------------
  // FONT EVENT
  // --------------------------------------------------------

  useEffect(() => {
    const handleFontChanged = (
      event
    ) => {
      const nextFont =
        event?.detail?.font ||
        getCurrentFont();

      setFontState(nextFont);
    };

    window.addEventListener(
      "fontChanged",
      handleFontChanged
    );

    return () => {
      window.removeEventListener(
        "fontChanged",
        handleFontChanged
      );
    };
  }, []);

  // --------------------------------------------------------
  // CROSS-TAB STORAGE SYNC
  // --------------------------------------------------------

  useEffect(() => {
    const handleStorage = (event) => {
      if (
        event.key === "ld_language" &&
        event.newValue
      ) {
        const nextLanguage =
          normalizeLanguage(
            event.newValue
          );

        setLanguageState(
          nextLanguage
        );

        applyCurrentLanguage();
      }

      if (
        event.key === "ld_font" &&
        event.newValue
      ) {
        setFontState(
          event.newValue
        );

        applyCurrentFont();
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  // --------------------------------------------------------
  // CHANGE LANGUAGE
  // --------------------------------------------------------

  const setLanguage = (
    nextLanguage
  ) => {
    const normalizedLanguage =
      setCurrentLanguage(
        nextLanguage
      );

    setLanguageState(
      normalizedLanguage
    );

    return normalizedLanguage;
  };

  // --------------------------------------------------------
  // CHANGE FONT
  // --------------------------------------------------------

  const setFont = (nextFont) => {
    const normalizedFont =
      setCurrentFont(nextFont);

    setFontState(
      normalizedFont
    );

    return normalizedFont;
  };

  // --------------------------------------------------------
  // TRANSLATION FUNCTION
  // --------------------------------------------------------

  const translate = (text) => {
    return t(
      text,
      language
    );
  };

  // --------------------------------------------------------
  // RETURN CENTRALIZED STATE
  // --------------------------------------------------------

  return {
    language,

    languageCode:
      getLanguageCode(language),

    font,

    setLanguage,
    setFont,

    languages:
      LANGUAGE_OPTIONS,

    fonts:
      FONT_OPTIONS,

    t: translate,

    translateMessage,

    translations,
  };
}

// ==========================================================
// DEFAULT EXPORT
// ==========================================================

export default translations;