/**
 * Kisan Connect - Yantra Sahay (Custom Hiring & Machinery Pooling)
 * "Uber for Farm Equipment" - Connects small & marginal farmers to affordable
 * tractors, harvesters, drone sprayers, and implements with community pooling discounts.
 */

const MachineryModule = {
  activeCategory: "all",
  searchQuery: "",
  maxDistance: 20,

  communityListings: [],
  _communityListenersReady: false,

  escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  },

  async loadCommunityListings() {
    const status = document.getElementById("community-machinery-status");
    const container = document.getElementById("community-machinery-listings");
    if (!container) return;
    if (status) status.textContent = "Loading farmer-listed machines…";
    try {
      const response = await fetch("/api/machinery/listings", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not load farmer listings.");
      this.communityListings = data.items || [];
      this.renderCommunityListings();
      if (status) status.textContent = this.communityListings.length
        ? "Database listings from farmers"
        : "No farmer-listed machines yet. Farmers can publish the first listing.";
    } catch (_) {
      if (status) status.textContent = "Farmer listings could not be loaded. Please retry when the connection is available.";
    }
  },

  renderCommunityListings() {
    const container = document.getElementById("community-machinery-listings");
    if (!container) return;
    const query = (this.searchQuery || "").toLowerCase();
    const items = this.communityListings.filter(item =>
      (!query || [item.name, item.category, item.location, item.description, item.ownerName].some(value => String(value || "").toLowerCase().includes(query)))
    );
    if (!items.length) {
      container.innerHTML = '<p class="text-sm text-muted">No matching farmer listings found.</p>';
      return;
    }
    container.innerHTML = items.map(item => {
      const name = this.escapeHTML(item.name);
      const category = this.escapeHTML(item.category);
      const location = this.escapeHTML(item.location);
      const description = this.escapeHTML(item.description || "No additional details supplied.");
      const owner = this.escapeHTML(item.ownerName || "Registered farmer");
      const phone = this.escapeHTML(item.phone || "");
      const acreRate = Number(item.ratePerAcre) > 0 ? "₹" + Number(item.ratePerAcre).toLocaleString("en-IN") + " / acre" : "";
      const hourRate = Number(item.ratePerHour) > 0 ? "₹" + Number(item.ratePerHour).toLocaleString("en-IN") + " / hour" : "";
      const rates = [acreRate, hourRate].filter(Boolean).map(rate => "<strong>" + rate + "</strong>").join("");
      return '<article class="machine-card community-machine-card">' +
        '<div class="machine-badges"><span class="badge badge-category">' + category + '</span><span class="badge badge-neutral">Farmer listing</span></div>' +
        '<h3 class="machine-title">' + name + '</h3><p class="machine-desc">' + description + '</p>' +
        '<p class="text-sm text-muted">Location: ' + location + '</p><p class="text-sm text-muted">Owner: ' + owner + '</p>' +
        '<div class="community-machine-rates">' + rates + '</div>' +
        '<p class="text-sm text-muted">' + (item.operatorIncluded ? "Operator included" : "Operator not included") + ' · ' + (item.fuelIncluded ? "Fuel included" : "Fuel not included") + '</p>' +
        '<div class="machine-card-actions"><a class="btn btn-sm btn-outline" href="tel:' + phone + '">Contact owner</a>' +
        '<button type="button" class="btn btn-sm btn-primary" onclick="MachineryModule.openCommunityRental(' + Number(item.id) + ')">Request rental</button></div></article>';
    }).join("");
  },

  setupCommunityListingListeners() {
    if (this._communityListenersReady) return;
    this._communityListenersReady = true;
    document.getElementById("btn-list-machinery")?.addEventListener("click", async () => {
      if (!window.Auth || !(await window.Auth.ensureRole("farmer", "Log in as a farmer to list your machine."))) return;
      if (window.App) window.App.openModal("modal-list-machinery");
    });
    document.getElementById("machinery-listing-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!window.Auth || !(await window.Auth.ensureRole("farmer", "Log in as a farmer to list your machine."))) return;
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form).entries());
      values.ratePerAcre = Number(values.ratePerAcre || 0);
      values.ratePerHour = Number(values.ratePerHour || 0);
      values.operatorIncluded = document.getElementById("machine-list-operator").checked;
      values.fuelIncluded = document.getElementById("machine-list-fuel").checked;
      if (values.ratePerAcre <= 0 && values.ratePerHour <= 0) {
        if (window.App) window.App.showToast("Enter a rental rate per acre or per hour.");
        return;
      }
      const submit = document.getElementById("machine-list-submit");
      if (submit) { submit.disabled = true; submit.textContent = "Publishing…"; }
      try {
        const response = await fetch("/api/machinery/listings", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(values)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Could not publish the machine listing.");
        form.reset();
        if (window.App) { window.App.closeModal("modal-list-machinery"); window.App.showToast("Machine listing saved. Other users can now find it."); }
        await this.loadCommunityListings();
      } catch (error) {
        if (window.App) window.App.showToast(error.message || "Could not connect to the server.");
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = "Publish listing"; }
      }
    });
    document.getElementById("community-machinery-rent-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!window.Auth || !(await window.Auth.ensureRole(["farmer", "localBuyer", "bulkBuyer"], "Log in to request a machine rental."))) return;
      const form = event.currentTarget;
      const listingId = Number(document.getElementById("community-rental-listing-id").value);
      const values = Object.fromEntries(new FormData(form).entries());
      values.acres = Number(values.acres);
      try {
        const response = await fetch("/api/machinery/listings/" + listingId + "/rentals", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(values)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Could not send rental request.");
        form.reset();
        if (window.App) { window.App.closeModal("modal-rent-community-machine"); window.App.showToast(data.message || "Rental request sent."); }
      } catch (error) {
        if (window.App) window.App.showToast(error.message || "Could not connect to the server.");
      }
    });
  },

  openCommunityRental(listingId) {
    const item = this.communityListings.find(listing => Number(listing.id) === Number(listingId));
    if (!item) return;
    document.getElementById("community-rental-listing-id").value = item.id;
    document.getElementById("community-rental-machine-summary").innerHTML =
      '<div class="booking-summary-banner"><div><h4>' + this.escapeHTML(item.name) + '</h4><p class="text-sm text-muted">' +
      this.escapeHTML(item.location) + ' · Owner: ' + this.escapeHTML(item.ownerName) + '</p></div></div>';
    const dateInput = document.getElementById("community-rental-date");
    if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);
    if (window.App) window.App.openModal("modal-rent-community-machine");
  },

  init() {
    this.renderMachineryList();
    this.setupListeners();
    this.initPoolingCalculator();
    this.setupCommunityListingListeners();
    this.loadCommunityListings();
  },

  setupListeners() {
    // Category filter pills
    const categoryBtns = document.querySelectorAll(".machinery-category-btn");
    categoryBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        categoryBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeCategory = btn.dataset.category || "all";
        this.renderMachineryList();
      });
    });

    // Distance slider
    const distanceSlider = document.getElementById("machinery-distance-slider");
    const distanceVal = document.getElementById("machinery-distance-val");
    if (distanceSlider && distanceVal) {
      distanceSlider.addEventListener("input", (e) => {
        this.maxDistance = parseInt(e.target.value, 10);
        distanceVal.textContent = `${this.maxDistance} km`;
        this.renderMachineryList();
      });
    }

    // Search input
    const searchInput = document.getElementById("machinery-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderMachineryList();
        this.renderCommunityListings();
      });
    }

    // Booking form submit
    const bookingForm = document.getElementById("machinery-booking-form");
    if (bookingForm) {
      bookingForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleBookingSubmit();
      });
    }
  },

  renderMachineryList() {
    const container = document.getElementById("machinery-cards-grid");
    if (!container) return;

    let items = KISAN_DATA.machinery;

    if (this.activeCategory !== "all") {
      items = items.filter(m => m.category.toLowerCase() === this.activeCategory.toLowerCase());
    }

    items = items.filter(m => m.distanceKm <= this.maxDistance);

    if (this.searchQuery) {
      items = items.filter(m =>
        m.name.toLowerCase().includes(this.searchQuery) ||
        m.nameHi.includes(this.searchQuery) ||
        m.owner.toLowerCase().includes(this.searchQuery) ||
        m.location.toLowerCase().includes(this.searchQuery) ||
        m.description.toLowerCase().includes(this.searchQuery)
      );
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚜</div>
          <h3>No farm equipment found</h3>
          <p>Try widening your distance radius or selecting another category.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(m => `
      <div class="machine-card">
        <div class="machine-card-header">
          <div>
            <div class="machine-badges">
              <span class="badge badge-category">${m.category}</span>
              ${m.badge ? `<span class="badge badge-verified">${m.badge}</span>` : ''}
            </div>
            <h3 class="machine-title">${m.name}</h3>
            <div class="machine-title-hi">${m.nameHi}</div>
          </div>
          <div class="machine-rating">
            <span class="rating-star">⭐ ${m.rating}</span>
            <span class="reviews-count">(${m.reviewsCount})</span>
          </div>
        </div>

        <p class="machine-desc">${m.description}</p>

        <div class="machine-rate-box">
          <div class="rate-primary">
            <span class="currency">₹</span><span class="amt">${m.ratePerAcre}</span>
            <span class="unit">/ Acre</span>
          </div>
          <div class="rate-secondary">
            or ₹${m.ratePerHour}/hour
          </div>
        </div>

        <div class="machine-features-pills">
          <span class="pill-feat">📍 ${m.distanceKm} km away (${m.location})</span>
          <span class="pill-feat">${m.operatorIncluded ? '🧑‍✈️ Driver Included' : 'Self Operated'}</span>
          <span class="pill-feat">${m.fuelIncluded ? '⛽ Fuel Included' : 'Fuel by Farmer'}</span>
        </div>

        ${m.poolingAvailable ? `
          <div class="pooling-perk-banner">
            <span class="icon">🤝</span>
            <div>
              <strong>Community Pooling Available:</strong>
              <div class="perk-text">${m.poolingDiscountMax}</div>
            </div>
          </div>
        ` : ''}

        <div class="machine-owner-footer">
          <div class="owner-info">
            <span class="owner-label">Owner / CHC:</span>
            <strong class="owner-name">${m.owner}</strong>
          </div>
          <div class="machine-card-actions">
            <a href="tel:${m.phone}" class="btn btn-sm btn-outline">📞 Call</a>
            <button class="btn btn-sm btn-primary" onclick="MachineryModule.openBookingModal('${m.id}')">
              📅 Book Machine
            </button>
          </div>
        </div>
      </div>
    `).join("");
  },

  initPoolingCalculator() {
    const calcSection = document.getElementById("pooling-calculator-section");
    if (!calcSection) return;

    this.renderCalculatorOutput();

    const machineSelect = document.getElementById("pool-calc-machine");
    const acreageInput = document.getElementById("pool-calc-acres");
    const farmersInput = document.getElementById("pool-calc-farmers");

    if (machineSelect) machineSelect.addEventListener("change", () => this.renderCalculatorOutput());
    if (acreageInput) acreageInput.addEventListener("input", () => this.renderCalculatorOutput());
    if (farmersInput) farmersInput.addEventListener("input", () => this.renderCalculatorOutput());
  },

  renderCalculatorOutput() {
    const machineSelect = document.getElementById("pool-calc-machine");
    const acreageInput = document.getElementById("pool-calc-acres");
    const farmersInput = document.getElementById("pool-calc-farmers");
    const farmersVal = document.getElementById("pool-calc-farmers-val");

    if (!machineSelect || !acreageInput || !farmersInput) return;

    const machineId = machineSelect.value;
    const acresPerFarmer = parseFloat(acreageInput.value) || 1.5;
    const numFarmers = parseInt(farmersInput.value, 10) || 3;

    if (farmersVal) {
      farmersVal.textContent = `${numFarmers} Neighbor Farmers`;
    }

    const machine = KISAN_DATA.machinery.find(m => m.id === machineId) || KISAN_DATA.machinery[0];
    const baseRatePerAcre = machine.ratePerAcre;

    // Solo farming penalty: contractors charge transport surcharge for small plots under 2 acres
    const soloTransportSurcharge = 350; 
    const soloCostPerFarmer = (baseRatePerAcre * acresPerFarmer) + soloTransportSurcharge;

    // Pooled cluster discount:
    // When 2+ farmers pool contiguous fields, contractor gives bulk discount and shares transport cost
    let discountPercent = 0;
    if (numFarmers === 2) discountPercent = 0.15;
    else if (numFarmers === 3) discountPercent = 0.25;
    else if (numFarmers >= 4) discountPercent = 0.32;

    const pooledAcreRate = baseRatePerAcre * (1 - discountPercent);
    const sharedTransport = soloTransportSurcharge / numFarmers;
    const pooledCostPerFarmer = Math.round((pooledAcreRate * acresPerFarmer) + sharedTransport);

    const savingsPerFarmer = Math.round(soloCostPerFarmer - pooledCostPerFarmer);
    const totalClusterSavings = savingsPerFarmer * numFarmers;
    const percentSaved = Math.round((savingsPerFarmer / soloCostPerFarmer) * 100);

    const resultContainer = document.getElementById("pooling-calc-results");
    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="calc-metrics-grid">
          <div class="metric-card metric-solo">
            <span class="metric-title">Solo Booking (1 Farmer)</span>
            <div class="metric-val text-red">₹${soloCostPerFarmer.toLocaleString()}</div>
            <span class="metric-sub">Includes ₹${soloTransportSurcharge} small-plot surcharge</span>
          </div>

          <div class="metric-card metric-pooled">
            <span class="metric-title">Pooled Cost Per Farmer</span>
            <div class="metric-val text-green">₹${pooledCostPerFarmer.toLocaleString()}</div>
            <span class="metric-sub">${discountPercent * 100}% bulk rate + shared travel</span>
          </div>

          <div class="metric-card metric-savings">
            <span class="metric-title">Your Savings (${percentSaved}%)</span>
            <div class="metric-val text-gold">₹${savingsPerFarmer.toLocaleString()}</div>
            <span class="metric-sub">Pocketed per small farmer</span>
          </div>

          <div class="metric-card metric-total">
            <span class="metric-title">Total Village Cluster Savings</span>
            <div class="metric-val text-emerald">₹${totalClusterSavings.toLocaleString()}</div>
            <span class="metric-sub">Across all ${numFarmers} neighboring farms</span>
          </div>
        </div>

        <div class="calc-explanation">
          <strong>🌱 Why Pooling Transforms Smallholder Economics:</strong>
          Small & marginal plots (<2 acres) are often refused by heavy machine contractors or charged 30-40% extra for transit. By pooling contiguous acreage on Kisan Connect, machines work continuously without reloading, saving diesel and unlocking bulk institutional discounts for your entire village group!
        </div>
      `;
    }
  },

  openBookingModal(machineId) {
    const machine = KISAN_DATA.machinery.find(m => m.id === machineId);
    if (!machine) return;

    const modalBody = document.getElementById("booking-machine-details");
    const hiddenInput = document.getElementById("booking-machine-id");

    if (hiddenInput) hiddenInput.value = machine.id;

    if (modalBody) {
      modalBody.innerHTML = `
        <div class="booking-summary-banner">
          <div>
            <h4>${machine.name}</h4>
            <div class="text-muted">${machine.nameHi} • ${machine.category}</div>
            <div class="text-sm">📍 ${machine.location} (${machine.distanceKm} km away)</div>
          </div>
          <div class="booking-rate-badge">
            <div class="amt">₹${machine.ratePerAcre} / Acre</div>
            <div class="sub">or ₹${machine.ratePerHour}/hr</div>
          </div>
        </div>
      `;
    }

    if (window.App) {
      window.App.openModal("modal-booking");
    }
  },

  handleBookingSubmit() {
    const machineId = document.getElementById("booking-machine-id").value;
    const machine = KISAN_DATA.machinery.find(m => m.id === machineId) || KISAN_DATA.machinery[0];

    const farmerName = document.getElementById("book-farmer-name").value;
    const phone = document.getElementById("book-phone").value;
    const bookingDate = document.getElementById("book-date").value;
    const acres = parseFloat(document.getElementById("book-acres").value) || 2;
    const isPooling = document.getElementById("book-pooling-optin").checked;

    const discountMultiplier = isPooling ? 0.75 : 1.0;
    const estimatedTotal = Math.round(machine.ratePerAcre * acres * discountMultiplier);

    const bookingRef = "KC-YNT-" + Math.floor(100000 + Math.random() * 900000);

    const confirmationBody = document.getElementById("booking-slip-content");
    if (confirmationBody) {
      confirmationBody.innerHTML = `
        <div class="booking-slip">
          <div class="slip-header">
            <div class="slip-logo">🚜 Kisan Connect • Yantra Sahay</div>
            <span class="badge badge-success">Confirmed Booking Slip</span>
          </div>

          <div class="slip-ref-box">
            <span class="ref-label">Booking Reference Number:</span>
            <span class="ref-code">${bookingRef}</span>
          </div>

          <div class="slip-details-table">
            <div class="slip-row">
              <span>Farmer Name:</span>
              <strong>${farmerName} (${phone})</strong>
            </div>
            <div class="slip-row">
              <span>Equipment:</span>
              <strong>${machine.name}</strong>
            </div>
            <div class="slip-row">
              <span>Service Date:</span>
              <strong>${bookingDate}</strong>
            </div>
            <div class="slip-row">
              <span>Cultivation Area:</span>
              <strong>${acres} Acres</strong>
            </div>
            <div class="slip-row">
              <span>Community Pooling:</span>
              <strong>${isPooling ? '✅ Yes (25% Neighbor Cluster Discount Applied)' : '❌ Individual Booking'}</strong>
            </div>
            <div class="slip-row slip-total-row">
              <span>Estimated Rental Total:</span>
              <strong class="total-price">₹${estimatedTotal.toLocaleString()}</strong>
            </div>
          </div>

          <div class="slip-owner-callout">
            <div class="owner-icon">👨‍🌾</div>
            <div>
              <div class="text-sm">Equipment Owner / Operator Contact:</div>
              <strong>${machine.owner}</strong>
              <div><a href="tel:${machine.phone}" class="owner-phone-link">📞 ${machine.phone}</a></div>
            </div>
          </div>

          <div class="slip-footer-note">
            <span>ℹ️ Pay directly to equipment operator after completion of work on your field. An SMS confirmation with GPS tracking has been sent to ${phone}.</span>
          </div>

          <div class="slip-actions">
            <button class="btn btn-outline" onclick="window.print()">🖨️ Print Slip</button>
            <button class="btn btn-primary" onclick="App.closeModal('modal-booking-slip')">Done</button>
          </div>
        </div>
      `;
    }

    if (window.App) {
      window.App.closeModal("modal-booking");
      window.App.openModal("modal-booking-slip");
      window.App.showToast(`Booking ${bookingRef} created! Owner ${machine.owner} notified.`);
    }
  }
};

if (typeof window !== "undefined") {
  window.MachineryModule = MachineryModule;
}
