import React, { useState, useCallback, useRef, useEffect } from "react";

// Google Translate unofficial API endpoint (free, no CORS issues)
const GOOGLE_TRANSLATE_API = "https://translate.googleapis.com/translate_a/single";

export interface TranslationCache {
  [key: string]: {
    [lang: string]: string;
  };
}

export const useDynamicTranslation = () => {
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [showLanguagePopup, setShowLanguagePopup] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<string | null>(null);
  const [pendingLanguageName, setPendingLanguageName] = useState<string>("");

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

  // Translation function using Google Translate unofficial API with rate limiting
  const translateText = async (
    text: string,
    targetLang: string,
    retryCount = 0
  ): Promise<string> => {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay

    try {
      // Add delay between requests to respect rate limits
      if (retryCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay for faster translation
      }

      const response = await fetch(
        `${GOOGLE_TRANSLATE_API}?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(
          text
        )}`,
        {
          method: "GET",
        }
      );

      if (response.status === 429) {
        // Rate limited - retry with exponential backoff
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
          console.warn(
            `Rate limited, retrying in ${delay}ms... (attempt ${
              retryCount + 1
            }/${maxRetries + 1})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return translateText(text, targetLang, retryCount + 1);
        } else {
          throw new Error("Rate limit exceeded, max retries reached");
        }
      }

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.status}`);
      }

      const data = await response.json();

      // Google Translate API response format: [[["translated text", "original text", null, null, 0]]]
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0];
      }

      return text; // fallback to original text
    } catch (error) {
      console.warn(`Translation failed for "${text}":`, error);
      throw error;
    }
  };

  // Language names mapping
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
    no: "Norwegian",
    fi: "Finnish",
    cs: "Czech",
    sk: "Slovak",
    hu: "Hungarian",
    ro: "Romanian",
    bg: "Bulgarian",
    hr: "Croatian",
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
    tl: "Filipino",
    uk: "Ukrainian",
    sr: "Serbian",
    bs: "Bosnian",
    mk: "Macedonian",
    sq: "Albanian",
    mt: "Maltese",
    ga: "Irish",
    cy: "Welsh",
    is: "Icelandic",
    fo: "Faroese",
    kl: "Greenlandic",
    iu: "Inuktitut",
    am: "Amharic",
    ti: "Tigrinya",
    om: "Oromo",
    so: "Somali",
    sw: "Swahili",
    rw: "Kinyarwanda",
    rn: "Kirundi",
    lg: "Luganda",
    ny: "Chichewa",
    st: "Sesotho",
    tn: "Tswana",
    xh: "Xhosa",
    zu: "Zulu",
    af: "Afrikaans",
    yo: "Yoruba",
    ig: "Igbo",
    ha: "Hausa",
    tw: "Twi",
    ak: "Akan",
    ee: "Ewe",
    bm: "Bambara",
    ff: "Fulah",
    wo: "Wolof",
    sn: "Shona",
    nd: "North Ndebele",
    nr: "South Ndebele",
    ve: "Venda",
    ts: "Tsonga",
    ss: "Swati",
    nso: "Northern Sotho",
    km: "Khmer",
    lo: "Lao",
    my: "Burmese",
    ka: "Georgian",
    hy: "Armenian",
    az: "Azerbaijani",
    kk: "Kazakh",
    ky: "Kyrgyz",
    tg: "Tajik",
    tk: "Turkmen",
    uz: "Uzbek",
    ur: "Urdu",
    fa: "Persian",
    ps: "Pashto",
    sd: "Sindhi",
    ne: "Nepali",
    si: "Sinhala",
    dv: "Dhivehi",
    bn: "Bengali",
    as: "Assamese",
    or: "Oriya",
    gu: "Gujarati",
    pa: "Punjabi",
    mr: "Marathi",
    sa: "Sanskrit",
    te: "Telugu",
    kn: "Kannada",
    ml: "Malayalam",
    ta: "Tamil",
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

          // Skip very short text (likely icons or symbols)
          const text = node.textContent?.trim() || "";
          if (text.length < 2) return false; // Reduced from 3 to 2

          // Skip text that looks like code or URLs
          if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text))
            return false; // emails
          if (/^https?:\/\//.test(text)) return false; // URLs
          if (/^[a-zA-Z0-9]+$/.test(text) && text.length > 30) return false; // very long alphanumeric (likely IDs)

          // Be less restrictive with numbers and special characters
          // Allow text with numbers if it's not just numbers
          if (/^\d+$/.test(text)) return false; // pure numbers only
          // Allow common special characters but skip code-like text
          if (/[<>{}[\]\\|]/.test(text)) return false; // code-like characters

          // Skip very common UI text that doesn't need translation (be very selective)
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
          ];
          if (commonUIText.includes(text.toLowerCase())) return false;

          return true;
        });

        // Extract unique texts to translate (limit to prevent overwhelming the API)
        const maxTextsToTranslate = 50; // Increased to 50 to translate more UI elements
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
        const placeholderElements = document.querySelectorAll('input[placeholder], textarea[placeholder]');
        const placeholderTexts = Array.from(placeholderElements)
          .map(el => (el as HTMLInputElement).placeholder?.trim())
          .filter(Boolean)
          .filter(text => text && text.length >= 2);

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

        // Translate sequentially to avoid rate limits (much more conservative)
        const translatedTexts: { [key: string]: string } = {};
        let successCount = 0;
        let failureCount = 0;

        for (const text of textsToTranslate) {
          try {
            // Check cache first
            if (translationCache.current[text]?.[targetLang]) {
              translatedTexts[text] =
                translationCache.current[text][targetLang];
              successCount++;
              continue;
            }

            try {
              const translated = await translateText(text, targetLang);

              // Cache the result
              if (!translationCache.current[text]) {
                translationCache.current[text] = {};
              }
              translationCache.current[text][targetLang] = translated;

              // Save to localStorage
              saveCacheToStorage();

              translatedTexts[text] = translated;
              successCount++;
            } catch (error) {
              console.warn(`Failed to translate: "${text}"`, error);
              translatedTexts[text] = text; // fallback to original
              failureCount++;
            }
          } catch (error) {
            console.warn("Translation failed:", error);
            translatedTexts[text] = text; // fallback to original
            failureCount++;
          }
        }

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
              originalPlaceholderMap.current.set(input, input.placeholder || "");
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
    const placeholderElements = document.querySelectorAll('input[placeholder], textarea[placeholder]');
    placeholderElements.forEach((element) => {
      const originalPlaceholder = originalPlaceholderMap.current.get(element);
      if (originalPlaceholder !== undefined) {
        (element as HTMLInputElement).placeholder = originalPlaceholder;
      }
    });
  }, []);

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

  const requestLanguageChange = useCallback(
    (languageCode: string) => {
      if (languageCode === currentLanguage) return;

      const languageName = languageNames[languageCode] || languageCode;
      setPendingLanguage(languageCode);
      setPendingLanguageName(languageName);
      setShowLanguagePopup(true);
    },
    [currentLanguage]
  );

  const confirmLanguageChange = useCallback(async () => {
    console.log(
      "confirmLanguageChange called, pendingLanguage:",
      pendingLanguage
    );
    console.log("Current showLanguagePopup state:", showLanguagePopup);

    if (!pendingLanguage) {
      console.log("No pending language, returning");
      return;
    }

    // Show loading state for 0.5 seconds before refreshing
    console.log("Showing loading state for 0.5 seconds");
    setIsTranslating(true);

    // Wait 0.5 seconds to show the loading message
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Close popup and save language
    console.log("Closing popup and saving language");
    setShowLanguagePopup(false);
    setPendingLanguage(null);
    setPendingLanguageName("");

    // Save language and refresh page
    console.log("Setting current language to:", pendingLanguage);
    setCurrentLanguage(pendingLanguage);
    localStorage.setItem("app-language", pendingLanguage);

    // Refresh the page to apply the language change
    console.log("Refreshing page to apply language change");
    window.location.reload();
  }, [pendingLanguage]);

  const cancelLanguageChange = useCallback(() => {
    setShowLanguagePopup(false);
    setPendingLanguage(null);
    setPendingLanguageName("");
  }, []);

  const changeLanguage = useCallback(
    (languageCode: string) => {
      requestLanguageChange(languageCode);
    },
    [requestLanguageChange]
  );

  // Load saved language and translate on mount
  React.useEffect(() => {
    const savedLanguage = localStorage.getItem("app-language");
    if (savedLanguage && savedLanguage !== "en") {
      setCurrentLanguage(savedLanguage);
      // Translate page after DOM is fully loaded
      const translateOnLoad = () => {
        console.log(
          "DOM fully loaded, starting translation for saved language:",
          savedLanguage
        );
        translatePage(savedLanguage);
      };

      if (document.readyState === "loading") {
        window.addEventListener("load", translateOnLoad);
        return () => window.removeEventListener("load", translateOnLoad);
      } else {
        // DOM already loaded
        setTimeout(translateOnLoad, 500); // Give extra time for React components to render
      }
    }
  }, [translatePage]);

  // Watch for DOM changes and re-translate when new content is added
  React.useEffect(() => {
    if (currentLanguage === "en") return; // No need to translate if English

    const observer = new MutationObserver((mutations) => {
      let shouldRetranslate = false;

      for (const mutation of mutations) {
        // Check if new text nodes were added
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          const hasNewTextNodes = addedNodes.some(node =>
            node.nodeType === Node.TEXT_NODE ||
            (node.nodeType === Node.ELEMENT_NODE &&
             (node as Element).querySelectorAll &&
             (node as Element).querySelectorAll('input[placeholder], textarea[placeholder]').length > 0) ||
            (node.nodeType === Node.ELEMENT_NODE && (node as Element).textContent?.trim())
          );

          if (hasNewTextNodes) {
            shouldRetranslate = true;
            break;
          }
        }
      }

      if (shouldRetranslate) {
        console.log("DOM changes detected, re-translating page");
        // Debounce the re-translation to avoid excessive API calls
        setTimeout(() => {
          translatePage(currentLanguage);
        }, 1000);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, [currentLanguage, translatePage]);

  return {
    translatePage,
    currentLanguage,
    isTranslating,
    changeLanguage,
    showLanguagePopup,
    pendingLanguage,
    pendingLanguageName,
    confirmLanguageChange,
    cancelLanguageChange,
    languageNames,
  };
};
