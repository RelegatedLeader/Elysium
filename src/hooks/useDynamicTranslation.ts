import React, { useState, useCallback, useRef, useEffect } from "react";

// Translation APIs - Completely free alternatives
const SIMPLY_TRANSLATE_BASE = "https://simplytranslate.org/api";
const LINGVA_TRANSLATE_BASE = "https://lingva.lunar.icu/api/v1";
const GOOGLE_TRANSLATE_API =
  "https://translate.googleapis.com/translate_a/single";

// Basic translation dictionary for common UI terms when APIs fail
const basicTranslations: { [key: string]: { [lang: string]: string } } = {
  Settings: {
    es: "Configuración",
    fr: "Paramètres",
    de: "Einstellungen",
    it: "Impostazioni",
    pt: "Configurações",
    ru: "Настройки",
    ja: "設定",
    ko: "설정",
    zh: "设置",
    ar: "الإعدادات",
    hi: "सेटिंग्स",
  },
  Language: {
    es: "Idioma",
    fr: "Langue",
    de: "Sprache",
    it: "Lingua",
    pt: "Idioma",
    ru: "Язык",
    ja: "言語",
    ko: "언어",
    zh: "语言",
    ar: "اللغة",
    hi: "भाषा",
  },
  Save: {
    es: "Guardar",
    fr: "Enregistrer",
    de: "Speichern",
    it: "Salva",
    pt: "Salvar",
    ru: "Сохранить",
    ja: "保存",
    ko: "저장",
    zh: "保存",
    ar: "حفظ",
    hi: "सहेजें",
  },
  Cancel: {
    es: "Cancelar",
    fr: "Annuler",
    de: "Abbrechen",
    it: "Annulla",
    pt: "Cancelar",
    ru: "Отмена",
    ja: "キャンセル",
    ko: "취소",
    zh: "取消",
    ar: "إلغاء",
    hi: "रद्द करें",
  },
  Create: {
    es: "Crear",
    fr: "Créer",
    de: "Erstellen",
    it: "Crea",
    pt: "Criar",
    ru: "Создать",
    ja: "作成",
    ko: "생성",
    zh: "创建",
    ar: "إنشاء",
    hi: "बनाएं",
  },
  Edit: {
    es: "Editar",
    fr: "Modifier",
    de: "Bearbeiten",
    it: "Modifica",
    pt: "Editar",
    ru: "Редактировать",
    ja: "編集",
    ko: "편집",
    zh: "编辑",
    ar: "تحرير",
    hi: "संपादित करें",
  },
  Delete: {
    es: "Eliminar",
    fr: "Supprimer",
    de: "Löschen",
    it: "Elimina",
    pt: "Excluir",
    ru: "Удалить",
    ja: "削除",
    ko: "삭제",
    zh: "删除",
    ar: "حذف",
    hi: "मिटाएं",
  },
  Search: {
    es: "Buscar",
    fr: "Rechercher",
    de: "Suchen",
    it: "Cerca",
    pt: "Pesquisar",
    ru: "Поиск",
    ja: "検索",
    ko: "검색",
    zh: "搜索",
    ar: "بحث",
    hi: "खोजें",
  },
  Notes: {
    es: "Notas",
    fr: "Notes",
    de: "Notizen",
    it: "Note",
    pt: "Notas",
    ru: "Заметки",
    ja: "ノート",
    ko: "노트",
    zh: "笔记",
    ar: "ملاحظات",
    hi: "नोट्स",
  },
  "Recent Notes": {
    es: "Notas Recientes",
    fr: "Notes Récentes",
    de: "Aktuelle Notizen",
    it: "Note Recenti",
    pt: "Notas Recentes",
    ru: "Недавние Заметки",
    ja: "最近のノート",
    ko: "최근 노트",
    zh: "最近笔记",
    ar: "الملاحظات الأخيرة",
    hi: "हाल की नोट्स",
  },
  "Save to Cloud": {
    es: "Guardar en la Nube",
    fr: "Enregistrer dans le Cloud",
    de: "In der Cloud speichern",
    it: "Salva nel Cloud",
    pt: "Salvar na Nuvem",
    ru: "Сохранить в облаке",
    ja: "クラウドに保存",
    ko: "클라우드에 저장",
    zh: "保存到云端",
    ar: "حفظ في السحابة",
    hi: "क्लाउड में सहेजें",
  },
  "Cloud Storage": {
    es: "Almacenamiento en la Nube",
    fr: "Stockage Cloud",
    de: "Cloud-Speicher",
    it: "Archiviazione Cloud",
    pt: "Armazenamento na Nuvem",
    ru: "Облачное хранилище",
    ja: "クラウドストレージ",
    ko: "클라우드 스토리지",
    zh: "云存储",
    ar: "التخزين السحابي",
    hi: "क्लाउड स्टोरेज",
  },
  "New Note": {
    es: "Nueva Nota",
    fr: "Nouvelle Note",
    de: "Neue Notiz",
    it: "Nuova Nota",
    pt: "Nova Nota",
    ru: "Новая Заметка",
    ja: "新しいノート",
    ko: "새 노트",
    zh: "新笔记",
    ar: "ملاحظة جديدة",
    hi: "नई नोट",
  },
  "Delete Note": {
    es: "Eliminar Nota",
    fr: "Supprimer la Note",
    de: "Notiz löschen",
    it: "Elimina Nota",
    pt: "Excluir Nota",
    ru: "Удалить заметку",
    ja: "ノートを削除",
    ko: "노트 삭제",
    zh: "删除笔记",
    ar: "حذف الملاحظة",
    hi: "नोट मिटाएं",
  },
  "Edit Note": {
    es: "Editar Nota",
    fr: "Modifier la Note",
    de: "Notiz bearbeiten",
    it: "Modifica Nota",
    pt: "Editar Nota",
    ru: "Редактировать заметку",
    ja: "ノートを編集",
    ko: "노트 편집",
    zh: "编辑笔记",
    ar: "تحرير الملاحظة",
    hi: "नोट संपादित करें",
  },
  Bold: {
    es: "Negrita",
    fr: "Gras",
    de: "Fett",
    it: "Grassetto",
    pt: "Negrito",
    ru: "Жирный",
    ja: "太字",
    ko: "굵게",
    zh: "粗体",
    ar: "عريض",
    hi: "बोल्ड",
  },
  Italic: {
    es: "Cursiva",
    fr: "Italique",
    de: "Kursiv",
    it: "Corsivo",
    pt: "Itálico",
    ru: "Курсив",
    ja: "斜体",
    ko: "기울임",
    zh: "斜体",
    ar: "مائل",
    hi: "इटैलिक",
  },
  Underline: {
    es: "Subrayado",
    fr: "Souligné",
    de: "Unterstrichen",
    it: "Sottolineato",
    pt: "Sublinhado",
    ru: "Подчеркнутый",
    ja: "下線",
    ko: "밑줄",
    zh: "下划线",
    ar: "تسطير",
    hi: "अंडरलाइन",
  },
};

