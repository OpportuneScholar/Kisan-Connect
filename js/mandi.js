/**
 * Kisan Connect - Kisan Mandi Module
 * Sample APMC price filtering, MSP reference comparison, direct farmer-to-buyer listings,
 * and price trend visualization.
 */

const MandiModule = {
  activeCategory: "all",
  activeState: "all",
  searchQuery: "",
  userListings: [],

  init() {
    this.loadUserListings();
    this.renderCommodities();
    this.setupListeners();
    this.renderMSPWatchdog();
    this.setupLiveDataListeners();
    this.loadLivePrices();
  },

  async loadUserListings() {
    const sampleListings = [
      {
        id: "sample-list-1", farmerName: "Harpreet Singh", phone: "", crop: "Wheat (Lokwan Grade A)",
        quantity: 45, unit: "Quintals", price: 2450, location: "Moga Mandi Yard, Punjab", date: "Sample",
        organic: false, notes: "Sample listing for demonstration. Confirm quality and availability directly with the seller.",
        audience: "bulk", sample: true
      },
      {
        id: "sample-list-2", farmerName: "Savita Devi (Shree FPO)", phone: "", crop: "Finger Millet (Ragi)",
        quantity: 20, unit: "Quintals", price: 4300, location: "Mandya Organic Hub, Karnataka", date: "Sample",
        organic: true, notes: "Sample listing for demonstration. Certification and availability are not verified.",
        audience: "both", sample: true
      }
    ];
    this.userListings = sampleListings;
    try {
      const response = await fetch("/api/marketplace/listings", { credentials: "same-origin" });
      if (response.ok) {
        const data = await response.json();
        this.userListings = [...(data.items || []), ...sampleListings];
      }
    } catch (_) {
      // Sample listings remain available when the API cannot be reached.
    }
    this.renderUserListings();
  },

  async saveUserListing(newListing) {
    try {
      const response = await fetch("/api/marketplace/listings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newListing)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not publish listing.");
      this.userListings.unshift(data.item);
      this.renderUserListings();
      if (window.App) window.App.showToast("Produce listing published and saved to the server.");
      return true;
    } catch (error) {
      if (window.App) window.App.showToast(error.message || "Could not connect to the server.");
      return false;
    }
  },

  escapeHTML(value) {
    return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  },

  setupListeners() {
    // Search input
    const searchInput = document.getElementById("mandi-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderCommodities();
      });
    }

    // Category filter pills
    const categoryBtns = document.querySelectorAll(".mandi-category-btn");
    categoryBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        categoryBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeCategory = btn.dataset.category || "all";
        this.renderCommodities();
      });
    });

    // State filter dropdown
    const stateFilter = document.getElementById("mandi-state-filter");
    if (stateFilter) {
      stateFilter.addEventListener("change", (e) => {
        this.activeState = e.target.value;
        this.renderCommodities();
      });
    }

    // Modal submit for listing harvest
    const listHarvestForm = document.getElementById("list-harvest-form");
    if (listHarvestForm) {
      listHarvestForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!window.Auth || !(await window.Auth.ensureRole("farmer", "Log in as a farmer to publish produce."))) return;
        const newListing = {
          farmerName: window.Auth.currentUser.name,
          phone: document.getElementById("harvest-phone").value.trim(),
          crop: document.getElementById("harvest-crop-name").value.trim(),
          quantity: Number(document.getElementById("harvest-qty").value),
          price: Number(document.getElementById("harvest-price").value),
          location: document.getElementById("harvest-location").value.trim(),
          organic: document.getElementById("harvest-organic").checked,
          notes: document.getElementById("harvest-notes").value.trim(),
          audience: document.getElementById("harvest-audience")?.value || "both"
        };
        const saved = await this.saveUserListing(newListing);
        if (saved) {
          listHarvestForm.reset();
          if (window.App) window.App.closeModal("modal-list-harvest");
        }
      });
    }
  },

  async initIndiaLocationControls() {
    const stateSelect = document.getElementById("live-mandi-state");
    const districtSelect = document.getElementById("live-mandi-district");
    if (!stateSelect || !districtSelect) return;
    try {
      const response = await fetch("/data/india_states_districts.json", { cache: "force-cache" });
      if (!response.ok) throw new Error("Location list unavailable");
      this.indiaAdminDivisions = await response.json();
      const reportState = document.getElementById("report-mandi-state");
      const reportDistrict = document.getElementById("report-mandi-district");
      const reportMarket = document.getElementById("report-mandi-market");
      const reportCommodity = document.getElementById("report-mandi-commodity");
      const populateStates = select => {
        if (!select) return;
        select.replaceChildren(new Option("Select state / UT", ""));
        this.indiaAdminDivisions.forEach(state => select.add(new Option(state.name, state.name)));
      };
      populateStates(stateSelect);
      populateStates(reportState);
      const populateDistricts = (select, stateName) => {
        if (!select) return;
        const state = this.indiaAdminDivisions.find(item => item.name === stateName);
        select.replaceChildren(new Option(state ? "Select district" : "Select state first", ""));
        (state?.districts || []).forEach(district => select.add(new Option(district.name, district.name)));
        select.disabled = !state;
      };
      const resetMarkets = () => {
        const liveMarket = document.getElementById("live-mandi-market");
        if (liveMarket) liveMarket.replaceChildren(new Option("Loading official markets…", ""));
        if (reportMarket) reportMarket.value = "";
        const options = document.getElementById("report-mandi-market-options");
        if (options) options.replaceChildren();
      };
      const syncReportFromLive = () => {
        if (reportState) reportState.value = stateSelect.value;
        populateDistricts(reportDistrict, stateSelect.value);
        if (reportDistrict) reportDistrict.value = districtSelect.value;
      };
      const syncLiveFromReport = () => {
        stateSelect.value = reportState?.value || "";
        populateDistricts(districtSelect, stateSelect.value);
        districtSelect.value = reportDistrict?.value || "";
      };
      stateSelect.addEventListener("change", () => {
        populateDistricts(districtSelect, stateSelect.value);
        if (reportState) reportState.value = stateSelect.value;
        populateDistricts(reportDistrict, stateSelect.value);
        resetMarkets();
        this.loadMandiMarkets();
      });
      districtSelect.addEventListener("change", () => {
        if (reportDistrict) reportDistrict.value = districtSelect.value;
        resetMarkets();
        this.loadMandiMarkets();
      });
      reportState?.addEventListener("change", () => {
        populateDistricts(reportDistrict, reportState.value);
        syncLiveFromReport();
        resetMarkets();
        this.loadMandiMarkets();
      });
      reportDistrict?.addEventListener("change", () => {
        syncLiveFromReport();
        resetMarkets();
        this.loadMandiMarkets();
      });
      // Load suggestions once on focus; the browser filters the datalist as the user types.
      reportMarket?.addEventListener("focus", () => this.loadMandiMarkets(""));
      reportCommodity?.addEventListener("change", () => {
        const liveCommodity = document.getElementById("live-mandi-commodity");
        if (liveCommodity && reportCommodity.value) liveCommodity.value = reportCommodity.value;
      });
      syncReportFromLive();
    } catch (_) {
      stateSelect.innerHTML = '<option value="">Location list unavailable — reload to retry</option>';
      if (window.App) window.App.showToast("Could not load India state/district data. Check your internet connection and retry.");
    }
  },

  async loadMandiMarkets(query = "") {
    const state = document.getElementById("live-mandi-state")?.value || "";
    const district = document.getElementById("live-mandi-district")?.value || "";
    const liveSelect = document.getElementById("live-mandi-market");
    const reportInput = document.getElementById("report-mandi-market");
    const datalist = document.getElementById("report-mandi-market-options");
    if (!state || !district) {
      liveSelect?.replaceChildren(new Option("Choose state and district first", ""));
      if (datalist) datalist.replaceChildren();
      return;
    }
    try {
      const params = new URLSearchParams({ state, district });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch("/api/mandi/markets?" + params, { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not load market names.");
      const names = data.items || [];
      if (liveSelect) {
        const selected = liveSelect.value;
        liveSelect.replaceChildren(new Option(names.length ? "Select official mandi" : "No official markets found", ""), ...names.map(name => new Option(name, name)));
        if (names.includes(selected)) liveSelect.value = selected;
      }
      if (datalist) datalist.replaceChildren(...(data.suggestions || []).map(name => new Option(name, name)));
      if (reportInput && query && datalist && !datalist.options.length) reportInput.value = query;
    } catch (_) {
      const status = document.getElementById("mandi-source-status");
      if (status) { status.textContent = "Official market feed unavailable"; status.className = "badge badge-neutral"; }
    }
  },

  async detectMandiLocation() {
    const button = document.getElementById("btn-detect-mandi-location");
    const stateSelect = document.getElementById("live-mandi-state");
    const districtSelect = document.getElementById("live-mandi-district");
    const status = document.getElementById("mandi-source-status");
    const setStatus = message => { if (status) status.textContent = message; };
    if (!navigator.geolocation) {
      setStatus("Location is not supported by this browser. Select state and district manually.");
      return;
    }
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      setStatus("Location detection requires HTTPS. Select state and district manually.");
      return;
    }
    const original = button?.textContent || "📍 Detect location";
    if (button) { button.disabled = true; button.textContent = "Detecting…"; }
    setStatus("Allow location permission to find your state and district…");
    try {
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, timeout: 15000, maximumAge: 300000
      }));
      const { latitude, longitude } = position.coords;
      let place;
      try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`, { signal: AbortSignal.timeout(9000) });
        if (!response.ok) throw new Error("Reverse geocoder unavailable");
        place = await response.json();
      } catch (_) {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=en`, { signal: AbortSignal.timeout(9000) });
        if (!response.ok) throw new Error("Could not look up this location");
        const result = await response.json();
        const address = result.address || {};
        place = { locality: address.village || address.town || address.city || address.suburb || "", principalSubdivision: address.state || "", district: address.county || address.state_district || "" };
      }
      const administrative = place.localityInfo?.administrative || [];
      let stateName = place.principalSubdivision || place.state || "";
      let districtName = place.district || administrative.find(item => /district|county/i.test(item.description || ""))?.name || "";
      let locality = place.locality || place.city || "";
      if (!districtName) {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=en`, { signal: AbortSignal.timeout(9000) });
          if (response.ok) {
            const address = (await response.json()).address || {};
            districtName = address.county || address.state_district || "";
            stateName = stateName || address.state || "";
            locality = locality || address.village || address.town || address.city || address.suburb || "";
          }
        } catch (_) {
          // Keep the primary reverse-geocoding result and allow manual selection.
        }
      }
      if (!stateName) throw new Error("Could not identify your state. Please select it manually.");
      const state = (this.indiaAdminDivisions || []).find(item => item.name.toLowerCase() === stateName.toLowerCase() || item.name.toLowerCase().includes(stateName.toLowerCase()));
      if (!state) throw new Error(`Detected state: ${stateName}. Please select it manually from the list.`);
      stateSelect.value = state.name;
      stateSelect.dispatchEvent(new Event("change", { bubbles: true }));
      const district = (state.districts || []).find(item => item.name.toLowerCase() === districtName.toLowerCase() || item.name.toLowerCase().includes(districtName.toLowerCase()) || districtName.toLowerCase().includes(item.name.toLowerCase()));
      if (district) districtSelect.value = district.name;
      else if (districtName) { districtSelect.add(new Option(districtName, districtName)); districtSelect.value = districtName; }
      districtSelect.dispatchEvent(new Event("change", { bubbles: true }));
      setStatus(`Detected: ${[locality, districtName || district?.name, state.name].filter(Boolean).join(", ")}. Select a crop and choose a mandi from available suggestions.`);
      await this.loadLivePrices();
    } catch (error) {
      const message = error.code === 1 ? "Location permission was denied." : error.code === 3 ? "Location detection timed out." : (error.message || "Location detection failed.");
      setStatus(`${message} You can select state and district manually.`);
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
  },

  setupLiveDataListeners() {
    this.initIndiaLocationControls();
    document.getElementById("btn-load-live-mandi")?.addEventListener("click", () => this.loadLivePrices());
    document.getElementById("btn-detect-mandi-location")?.addEventListener("click", () => this.detectMandiLocation());
    document.getElementById("mandi-price-report-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!window.Auth || !(await window.Auth.ensureRole(["farmer", "bulkBuyer", "localBuyer"], "Log in to submit a community mandi price report."))) return;
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form).entries());
      values.pricePerQuintal = Number(values.pricePerQuintal);
      if (!values.market || values.market.trim().length < 2 || !values.state || !values.district) {
        if (window.App) window.App.showToast("Choose state and district, then select a suggested mandi or type a local mandi name.");
        return;
      }
      try {
        const response = await fetch("/api/mandi/reports", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Could not submit this report.");
        if (window.App) window.App.showToast(data.message || "Price report submitted.");
        form.querySelector("#report-mandi-commodity").value = "";
        form.querySelector("#report-mandi-market").value = "";
        form.querySelector('[name="pricePerQuintal"]').value = "";
        form.querySelector('[name="note"]').value = "";
        await this.loadMandiMarkets("");
        await this.loadLivePrices();
      } catch (error) {
        if (window.App) window.App.showToast(error.message || "Could not connect to the server.");
      }
    });
  },

  async loadLivePrices() {
    const results = document.getElementById("live-mandi-results");
    const status = document.getElementById("mandi-source-status");
    if (!results) return;
    const params = new URLSearchParams();
    for (const [field, id] of [["commodity", "live-mandi-commodity"], ["state", "live-mandi-state"], ["district", "live-mandi-district"], ["market", "live-mandi-market"]]) {
      const raw = document.getElementById(id)?.value || "";
      const value = raw.trim();
      if (value) params.set(field, value);
    }
    results.innerHTML = '<p class="text-sm text-muted">Loading market data…</p>';
    try {
      const response = await fetch(`/api/mandi/prices?${params.toString()}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Market data is temporarily unavailable.");
      if (status) {
        status.textContent = data.mode === "official" ? "Official government data" : (data.officialStatus === "temporarily_unavailable" ? "Government feed unavailable" : "Community reports only");
        status.className = `badge ${data.mode === "official" ? "badge-success" : "badge-neutral"}`;
      }

      if (!data.items || !data.items.length) {
        const setupHint = data.officialStatus === "not_configured"
          ? ' <a href="https://data.gov.in/" target="_blank" rel="noopener">Get a data.gov.in API key</a> and add it to the server environment.'
          : data.officialStatus === "temporarily_unavailable"
            ? " The official feed is configured but is temporarily unavailable; please retry later."
            : " Try clearing the mandi name or changing the crop/district to find matching official records.";
        results.innerHTML = `<p class="text-sm text-muted">${this.escapeHTML(data.message || "No recent records found for these filters.")}</p><p class="live-data-source-note">${setupHint}</p>`;
        return;
      }
      const official = data.mode === "official";
      results.innerHTML = `<div class="live-data-results-grid">${data.items.map(item => {
        const title = this.escapeHTML(item.commodity || "Crop");
        const location = this.escapeHTML([item.market, item.district, item.state].filter(Boolean).join(", "));
        const price = official ? item.modalPrice : item.averagePrice;
        const priceLabel = official ? "Modal wholesale price" : "Reported average";
        const range = official ? `Min ₹${Number(item.minPrice).toLocaleString("en-IN")} · Max ₹${Number(item.maxPrice).toLocaleString("en-IN")}` : `Reported range ₹${Number(item.minReportedPrice).toLocaleString("en-IN")}–₹${Number(item.maxReportedPrice).toLocaleString("en-IN")}`;
        const date = official ? (item.arrivalDate || "Date not supplied") : `${Number(item.reportCount)} reports · last ${this.escapeHTML(item.lastReportedAt || "recently")}`;
        return `<article class="live-price-item"><h4>${title}</h4><p>${location || "Market location not supplied"}</p><p>${priceLabel}</p><div class="live-price-main">₹${Number(price).toLocaleString("en-IN")} / qtl</div><p>${range}</p><p>${official ? "Arrival date: " : ""}${this.escapeHTML(date)}</p><span class="badge ${official ? "badge-success" : "badge-neutral"}">${official ? "Government source" : "Community reported"}</span></article>`;
      }).join("")}</div><p class="live-data-source-note">${this.escapeHTML(data.message || "")} Source: ${this.escapeHTML(data.source || "Unknown")}. ${official ? '<a href="https://data.gov.in/" target="_blank" rel="noopener">Source portal</a>' : "Community reports are not official or independently verified."}</p>`;
    } catch (error) {
      if (status) { status.textContent = "Data unavailable"; status.className = "badge badge-neutral"; }
      results.innerHTML = `<p class="text-sm text-muted">${this.escapeHTML(error.message || "Could not load mandi rates.")}</p>`;
    }
  },

  renderMSPWatchdog() {
    const watchdogContainer = document.getElementById("msp-watchdog-banner");
    if (!watchdogContainer) return;

    const commodities = KISAN_DATA.commodities.filter(c => c.msp);
    const belowMSP = commodities.filter(c => c.modalPrice < c.msp);

    if (belowMSP.length > 0) {
      const itemsList = belowMSP.map(c => `
        <span class="msp-alert-pill">
          ⚠️ <strong>${c.name}</strong>: Mandi ₹${c.modalPrice} vs Govt MSP ₹${c.msp} (Deficit: -₹${c.msp - c.modalPrice}/Qtl)
        </span>
      `).join(" ");

      watchdogContainer.innerHTML = `
        <div class="msp-alert-banner">
          <div class="msp-alert-header">
            <span class="msp-badge-danger">MSP WARNING</span>
            <span class="msp-alert-title">Sample price comparison only — verify procurement availability locally:</span>
          </div>
          <div class="msp-alert-content">${itemsList}</div>
          <div class="msp-alert-footer">
            <span>💡 Small farmers: Check current procurement rules and availability with your local agriculture office before deciding where to sell.</span>
            <a href="https://fci.gov.in" target="_blank" rel="noopener" class="btn-sm btn-outline">Find FCI Center</a>
          </div>
        </div>
      `;
    }
  },

  renderCommodities() {
    const container = document.getElementById("mandi-price-cards");
    if (!container) return;

    let items = KISAN_DATA.commodities;

    if (this.activeCategory !== "all") {
      items = items.filter(c => c.category.toLowerCase() === this.activeCategory.toLowerCase());
    }

    if (this.activeState !== "all") {
      items = items.filter(c => c.state.toLowerCase() === this.activeState.toLowerCase());
    }

    if (this.searchQuery) {
      items = items.filter(c =>
        c.name.toLowerCase().includes(this.searchQuery) ||
        c.nameHi.includes(this.searchQuery) ||
        c.primaryMandi.toLowerCase().includes(this.searchQuery) ||
        c.state.toLowerCase().includes(this.searchQuery)
      );
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌾</div>
          <h3>No crop prices found</h3>
          <p>Try adjusting your search filter or select another state.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(c => {
      const hasMsp = c.msp !== null;
      const isAboveMsp = hasMsp && c.modalPrice >= c.msp;
      const mspDiff = hasMsp ? c.modalPrice - c.msp : null;

      const mspBadge = hasMsp
        ? (isAboveMsp
            ? `<span class="badge badge-success" title="Mandi price is ₹${mspDiff} above minimum support price">✓ ₹${mspDiff} > MSP</span>`
            : `<span class="badge badge-danger" title="Mandi price is below MSP">⚠️ ₹${Math.abs(mspDiff)} Below MSP</span>`)
        : `<span class="badge badge-neutral">Market Driven</span>`;

      const trendIcon = c.trend === "up" ? "📈" : (c.trend === "down" ? "📉" : "⚖️");
      const trendColor = c.trend === "up" ? "text-green" : (c.trend === "down" ? "text-red" : "text-amber");

      return `
        <div class="commodity-card">
          <div class="commodity-card-header">
            <div>
              <div class="commodity-badges">
                <span class="badge badge-category">${c.category}</span>
                ${c.organicAvailable ? '<span class="badge badge-organic">🌱 Organic Demand</span>' : ''}
              </div>
              <h3 class="commodity-name">${c.name}</h3>
              <div class="commodity-name-hi">${c.nameHi}</div>
            </div>
            <div class="text-right">
              ${mspBadge}
            </div>
          </div>

          <div class="price-hero">
            <div class="price-val">₹${c.modalPrice.toLocaleString()}</div>
            <div class="price-unit">per Quintal (100 Kg)</div>
            <div class="price-trend ${trendColor}">
              ${trendIcon} ${c.changePercent} this week
            </div>
          </div>

          <div class="price-stats-grid">
            <div class="stat-cell">
              <span class="stat-label">Min Price</span>
              <span class="stat-val">₹${c.minPrice.toLocaleString()}</span>
            </div>
            <div class="stat-cell">
              <span class="stat-label">Max Price</span>
              <span class="stat-val">₹${c.maxPrice.toLocaleString()}</span>
            </div>
            <div class="stat-cell">
              <span class="stat-label">Govt MSP</span>
              <span class="stat-val">${hasMsp ? '₹' + c.msp.toLocaleString() : 'N/A'}</span>
            </div>
            <div class="stat-cell">
              <span class="stat-label">Today Arrivals</span>
              <span class="stat-val">${c.arrivalQty.toLocaleString()} Qtl</span>
            </div>
          </div>

          <div class="commodity-mandi-tag">
            <span class="icon">📍</span>
            <span>${c.primaryMandi}, ${c.state}</span>
          </div>

          <div class="commodity-actions">
            <button class="btn btn-sm btn-outline" onclick="MandiModule.openPriceChart('${c.id}')">
              📊 7-Day Trend
            </button>
            <button class="btn btn-sm btn-primary" onclick="MandiModule.openDirectBuyers('${c.id}')">
              🤝 Connect Buyers (${c.activeBuyers})
            </button>
          </div>
        </div>
      `;
    }).join("");

    this.renderUserListings();
  },

  renderUserListings() {
    const container = document.getElementById("direct-farmer-listings");
    if (!container) return;
    if (!this.userListings.length) {
      container.innerHTML = `<div class="empty-state-card"><p>No active produce listings yet.</p><button class="btn btn-sm btn-primary" onclick="App.openModal('modal-list-harvest')">List your produce</button></div>`;
      return;
    }
    container.innerHTML = this.userListings.map(item => {
      const e = value => this.escapeHTML(value);
      const phone = String(item.phone || "").replace(/[^0-9+]/g, "");
      const audience = item.audience === "local" ? "Local buyers" : item.audience === "bulk" ? "Bulk buyers / traders" : "Local and bulk buyers";
      const sellerActions = item.sample
        ? '<span class="text-sm text-muted">Contact disabled for sample listing</span>'
        : `<a href="tel:${e(phone)}" class="btn btn-sm btn-outline">Call seller</a><button type="button" class="btn btn-sm btn-success" onclick="MandiModule.requestListing(${Number(item.listingId)})">Send enquiry</button>`;
      return `<div class="farmer-listing-card">
        <div class="farmer-listing-header"><div><span class="farmer-name">${e(item.farmerName)}</span><span class="farmer-location">${e(item.location)}</span>${item.sample ? '<span class="listing-demo-label">Sample listing</span>' : ''}</div>
        <div class="farmer-price-box"><div class="farmer-price">₹${Number(item.price).toLocaleString("en-IN")} / Qtl</div><span class="badge ${item.organic ? 'badge-organic' : 'badge-neutral'}">${item.organic ? 'Organic (seller stated)' : 'Conventional'}</span></div></div>
        <div class="farmer-listing-body"><div class="crop-title"><strong>${e(item.crop)}</strong> (${Number(item.quantity)} ${e(item.unit || "Quintals")} available)</div><p class="crop-notes">For: ${e(audience)}</p><p class="crop-notes">${e(item.notes || 'Contact the seller to confirm quality and availability.')}</p></div>
        <div class="farmer-listing-footer"><span class="post-time">Listed: ${e(item.date || "Recently")}</span><div class="farmer-cta-btns">${sellerActions}</div></div>
      </div>`;
    }).join("");
  },

  async loadIncomingEnquiries() {
    if (!window.Auth || !(await window.Auth.ensureRole(["farmer", "admin"]))) return;
    const container = document.getElementById("incoming-enquiries");
    if (!container) return;
    container.hidden = false;
    container.innerHTML = '<p class="text-sm text-muted">Loading enquiries…</p>';
    try {
      const response = await fetch("/api/marketplace/enquiries/incoming", { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not load enquiries.");
      if (!data.items || !data.items.length) {
        container.innerHTML = '<p class="text-sm text-muted">No purchase enquiries have arrived yet.</p>';
        return;
      }
      container.innerHTML = `<h3>Incoming purchase enquiries</h3>` + data.items.map(item => {
        const e = value => this.escapeHTML(value);
        const actions = item.status === "new" ? `<button class="btn btn-sm btn-outline" onclick="MandiModule.updateEnquiry(${Number(item.id)}, 'contacted')">Mark contacted</button><button class="btn btn-sm btn-outline" onclick="MandiModule.updateEnquiry(${Number(item.id)}, 'declined')">Decline</button>` : "";
        return `<article class="incoming-enquiry-row"><div><strong>${e(item.crop)}</strong><p>${e(item.buyerName)} · ${Number(item.quantity)} quintals</p><p>${e(item.message || "No message supplied")}</p></div><div><span class="badge badge-neutral">${e(item.status)}</span><div class="farmer-cta-btns">${actions}</div></div></article>`;
      }).join("");
    } catch (error) {
      container.innerHTML = `<p class="text-sm text-muted">${this.escapeHTML(error.message)}</p>`;
    }
  },

  async updateEnquiry(enquiryId, status) {
    try {
      const response = await fetch(`/api/marketplace/enquiries/${enquiryId}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not update enquiry.");
      window.App.showToast(`Enquiry marked ${status}.`);
      await this.loadIncomingEnquiries();
    } catch (error) {
      window.App.showToast(error.message || "Could not update enquiry.");
    }
  },

  async requestListing(listingId) {
    if (!Number.isInteger(listingId) || listingId < 1) return;
    if (!window.Auth || !(await window.Auth.ensureRole(["localBuyer", "bulkBuyer"], "Log in as a buyer to send a purchase enquiry."))) return;
    const quantity = Number(window.prompt("How many quintals would you like to enquire about?", "1"));
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const message = window.prompt("Message for the farmer (optional):", "I am interested in this produce.") || "";
    try {
      const response = await fetch(`/api/marketplace/listings/${listingId}/enquiries`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, message })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not send enquiry.");
      window.App.showToast(data.message || "Purchase enquiry sent.");
    } catch (error) {
      window.App.showToast(error.message || "Could not connect to the server.");
    }
  },

  openPriceChart(commodityId) {
    const item = KISAN_DATA.commodities.find(c => c.id === commodityId);
    if (!item) return;

    const modalBody = document.getElementById("price-chart-modal-content");
    if (!modalBody) return;

    const history = item.history;
    const minVal = Math.min(...history);
    const maxVal = Math.max(...history);
    const range = maxVal - minVal || 1;

    // Generate responsive SVG chart points
    const width = 500;
    const height = 180;
    const padding = 35;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const points = history.map((val, idx) => {
      const x = padding + (idx / (history.length - 1)) * chartW;
      const y = height - padding - ((val - minVal) / range) * chartH;
      return { x, y, val };
    });

    const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    const dayLabels = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Today"];

    const svgChart = `
      <svg viewBox="0 0 ${width} ${height}" class="price-trend-svg" width="100%" height="200">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2D6A4F" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#2D6A4F" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <!-- Grid lines -->
        <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="#E5E7EB" stroke-dasharray="3,3" />
        <line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" stroke="#E5E7EB" stroke-dasharray="3,3" />
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#E5E7EB" stroke-dasharray="3,3" />

        <!-- Area fill -->
        <path d="${areaD}" fill="url(#chartGrad)"></path>

        <!-- Price line -->
        <path d="${pathD}" fill="none" stroke="#2D6A4F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>

        <!-- Data points -->
        ${points.map((p, idx) => `
          <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#1B4332" stroke="#FFFFFF" stroke-width="2"/>
          <text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-size="11" font-weight="600" fill="#1B4332">₹${p.val}</text>
          <text x="${p.x}" y="${height - padding + 16}" text-anchor="middle" font-size="10" fill="#6B7280">${dayLabels[idx]}</text>
        `).join("")}
      </svg>
    `;

    modalBody.innerHTML = `
      <div class="chart-header">
        <div>
          <h3>${item.name} (${item.nameHi})</h3>
          <p class="text-muted">7-Day Modal Price Trajectory in ${item.primaryMandi}, ${item.state}</p>
        </div>
        <div class="chart-cur-price">
          <span class="label">Current Price</span>
          <span class="value">₹${item.modalPrice} / Qtl</span>
          <span class="badge ${item.trend === 'up' ? 'badge-success' : 'badge-danger'}">${item.changePercent} 7D Trend</span>
        </div>
      </div>

      <div class="chart-container">
        ${svgChart}
      </div>

      <div class="chart-summary-grid">
        <div class="summary-box">
          <div class="summary-label">7-Day Low</div>
          <div class="summary-val text-red">₹${minVal}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">7-Day High</div>
          <div class="summary-val text-green">₹${maxVal}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Govt MSP Benchmark</div>
          <div class="summary-val">${item.msp ? '₹' + item.msp : 'Not Applicable'}</div>
        </div>
        <div class="summary-box">
          <div class="summary-label">Mandi Market Volatility</div>
          <div class="summary-val">Low-Moderate</div>
        </div>
      </div>

      <div class="ai-price-advisory">
        <strong>💡 Kisan Connect Market Advisory:</strong>
        ${item.trend === 'up'
          ? `Demand is rising across APMC mandis. If you have clean, dry stock with low moisture, this is a favorable window to sell in lots of 25-50 quintals.`
          : `Prices are currently subdued due to peak seasonal harvest arrivals. If you have safe storage/warehouse facilities (Gramin Bhandaran), holding for 3-4 weeks could fetch 10-15% higher realisations.`
        }
      </div>
    `;

    if (window.App) {
      window.App.openModal("modal-price-chart");
    }
  },

  openDirectBuyers(commodityId) {
    const item = KISAN_DATA.commodities.find(c => c.id === commodityId);
    if (!item) return;

    const modalBody = document.getElementById("buyers-modal-content");
    if (!modalBody) return;

    const mockBuyers = [
      {
        name: "AgroFresh Processors Ltd.",
        type: "Food Processing Company",
        requiredQty: "100 - 500 Quintals",
        offeredPrice: `₹${item.modalPrice + 50} / Qtl`,
        paymentTerms: "100% Direct Bank Transfer within 24 hours of weighbridge",
        location: "Industrial Area, 18 km away",
        rating: "4.9 ★ (120 farmers supplied)"
      },
      {
        name: "Shree Kisan Producer Org (FPO)",
        type: "Farmer Producer Collective",
        requiredQty: "25 - 200 Quintals",
        offeredPrice: `₹${item.modalPrice + 30} / Qtl`,
        paymentTerms: "Spot weighment at village collection centre, immediate payment",
        location: "Block Mandi Center, 6 km away",
        rating: "5.0 ★ (450 member farmers)"
      },
      {
        name: "Kisan Direct Retail Network",
        type: "Direct-to-Consumer Agri Brand",
        requiredQty: "10 - 50 Quintals",
        offeredPrice: `₹${item.modalPrice + 80} / Qtl`,
        paymentTerms: "Cash / UPI on pickup from farm gate",
        location: "Metro City Hub",
        rating: "4.8 ★ (Organic & Clean Grain Preferred)"
      }
    ];

    modalBody.innerHTML = `
      <div class="buyers-header">
        <div>
          <h3>Verified Direct Buyers for ${item.name}</h3>
          <p class="text-muted">Zero Middlemen. Zero Brokerage. Direct Farm-Gate or Mandi Lifting.</p>
        </div>
        <span class="badge badge-success">✓ Verified Buyers</span>
      </div>

      <div class="buyers-list">
        ${mockBuyers.map(b => `
          <div class="buyer-card">
            <div class="buyer-card-top">
              <div>
                <h4 class="buyer-title">${b.name}</h4>
                <div class="buyer-type">${b.type} • 📍 ${b.location}</div>
              </div>
              <div class="buyer-rate">
                <span class="rate">${b.offeredPrice}</span>
                <span class="rate-sub">Offered Rate</span>
              </div>
            </div>

            <div class="buyer-specs">
              <div class="spec-item"><strong>Requirement:</strong> ${b.requiredQty}</div>
              <div class="spec-item"><strong>Payment Terms:</strong> ${b.paymentTerms}</div>
              <div class="spec-item"><strong>Reputation:</strong> ${b.rating}</div>
            </div>

            <div class="buyer-actions">
              <button class="btn btn-sm btn-outline" onclick="MandiModule.simulateContact('${b.name}', 'Call')">
                📞 Request Callback
              </button>
              <button class="btn btn-sm btn-success" onclick="MandiModule.simulateContact('${b.name}', 'WhatsApp')">
                💬 Connect via WhatsApp
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    if (window.App) {
      window.App.openModal("modal-buyers");
    }
  },

  simulateContact(buyerName, type) {
    if (window.App) {
      window.App.showToast(`Connecting with ${buyerName} via ${type}... A procurement executive will reach out to your registered mobile.`);
    }
  }
};

if (typeof window !== "undefined") {
  window.MandiModule = MandiModule;
}
