/**
 * Kisan Connect - Main Application Bootstrap
 * Handles tab routing, multilingual localization, modal overlays,
 * voice recognition/speech synthesis, and toast notifications.
 */

const App = {
  currentTab: "tab-mandi",
  currentLang: "hi",

  init() {
    this.detectInstalledAppMode();
    this.loadSavedLanguage();
    this.setupTabs();
    document.body.dataset.currentTab = this.currentTab;
    const homeHero = document.querySelector(".hero-banner");
    if (homeHero) homeHero.hidden = this.currentTab !== "tab-mandi";
    this.setupModals();
    this.setupLanguageSwitcher();
    this.setupVoiceAssistant();

    // Initialize child modules
    if (window.MandiModule) window.MandiModule.init();
    if (window.MachineryModule) window.MachineryModule.init();
    if (window.AIDoctorModule) window.AIDoctorModule.init();
    if (window.SchemesModule) window.SchemesModule.init();
    if (window.FarmLedgerModule) window.FarmLedgerModule.init();

    // Check for URL hash to deep-link to tab
    const hash = window.location.hash.replace("#", "");
    if (hash && document.getElementById(hash)) {
      this.switchTab(hash);
    }
  },

  detectInstalledAppMode() {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    document.body.classList.toggle("pwa-installed", Boolean(standalone));
  },

  loadSavedLanguage() {
    try {
      const savedLang = localStorage.getItem("kisan_lang");
      if (savedLang && KISAN_DATA.translations[savedLang]) {
        this.currentLang = savedLang;
      }
    } catch (e) {
      console.warn("Storage access failed", e);
    }
    const select = document.getElementById("lang-selector");
    if (select) select.value = this.currentLang;
    this.updateDocumentLanguage(this.currentLang);
    this.applyTranslations(this.currentLang);
    this.applyGoogleTranslation(this.currentLang);
  },

  applyGoogleTranslation(lang) {
    // Google Translate translates the whole page, including untagged text and dynamically rendered cards.
    const apply = () => {
      const combo = document.querySelector(".goog-te-combo");
      if (!combo) return false;
      combo.value = lang;
      combo.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    if (apply()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (apply() || attempts >= 40) clearInterval(timer);
    }, 500);
  },

  setupLanguageSwitcher() {
    const select = document.getElementById("lang-selector");
    if (select) {
      select.addEventListener("change", (e) => {
        this.currentLang = e.target.value;
        try {
          localStorage.setItem("kisan_lang", this.currentLang);
        } catch (err) {}
        this.updateDocumentLanguage(this.currentLang);
        this.applyTranslations(this.currentLang);
        this.applyGoogleTranslation(this.currentLang);
        this.showToast(`Language selected: ${select.options[select.selectedIndex].text}`);
        // Re-apply translation after dynamic panels/cards update their text.
        window.setTimeout(() => this.applyGoogleTranslation(this.currentLang), 1200);
      });
    }
  },

  updateDocumentLanguage(lang) {
    document.documentElement.lang = lang || "en";
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
    document.body.classList.toggle("language-rtl", lang === "ur");
  },

  applyTranslations(lang) {
    const dict = KISAN_DATA.translations[lang] || KISAN_DATA.translations["en"];

    // Update text elements with data-i18n attributes
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) {
        el.textContent = dict[key];
      }
    });

    // Update placeholders
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
      const key = el.getAttribute("data-i18n-ph");
      if (dict[key]) {
        el.placeholder = dict[key];
      }
    });
  },

  setupTabs() {
    const navButtons = document.querySelectorAll(".nav-tab-btn, .mobile-nav-btn");
    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        if (targetTab) {
          this.switchTab(targetTab);
        }
      });
    });
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    document.body.dataset.currentTab = tabId;
    const hero = document.querySelector(".hero-banner");
    if (hero) hero.hidden = tabId !== "tab-mandi";

    // Update tab buttons
    document.querySelectorAll(".nav-tab-btn, .mobile-nav-btn").forEach(btn => {
      if (btn.getAttribute("data-tab") === tabId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Update tab panes
    document.querySelectorAll(".tab-pane").forEach(pane => {
      if (pane.id === tabId) {
        pane.classList.add("active");
      } else {
        pane.classList.remove("active");
      }
    });

    // Keep the selected panel heading visible below the sticky navigation.
    const activePane = document.getElementById(tabId);
    if (activePane) {
      const stickyNav = document.querySelector(".desktop-nav-bar");
      const navHeight = stickyNav ? stickyNav.getBoundingClientRect().height : 0;
      const targetTop = activePane.getBoundingClientRect().top + window.scrollY - navHeight - 12;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
    }
    window.location.hash = tabId;
  },

  setupModals() {
    // Close modal buttons
    document.querySelectorAll("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => {
        const modal = btn.closest(".modal-overlay");
        if (modal) {
          modal.classList.remove("active");
          modal.setAttribute("aria-hidden", "true");
          document.body.style.overflow = "";
        }
      });
    });

    // Backdrop click
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.remove("active");
        }
      });
    });

    // ESC key close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
      }
    });
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  },

  showToast(message, duration = 3500) {
    let toast = document.getElementById("kisan-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "kisan-toast";
      toast.className = "kisan-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("visible");

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove("visible");
    }, duration);
  },

  setupVoiceAssistant() {
    const voiceBtn = document.getElementById("btn-voice-search");
    if (voiceBtn) {
      voiceBtn.addEventListener("click", () => {
        this.triggerVoiceSearch();
      });
    }
  },

  triggerVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback: Open AI Agribot directly with prompt
      this.switchTab("tab-doctor");
      const chatWrapper = document.getElementById("kisan-chat-wrapper");
      if (chatWrapper) chatWrapper.scrollIntoView({ behavior: "smooth" });
      this.showToast("Microphone speech recognition not active in browser. Using text assistant.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = this.currentLang === "hi" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;

    this.showToast("🎙️ Listening... Please speak your question (बोलिए...)");

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.showToast(`Recognized: "${transcript}"`);
      this.switchTab("tab-doctor");
      if (window.AIDoctorModule) {
        window.AIDoctorModule.sendPredefinedQuery(transcript);
      }
    };

    recognition.onerror = () => {
      this.showToast("Could not recognize voice. Opening Kisan Sahayak chat...");
      this.switchTab("tab-doctor");
    };

    try {
      recognition.start();
    } catch (e) {
      this.switchTab("tab-doctor");
    }
  }
};

// Auto bootstrap on DOM content ready
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

if (typeof window !== "undefined") {
  window.App = App;
}
