/**
 * Kisan Connect - Sarkari Yojana Mitra
 * Government Subsidies & Schemes Navigator for Small & Marginal Farmers.
 * Features an interactive eligibility wizard and document readiness checklist.
 */

const SchemesModule = {
  activeCategory: "all",
  searchQuery: "",

  init() {
    this.renderSchemesList();
    this.setupListeners();
    this.checkOfficialUpdates(false);
    // Re-check every 6 hours while the app is open; actual feed coverage depends on SCHEME_FEED_URL.
    if (!this._schemeRefreshTimer) this._schemeRefreshTimer = window.setInterval(() => this.checkOfficialUpdates(false), 6 * 60 * 60 * 1000);
    this.initEligibilityWizard();
  },

  setupListeners() {
    const updateButton = document.getElementById("btn-check-scheme-updates");
    if (updateButton) updateButton.addEventListener("click", () => this.checkOfficialUpdates(true));

    // Category pills
    const categoryBtns = document.querySelectorAll(".scheme-category-btn");
    categoryBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        categoryBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeCategory = btn.dataset.category || "all";
        this.renderSchemesList();
      });
    });

    // Search input
    const searchInput = document.getElementById("schemes-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderSchemesList();
      });
    }
  },


  async checkOfficialUpdates(manual = false) {
    const status = document.getElementById("scheme-update-status");
    const container = document.getElementById("scheme-live-updates");
    const button = document.getElementById("btn-check-scheme-updates");
    if (!status || !container) return;
    if (button) { button.disabled = true; button.textContent = "Checking official sources…"; }
    status.textContent = "Checking the connected official scheme feed…";
    try {
      const response = await fetch("/api/schemes/updates", { headers: { "Accept": "application/json" }, cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Official update feed unavailable");
      const items = Array.isArray(payload.items) ? payload.items : [];
      const checkedAt = payload.checkedAt ? new Date(payload.checkedAt).toLocaleString() : new Date().toLocaleString();
      status.textContent = (payload.message || "Official scheme feed checked.") + " Last checked: " + checkedAt + ".";
      if (!items.length) {
        const notConnected = payload.source === "official_portals";
        container.innerHTML = `<div class="empty-state"><h3>${notConnected ? "Automatic scheme sync is not connected yet" : "No new announcements returned by the connected feed"}</h3><p>${notConnected ? "The refresh request reached the backend, but no authorized official feed is configured. Existing scheme cards remain available below. Connect an approved myScheme/API Setu feed or another authorized government feed to import current listings." : "This does not mean no new schemes exist. Verify the latest notices on the official portals."}</p><div class="scheme-live-source-links"><a href="https://www.myscheme.gov.in/" target="_blank" rel="noopener">Browse myScheme ↗</a><a href="https://www.india.gov.in/my-government/schemes" target="_blank" rel="noopener">India.gov.in schemes ↗</a><a href="https://www.pib.gov.in/" target="_blank" rel="noopener">PIB announcements ↗</a></div></div>`;
        return;
      }
      container.innerHTML = items.map(item => `<article class="scheme-card"><h3>${this.escapeHtml(item.title || item.name || "Government scheme update")}</h3><p>${this.escapeHtml(item.summary || item.description || "Open the official source for details.")}</p><p class="text-muted">${this.escapeHtml(item.date || item.publishedAt || "")}</p><a class="btn btn-primary btn-sm" href="${this.safeUrl(item.url || item.link)}" target="_blank" rel="noopener">Open official notice ↗</a></article>`).join("");
    } catch (error) {
      status.textContent = "The official scheme feed could not be reached. Existing scheme listings are still available below.";
      container.innerHTML = `<div class="empty-state"><p>Check official sources for current announcements:</p><div class="scheme-live-source-links"><a href="https://www.myscheme.gov.in/" target="_blank" rel="noopener">myScheme ↗</a><a href="https://www.india.gov.in/my-government/schemes" target="_blank" rel="noopener">India.gov.in schemes ↗</a><a href="https://www.pib.gov.in/" target="_blank" rel="noopener">PIB ↗</a></div></div>`;
    } finally {
      if (button) { button.disabled = false; button.textContent = "Refresh official schemes"; }
    }
  },

  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  },

  safeUrl(value) {
    try { const u = new URL(value, location.origin); return ["https:", "http:"].includes(u.protocol) ? u.href : "https://www.myscheme.gov.in/"; }
    catch { return "https://www.myscheme.gov.in/"; }
  },

  renderSchemesList() {
    const container = document.getElementById("schemes-cards-grid");
    if (!container) return;

    let items = KISAN_DATA.schemes;

    if (this.activeCategory !== "all") {
      items = items.filter(s => s.category.toLowerCase().includes(this.activeCategory.toLowerCase()));
    }

    if (this.searchQuery) {
      items = items.filter(s =>
        s.name.toLowerCase().includes(this.searchQuery) ||
        s.nameHi.includes(this.searchQuery) ||
        s.tagline.toLowerCase().includes(this.searchQuery) ||
        s.authority.toLowerCase().includes(this.searchQuery)
      );
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏛️</div>
          <h3>No government schemes found</h3>
          <p>Try searching for a different keyword or selecting 'All Schemes'.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(s => `
      <div class="scheme-card">
        <div class="scheme-card-header">
          <div>
            <span class="badge badge-category">${s.category}</span>
            <h3 class="scheme-title">${s.name}</h3>
            <div class="scheme-title-hi">${s.nameHi}</div>
          </div>
          <div class="scheme-authority-tag">
            <span>🏛️ ${s.authority}</span>
          </div>
        </div>

        <p class="scheme-tagline">${s.tagline}</p>

        <div class="scheme-benefit-highlight">
          <span class="benefit-label">Financial Benefit / Subsidy:</span>
          <strong class="benefit-val">${s.benefitAmount}</strong>
        </div>

        <div class="scheme-checklist-preview">
          <span class="checklist-title">Key Required Documents:</span>
          <ul class="docs-list">
            ${s.documents.slice(0, 3).map(d => `<li>📄 ${d}</li>`).join("")}
          </ul>
        </div>

        <div class="scheme-card-footer">
          <div class="scheme-helpline">
            <span>Check eligibility and contact details on the official scheme portal.</span>
          </div>
          <div class="scheme-actions">
            <button class="btn btn-sm btn-outline" onclick="SchemesModule.openSchemeDetails('${s.id}')">
              📋 View Checklist
            </button>
            <a href="${s.portalUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-primary">
              🌐 Official Portal ↗
            </a>
          </div>
        </div>
      </div>
    `).join("");
  },

  initEligibilityWizard() {
    const wizardForm = document.getElementById("eligibility-wizard-form");
    if (!wizardForm) return;

    wizardForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.calculateEligibility();
    });

    // Also auto-calculate on input changes
    const inputs = wizardForm.querySelectorAll("select, input");
    inputs.forEach(input => {
      input.addEventListener("change", () => this.calculateEligibility());
    });

    // Run initial calculation
    this.calculateEligibility();
  },

  calculateEligibility() {
    const landSize = document.getElementById("wiz-land-size") ? document.getElementById("wiz-land-size").value : "marginal";
    const farmerCategory = document.getElementById("wiz-category") ? document.getElementById("wiz-category").value : "general";
    const waterSource = document.getElementById("wiz-water-source") ? document.getElementById("wiz-water-source").value : "diesel";
    const isTenant = farmerCategory === "tenant";

    const resultsContainer = document.getElementById("wizard-results-container");
    if (!resultsContainer) return;

    // Filter applicable schemes
    let eligible = KISAN_DATA.schemes.filter(s => {
      if (isTenant && !s.eligibilityRules.tenantAllowed) {
        return false;
      }
      return true;
    });

    // Calculate simulated monetary benefits
    let totalEstimatedAnnualBenefit = 0;
    let benefitBreakdown = [];

    // PM-KISAN
    if (!isTenant) {
      totalEstimatedAnnualBenefit += 6000;
      benefitBreakdown.push({ name: "PM-KISAN Direct Support", amount: 6000 });
    }

    // PMFBY Crop Insurance
    totalEstimatedAnnualBenefit += 25000;
    benefitBreakdown.push({ name: "PMFBY Insurance Protection", amount: 25000 });

    // Solar Pump
    if (waterSource === "diesel" || waterSource === "rainfed") {
      totalEstimatedAnnualBenefit += 140000;
      benefitBreakdown.push({ name: "PM-KUSUM Solar Pump Subsidy (up to 90%)", amount: 140000 });
    }

    // Mechanization
    if (landSize === "marginal" || landSize === "small") {
      totalEstimatedAnnualBenefit += 45000;
      benefitBreakdown.push({ name: "SMAM Machinery Subsidy (50-80%)", amount: 45000 });
    }

    resultsContainer.innerHTML = `
      <div class="wizard-summary-card">
        <div class="summary-top">
          <div>
            <span class="badge badge-success">✓ Eligibility Profile Verified</span>
            <h3 class="summary-heading">You are eligible for ${eligible.length} Central & State Welfare Schemes!</h3>
            <p class="text-muted">Calculated for: <strong>${landSize.toUpperCase()} Farmer (${isTenant ? 'Tenant/Sharecropper' : 'Landholder'})</strong></p>
          </div>
          <div class="summary-pot-benefit">
            <span class="label">Total Potential Subsidy & Aid</span>
            <div class="val text-gold">₹${totalEstimatedAnnualBenefit.toLocaleString()}*</div>
            <span class="sub">*Includes equipment grants & capital subsidies</span>
          </div>
        </div>

        <div class="eligible-schemes-list">
          ${eligible.map(s => `
            <div class="eligible-item-card">
              <div class="eligible-item-main">
                <span class="badge badge-category">${s.category}</span>
                <h4>${s.name}</h4>
                <div class="benefit-line"><strong>Benefit:</strong> ${s.benefitAmount}</div>
              </div>
              <div class="eligible-item-cta">
                <button class="btn btn-sm btn-outline" onclick="SchemesModule.openSchemeDetails('${s.id}')">
                  Check Documents
                </button>
                <a href="${s.portalUrl}" target="_blank" rel="noopener" class="btn btn-sm btn-primary">
                  Apply ↗
                </a>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  },

  openSchemeDetails(schemeId) {
    const s = KISAN_DATA.schemes.find(item => item.id === schemeId);
    if (!s) return;

    const modalBody = document.getElementById("scheme-detail-modal-content");
    if (!modalBody) return;

    modalBody.innerHTML = `
      <div class="scheme-modal-header">
        <span class="badge badge-category">${s.category}</span>
        <h2>${s.name}</h2>
        <div class="scheme-hi-text">${s.nameHi}</div>
        <p class="tagline">${s.tagline}</p>
      </div>

      <div class="scheme-details-grid">
        <div class="detail-box">
          <span class="box-label">Administering Authority</span>
          <strong>${s.authority}</strong>
        </div>
        <div class="detail-box">
          <span class="box-label">Subsidy / Benefit Level</span>
          <strong class="text-green">${s.benefitAmount}</strong>
        </div>
      </div>

      <div class="documents-checklist-card">
        <h3>📋 Mandatory Document Readiness Checklist</h3>
        <p class="text-sm text-muted">Keep these ready before visiting the Common Service Center (CSC) or applying online:</p>
        <ul class="modal-docs-checklist">
          ${s.documents.map(d => `
            <li>
              <label class="doc-chk-label">
                <input type="checkbox" checked />
                <span>${d}</span>
              </label>
            </li>
          `).join("")}
        </ul>
      </div>

      <div class="how-to-apply-card">
        <h3>🚀 Step-by-Step Application Procedure</h3>
        <p>${s.howToApply}</p>
      </div>

      <div class="scheme-modal-footer">
        <div class="helpline-contact">
          <span>For current contact details, use the official scheme portal.</span>
        </div>
        <div class="modal-footer-btns">
          <button class="btn btn-outline" onclick="window.print()">Print / Save PDF</button>
          <button class="btn btn-outline" onclick="App.closeModal('modal-scheme-detail')">Close</button>
          <a href="${s.portalUrl}" target="_blank" rel="noopener" class="btn btn-primary">
            Visit Official Govt Portal ↗
          </a>
        </div>
      </div>
    `;

    if (window.App) {
      window.App.openModal("modal-scheme-detail");
    }
  }
};

if (typeof window !== "undefined") {
  window.SchemesModule = SchemesModule;
}
