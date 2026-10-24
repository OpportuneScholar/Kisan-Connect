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
    this.initEligibilityWizard();
  },

  setupListeners() {
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
            <span>📞 Helpline: <strong>${s.helpline}</strong></span>
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
          <span>📞 Direct Scheme Helpline:</span>
          <strong>${s.helpline}</strong>
        </div>
        <div class="modal-footer-btns">
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