export interface TranslationCache {
  [key: string]: {
    [lang: string]: string;
  };
}

export const useDynamicTranslation = () => {
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasTranslatedCurrentLanguage, setHasTranslatedCurrentLanguage] =
    useState(false);

  // Cache for translations - load from localStorage on initialization
  const translationCache = useRef<TranslationCache>({});

  // Initialize cache from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("translation-cache");
      if (stored) {
        translationCache.current = JSON.parse(stored);
      }
    } catch (error) {
      console.warn(
        "Failed to load translation cache from localStorage:",
        error
      );
    }
  }, []);

  // Function to save cache to localStorage
  const saveCacheToStorage = useCallback(() => {
    try {
      localStorage.setItem(
        "translation-cache",
        JSON.stringify(translationCache.current)
      );
    } catch (error) {
      console.warn("Failed to save translation cache to localStorage:", error);
    }
  }, []);

  // Store original text for nodes
  const originalTextMap = useRef(new WeakMap<Text, string>());

  // Store original placeholders for input elements
  const originalPlaceholderMap = useRef(new WeakMap<Element, string>());

  // Batch translation function using LibreTranslate API (completely free)
  const translateBatch = useCallback(
    async (
      texts: string[],
      targetLang: string,
      retryCount = 0
    ): Promise<string[]> => {
      const maxRetries = 3;
      const baseDelay = 1000; // Reduced delay for Lingva Translate

      try {
        // Add delay between requests to respect rate limits
        if (retryCount === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // 0.5 second initial delay
        }

        // Process texts in smaller batches to avoid rate limits
        const batchSize = 5; // Increased to 5 since Lingva is simpler
        const results: string[] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);

          // Translate this small batch with dual API fallback
          const batchPromises = batch.map(async (text, batchIndex) => {
            try {
              // Stagger requests within the batch
              await new Promise((resolve) =>
                setTimeout(resolve, batchIndex * 200)
              );

              // Try Simply Translate first (completely free, no API key required)
              try {
                const response = await fetch(
                  `${SIMPLY_TRANSLATE_BASE}/translate?engine=google&from=en&to=${targetLang}&text=${encodeURIComponent(
                    text
                  )}`,
                  {
                    method: "GET",
                    headers: {
                      Accept: "application/json",
                    },
                  }
                );

                if (response.ok) {
                  const data = await response.json();
                  if (data && data.translated_text) {
                    return data.translated_text;
                  }
                }
              } catch (simplyError) {
                console.warn(
                  `Simply Translate failed for "${text}", trying Lingva:`,
                  simplyError
                );
              }

              // Try Lingva Translate second
              try {
                const encodedText = encodeURIComponent(text);
                const response = await fetch(
                  `${LINGVA_TRANSLATE_BASE}/en/${targetLang}/${encodedText}`,
                  {
                    method: "GET",
                  }
                );

                if (response.ok) {
                  const data = await response.json();
                  if (data && data.translation) {
                    return data.translation;
                  }
                }
              } catch (lingvaError) {
                console.warn(
                  `Lingva Translate failed for "${text}", trying Google Translate:`,
                  lingvaError
                );
              }

              // Fallback to Google Translate (unofficial API)
              const googleResponse = await fetch(
                `${GOOGLE_TRANSLATE_API}?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(
                  text
                )}`,
                { method: "GET" }
              );

              if (googleResponse.status === 429) {
                await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 second wait
                throw new Error("Rate limited");
              }

              if (googleResponse.ok) {
                const googleData = await googleResponse.json();
                if (
                  googleData &&
                  googleData[0] &&
                  googleData[0][0] &&
                  googleData[0][0][0]
                ) {
                  return googleData[0][0][0];
                }
              }

              // Final fallback: Use basic dictionary for common terms
              if (
                basicTranslations[text] &&
                basicTranslations[text][targetLang]
              ) {
                console.log(
                  `Using basic translation for "${text}": ${basicTranslations[text][targetLang]}`
                );
                return basicTranslations[text][targetLang];
              }

              return text; // Return original text if all methods fail
            } catch (error) {
              console.warn(`Translation failed for text in batch:`, error);
              return text; // Return original text on error
            }
          });

          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);

          // Wait between batches
          if (i + batchSize < texts.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay between batches
          }
        }

        return results;
      } catch (error) {
        console.warn(
          `Batch translation failed for ${texts.length} texts:`,
          error
        );
        throw error;
      }
    },
    []
  );

  // Language names mapping - Lingva Translate supported languages (free, no API key)
  const languageNames: { [key: string]: string } = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
    tr: "Turkish",
    pl: "Polish",
    nl: "Dutch",
    sv: "Swedish",
    da: "Danish",
    nb: "Norwegian",
    fi: "Finnish",
    cs: "Czech",
    sk: "Slovak",
    hu: "Hungarian",
    ro: "Romanian",
    bg: "Bulgarian",
    sl: "Slovenian",
    et: "Estonian",
    lv: "Latvian",
    lt: "Lithuanian",
    el: "Greek",
    he: "Hebrew",
    th: "Thai",
    vi: "Vietnamese",
    id: "Indonesian",
    ms: "Malay",
    tl: "Tagalog",
    uk: "Ukrainian",
    sr: "Serbian",
    ca: "Catalan",
    eu: "Basque",
    gl: "Galician",
    eo: "Esperanto",
    fa: "Persian",
    ur: "Urdu",
    sq: "Albanian",
    az: "Azerbaijani",
    bn: "Bengali",
    ga: "Irish",
    ky: "Kyrgyz",
  };

  const translatePage = useCallback(
    async (targetLang: string) => {
      console.log("translatePage called with targetLang:", targetLang);
      if (targetLang === "en") {
        // Reset to original text
        restoreOriginalText();
        return;
      }

      setIsTranslating(true);
      console.log("Starting translation process, set isTranslating to true");

      try {
        // Get all text nodes on the page
        const textNodes = getAllTextNodes(document.body);

        // Filter out nodes that shouldn't be translated
        const translatableNodes = textNodes.filter((node) => {
          const element = node.parentElement;
          if (!element) return false;

          // Skip elements with these classes/attributes
          if (element.closest("[data-no-translate]")) return false;
          if (element.closest("script, style, code, pre")) return false;
          if (element.closest('[contenteditable="true"]')) return false;
          if (element.closest("input, textarea, select")) return false;

          // Skip very short text (likely icons or symbols) - but be less restrictive
          const text = node.textContent?.trim() || "";
          if (text.length < 1) return false; // Allow single characters now

          // Skip text that looks like code or URLs
          if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text))
            return false; // emails
          if (/^https?:\/\//.test(text)) return false; // URLs
          if (/^[a-zA-Z0-9]+$/.test(text) && text.length > 50) return false; // very long alphanumeric (likely IDs)

          // Be more permissive with numbers and special characters
          if (/^\d+$/.test(text) && text.length > 10) return false; // only skip very long pure numbers
          // Allow more special characters but skip obvious code
          if (
            /[<>{}[\]\\|]/.test(text) &&
            /function|var|let|const|class|import|export/.test(text)
          )
            return false; // code-like text

          // Skip very common technical terms that don't need translation (be selective)
          const commonUIText = [
            "ok",
            "yes",
            "no",
            "id",
            "url",
            "api",
            "json",
            "xml",
            "html",
            "css",
            "js",
            "http",
            "https",
            "www",
            "com",
            "org",
            "net",
            "io",
            "dev",
            "app",
            "web",
            "site",
            "page",
            "link",
            "file",
            "data",
            "user",
            "admin",
            "root",
            "null",
            "undefined",
            "true",
            "false",
            "error",
            "warning",
            "info",
            "debug",
            "log",
            "test",
            "prod",
            "dev",
            "qa",
            "uat",
            "staging",
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
          ];
          if (commonUIText.includes(text.toLowerCase())) return false;

          return true;
        });

        // Extract unique texts to translate (limit to prevent overwhelming the API)
        const maxTextsToTranslate = 100; // Increased to 100 to translate more UI elements
        let textsToTranslate = Array.from(
          new Set(
            translatableNodes
              .map((node) => node.textContent?.trim())
              .filter(Boolean)
          )
        ) as string[];

        // Prioritize important UI elements (buttons, navigation, etc.)
        const priorityTexts = textsToTranslate.filter(
          (text) =>
            text.length <= 30 && // Short to medium texts are likely UI elements
            !/^\d+$/.test(text) && // Not pure numbers
            !/^https?:\/\//.test(text) && // Not URLs
            !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text) // Not emails
        );

        const otherTexts = textsToTranslate.filter(
          (text) => !priorityTexts.includes(text)
        );

        // Also collect placeholder texts from inputs
        const placeholderElements = document.querySelectorAll(
          "input[placeholder], textarea[placeholder]"
        );
        const placeholderTexts = Array.from(placeholderElements)
          .map((el) => (el as HTMLInputElement).placeholder?.trim())
          .filter(Boolean)
          .filter((text) => text && text.length >= 2);

        // Combine text nodes and placeholders
        const allTextsToTranslate = Array.from(
          new Set([...textsToTranslate, ...placeholderTexts])
        );
        console.log("Found text nodes:", textNodes.length);
        console.log("Translatable nodes:", translatableNodes.length);
        console.log(
          "Unique texts to translate (limited):",
          textsToTranslate.length
        );
        console.log("Texts to translate:", textsToTranslate.slice(0, 5)); // Show first 5

        // Separate cached and uncached texts for batch processing
        const cachedTexts: { [key: string]: string } = {};
        const uncachedTexts: string[] = [];

        textsToTranslate.forEach((text) => {
          if (translationCache.current[text]?.[targetLang]) {
            cachedTexts[text] = translationCache.current[text][targetLang];
          } else {
            uncachedTexts.push(text);
          }
        });

        console.log(
          `Cached texts: ${Object.keys(cachedTexts).length}, Uncached texts: ${
            uncachedTexts.length
          }`
        );

        // Batch translate uncached texts
        let translatedBatch: string[] = [];
        if (uncachedTexts.length > 0) {
          try {
            console.log(`Batch translating ${uncachedTexts.length} texts...`);
            translatedBatch = await translateBatch(uncachedTexts, targetLang);

            // Cache the batch results
            uncachedTexts.forEach((text, index) => {
              const translated = translatedBatch[index] || text;
              if (!translationCache.current[text]) {
                translationCache.current[text] = {};
              }
              translationCache.current[text][targetLang] = translated;
            });

            // Save cache to localStorage
            saveCacheToStorage();
          } catch (error) {
            console.error("Batch translation failed:", error);
            // Fallback: mark all uncached texts as untranslated
            uncachedTexts.forEach((text) => {
              cachedTexts[text] = text; // fallback to original
            });
            translatedBatch = [];
          }
        }

        // Combine cached and newly translated texts
        const translatedTexts: { [key: string]: string } = { ...cachedTexts };
        uncachedTexts.forEach((text, index) => {
          translatedTexts[text] = translatedBatch[index] || text;
        });

        const successCount = Object.keys(translatedTexts).length;
        const failureCount = textsToTranslate.length - successCount;

        console.log(
          `Translation completed: ${successCount} successful, ${failureCount} failed`
        );

        // Apply translations to DOM
        translatableNodes.forEach((node) => {
          const originalText = node.textContent?.trim();
          if (originalText && translatedTexts[originalText]) {
            // Store original text for restoration
            if (!originalTextMap.current.has(node)) {
              originalTextMap.current.set(node, node.textContent || "");
            }
            node.textContent = translatedTexts[originalText];
          }
        });

        // Apply translations to placeholders
        placeholderElements.forEach((element) => {
          const input = element as HTMLInputElement;
          const originalPlaceholder = input.placeholder?.trim();
          if (originalPlaceholder && translatedTexts[originalPlaceholder]) {
            // Store original placeholder for restoration
            if (!originalPlaceholderMap.current.has(input)) {
              originalPlaceholderMap.current.set(
                input,
                input.placeholder || ""
              );
            }
            input.placeholder = translatedTexts[originalPlaceholder];
          }
        });

        console.log("Translation process completed successfully");
      } catch (error) {
        console.error("Page translation failed:", error);
        // Make sure isTranslating is reset even on error
        setIsTranslating(false);
        throw error; // Re-throw so calling function knows there was an error
      } finally {
        console.log("translatePage finally block executed");
        setIsTranslating(false);
      }
    },
    [translationCache, saveCacheToStorage]
  );

  const restoreOriginalText = useCallback(() => {
    const textNodes = getAllTextNodes(document.body);
    textNodes.forEach((node) => {
      const originalText = originalTextMap.current.get(node);
      if (originalText !== undefined) {
        node.textContent = originalText;
      }
    });

    // Restore placeholders
    const placeholderElements = document.querySelectorAll(
      "input[placeholder], textarea[placeholder]"
    );
    placeholderElements.forEach((element) => {
      const originalPlaceholder = originalPlaceholderMap.current.get(element);
      if (originalPlaceholder !== undefined) {
        (element as HTMLInputElement).placeholder = originalPlaceholder;
      }
    });
  }, []);

  // Ensure cached translations are applied to the current DOM without making network calls
  const ensureLanguageApplied = useCallback(
    (languageCode?: string) => {
      const lang = languageCode || currentLanguage;
      if (!lang || lang === "en") return 0;

      const cachedTranslations = translationCache.current;
      if (!cachedTranslations || Object.keys(cachedTranslations).length === 0)
        return 0;

      const textNodes = getAllTextNodes(document.body);
      let applied = 0;

      textNodes.forEach((node) => {
        const element = node.parentElement;
        if (!element) return;

        // Skip protected elements
        if (element.closest("[data-no-translate]")) return;
        if (element.closest("script, style, code, pre")) return;
        if (element.closest('[contenteditable="true"]')) return;
        if (element.closest("input, textarea, select")) return;

        const originalText = node.textContent?.trim();
        if (originalText && cachedTranslations[originalText]?.[lang]) {
          if (!originalTextMap.current.has(node)) {
            originalTextMap.current.set(node, node.textContent || "");
          }
          node.textContent = cachedTranslations[originalText][lang];
          applied++;
        }
      });

      // Placeholders
      const placeholderElements = document.querySelectorAll(
        "input[placeholder], textarea[placeholder]"
      );
      placeholderElements.forEach((element) => {
        const input = element as HTMLInputElement;
        const originalPlaceholder = input.placeholder?.trim();
        if (
          originalPlaceholder &&
          cachedTranslations[originalPlaceholder]?.[lang]
        ) {
          if (!originalPlaceholderMap.current.has(input)) {
            originalPlaceholderMap.current.set(input, input.placeholder || "");
          }
          input.placeholder = cachedTranslations[originalPlaceholder][lang];
          applied++;
        }
      });

      if (applied > 0) {
        setHasTranslatedCurrentLanguage(true);
        console.log(
          `ensureLanguageApplied: applied ${applied} cached translations for ${lang}`
        );
      }

      return applied;
    },
    [currentLanguage]
  );

  // Helper function to get all text nodes
  const getAllTextNodes = (element: Element): Text[] => {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    return textNodes;
  };

  const changeLanguage = useCallback(
    async (languageCode: string) => {
      if (languageCode === currentLanguage) return;

      console.log("Changing language to:", languageCode);

      // Set translating state
      setIsTranslating(true);

      // Save language immediately
      setCurrentLanguage(languageCode);
      localStorage.setItem("app-language", languageCode);

      // Reset translation flag for new language
      setHasTranslatedCurrentLanguage(false);

      // First, try to apply cached translations immediately for instant feedback
      const cachedTranslations = translationCache.current;
      let hasAppliedCached = false;

      if (Object.keys(cachedTranslations).length > 0) {
        console.log("Applying cached translations first for instant feedback");
        const textNodes = getAllTextNodes(document.body);
        let appliedCount = 0;

        textNodes.forEach((node) => {
          const element = node.parentElement;
          if (!element) return;

          // Skip elements with these classes/attributes
          if (element.closest("[data-no-translate]")) return;
          if (element.closest("script, style, code, pre")) return;
          if (element.closest('[contenteditable="true"]')) return;
          if (element.closest("input, textarea, select")) return;

          const originalText = node.textContent?.trim();
          if (
            originalText &&
            cachedTranslations[originalText]?.[languageCode]
          ) {
            // Store original text for restoration
            if (!originalTextMap.current.has(node)) {
              originalTextMap.current.set(node, node.textContent || "");
            }
            node.textContent = cachedTranslations[originalText][languageCode];
            appliedCount++;
          }
        });

        // Apply cached translations to placeholders
        const placeholderElements = document.querySelectorAll(
          "input[placeholder], textarea[placeholder]"
        );
        placeholderElements.forEach((element) => {
          const input = element as HTMLInputElement;
          const originalPlaceholder = input.placeholder?.trim();
          if (
            originalPlaceholder &&
            cachedTranslations[originalPlaceholder]?.[languageCode]
          ) {
            // Store original placeholder for restoration
            if (!originalPlaceholderMap.current.has(input)) {
              originalPlaceholderMap.current.set(
                input,
                input.placeholder || ""
              );
            }
            input.placeholder =
              cachedTranslations[originalPlaceholder][languageCode];
          }
        });

        if (appliedCount > 0) {
          hasAppliedCached = true;
          console.log(`Applied ${appliedCount} cached translations instantly`);
        }
      }

      // Then fetch any missing translations in the background
      try {
        await translatePage(languageCode);
        setHasTranslatedCurrentLanguage(true);
      } catch (error) {
        console.error("Failed to translate page:", error);
        // If we applied cached translations, that's still better than nothing
        if (hasAppliedCached) {
          setHasTranslatedCurrentLanguage(true);
        }
      } finally {
        setIsTranslating(false);
      }
    },
    [currentLanguage, translatePage]
  );

  // Load saved language on mount (but don't auto-translate)
  React.useEffect(() => {
    const savedLanguage = localStorage.getItem("app-language");
    if (savedLanguage) {
      setCurrentLanguage(savedLanguage);
      // Apply cached translations immediately if they exist
      const cachedTranslations = translationCache.current;
      if (Object.keys(cachedTranslations).length > 0) {
        console.log(
          "Applying cached translations for saved language:",
          savedLanguage
        );
        // Apply cached translations to DOM
        const textNodes = getAllTextNodes(document.body);
        textNodes.forEach((node) => {
          const element = node.parentElement;
          if (!element) return;

          // Skip elements with these classes/attributes
          if (element.closest("[data-no-translate]")) return;
          if (element.closest("script, style, code, pre")) return;
          if (element.closest('[contenteditable="true"]')) return;
          if (element.closest("input, textarea, select")) return;

          const originalText = node.textContent?.trim();
          if (
            originalText &&
            cachedTranslations[originalText]?.[savedLanguage]
          ) {
            // Store original text for restoration
            if (!originalTextMap.current.has(node)) {
              originalTextMap.current.set(node, node.textContent || "");
            }
            node.textContent = cachedTranslations[originalText][savedLanguage];
          }
        });

        // Apply cached translations to placeholders
        const placeholderElements = document.querySelectorAll(
          "input[placeholder], textarea[placeholder]"
        );
        placeholderElements.forEach((element) => {
          const input = element as HTMLInputElement;
          const originalPlaceholder = input.placeholder?.trim();
          if (
            originalPlaceholder &&
            cachedTranslations[originalPlaceholder]?.[savedLanguage]
          ) {
            // Store original placeholder for restoration
            if (!originalPlaceholderMap.current.has(input)) {
              originalPlaceholderMap.current.set(
                input,
                input.placeholder || ""
              );
            }
            input.placeholder =
              cachedTranslations[originalPlaceholder][savedLanguage];
          }
        });
      }
    }
  }, []);

  // Watch for DOM changes and re-translate when new content is added
  // DISABLED: This was causing unnecessary re-translations every time user navigates
  // React.useEffect(() => {
  //   if (currentLanguage === "en") return; // No need to translate if English

  //   const observer = new MutationObserver((mutations) => {
  //     // Don't trigger if we're already translating
  //     if (isTranslating) return;

  //     let shouldRetranslate = false;

  //     for (const mutation of mutations) {
  //       // Check if new text nodes were added
  //       if (mutation.type === "childList") {
  //         const addedNodes = Array.from(mutation.addedNodes);
  //         const hasNewTextNodes = addedNodes.some(node =>
  //           node.nodeType === Node.TEXT_NODE ||
  //           (node.nodeType === Node.ELEMENT_NODE &&
  //            (node as Element).querySelectorAll &&
  //            (node as Element).querySelectorAll('input[placeholder], textarea[placeholder]').length > 0) ||
  //           (node.nodeType === Node.ELEMENT_NODE && (node as Element).textContent?.trim())
  //         );

  //         if (hasNewTextNodes) {
  //           shouldRetranslate = true;
  //           break;
  //         }
  //       }
  //     }

  //     if (shouldRetranslate) {
  //       console.log("DOM changes detected, re-translating page");
  //       // Debounce the re-translation to avoid excessive API calls
  //       setTimeout(() => {
  //         translatePage(currentLanguage);
  //       }, 1000);
  //     }
  //   });

  //   // Start observing
  //   observer.observe(document.body, {
  //     childList: true,
  //     subtree: true,
  //     characterData: true
  //   });

  //   return () => observer.disconnect();
  // }, [currentLanguage, translatePage, isTranslating]);

  // Single text translation function
  const translate = useCallback(
    async (text: string, targetLang?: string): Promise<string> => {
      const lang = targetLang || currentLanguage;
      if (lang === "en") return text;

      // Check cache first
      if (translationCache.current[text]?.[lang]) {
        return translationCache.current[text][lang];
      }

      // Check basic translations
      if (basicTranslations[text]?.[lang]) {
        const translated = basicTranslations[text][lang];
        // Cache it
        if (!translationCache.current[text]) {
          translationCache.current[text] = {};
        }
        translationCache.current[text][lang] = translated;
        saveCacheToStorage();
        return translated;
      }

      // For component strings, don't make API calls to avoid hanging
      // Only return original text - API translation will happen via translatePage
      return text;
    },
    [currentLanguage, saveCacheToStorage]
  );

  return {
    translatePage,
    currentLanguage,
    isTranslating,
    changeLanguage,
    languageNames,
    ensureLanguageApplied,
    translate,
  };
};
