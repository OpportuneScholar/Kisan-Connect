/**
 * Kisan Connect - Yantra Sahay (Custom Hiring & Machinery Pooling)
 * "Uber for Farm Equipment" - Connects small & marginal farmers to affordable
 * tractors, harvesters, drone sprayers, and implements with community pooling discounts.
 */

const MachineryModule = {
  activeCategory: "all",
  searchQuery: "",
  maxDistance: 20,

  init() {
    this.renderMachineryList();
    this.setupListeners();
    this.initPoolingCalculator();
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
