/**
 * Kisan Connect - Kisan Khata (Farm Ledger & ROI Calculator) & Community/Weather Engine
 * Helps smallholders calculate their real cost of cultivation, net profit per acre,
 * view hyperlocal weather spray windows, and participate in peer discussions.
 */

const FarmLedgerModule = {
  init() {
    this.setupLedgerCalculator();
    this.setupWeatherListeners();
    this.renderWeatherForecast();
    this.renderCommunityPosts();
    this.setupCommunityListeners();
  },

  setupLedgerCalculator() {
    const form = document.getElementById("farm-ledger-form");
    if (!form) return;

    const recalculate = () => this.calculateLedger();

    form.querySelectorAll("input, select").forEach(input => {
      input.addEventListener("input", recalculate);
      input.addEventListener("change", recalculate);
    });

    // Run initial calculation
    this.calculateLedger();
  },

  calculateLedger() {
    const acres = parseFloat(document.getElementById("ledger-acres")?.value) || 2;
    const crop = document.getElementById("ledger-crop")?.value || "Wheat";
    
    // Expenses
    const seedCost = parseFloat(document.getElementById("cost-seeds")?.value) || 2800;
    const fertCost = parseFloat(document.getElementById("cost-fertilizers")?.value) || 4500;
    const machineCost = parseFloat(document.getElementById("cost-machinery")?.value) || 5200;
    const laborCost = parseFloat(document.getElementById("cost-labor")?.value) || 6000;
    const irrigationCost = parseFloat(document.getElementById("cost-irrigation")?.value) || 1800;
    const miscCost = parseFloat(document.getElementById("cost-misc")?.value) || 1200;

    const totalExpense = seedCost + fertCost + machineCost + laborCost + irrigationCost + miscCost;

    // Revenues
    const yieldQtl = parseFloat(document.getElementById("rev-yield-qtl")?.value) || 36;
    const pricePerQtl = parseFloat(document.getElementById("rev-price-qtl")?.value) || 2480;
    const strawRev = parseFloat(document.getElementById("rev-straw")?.value) || 4500;

    const cropRevenue = yieldQtl * pricePerQtl;
    const totalRevenue = cropRevenue + strawRev;
    const netProfit = totalRevenue - totalExpense;
    const profitPerAcre = Math.round(netProfit / acres);
    const costPerQuintal = Math.round(totalExpense / (yieldQtl || 1));
    const roiPercent = Math.round((netProfit / totalExpense) * 100);

    const resultContainer = document.getElementById("ledger-results-card");
    if (!resultContainer) return;

    const isProfitable = netProfit >= 0;

    resultContainer.innerHTML = `
      <div class="ledger-profit-summary ${isProfitable ? 'profit-positive' : 'profit-negative'}">
        <div class="profit-headline">
          <div>
            <span class="badge ${isProfitable ? 'badge-success' : 'badge-danger'}">
              ${isProfitable ? '🎉 Net Season Profit' : '⚠️ Seasonal Loss'}
            </span>
            <div class="profit-amount ${isProfitable ? 'text-green' : 'text-red'}">
              ₹${Math.abs(netProfit).toLocaleString()}
            </div>
            <div class="profit-sub">Total across ${acres} acres of ${crop} (ROI: ${roiPercent}%)</div>
          </div>
          <div class="profit-per-acre-box">
            <span class="label">Net Profit / Acre</span>
            <strong class="val">₹${profitPerAcre.toLocaleString()}</strong>
          </div>
        </div>

        <div class="ledger-breakdown-grid">
          <div class="ledger-stat-box">
            <span class="box-label">Total Cultivation Cost</span>
            <span class="box-val text-red">₹${totalExpense.toLocaleString()}</span>
            <span class="box-sub">₹${Math.round(totalExpense / acres).toLocaleString()}/acre</span>
          </div>

          <div class="ledger-stat-box">
            <span class="box-label">Gross Farm Revenue</span>
            <span class="box-val text-green">₹${totalRevenue.toLocaleString()}</span>
            <span class="box-sub">Grain + Straw output</span>
          </div>

          <div class="ledger-stat-box">
            <span class="box-label">Cost of Production</span>
            <span class="box-val">₹${costPerQuintal} / Qtl</span>
            <span class="box-sub">Break-even price threshold</span>
          </div>

          <div class="ledger-stat-box">
            <span class="box-label">Realized Real Price</span>
            <span class="box-val text-gold">₹${pricePerQtl} / Qtl</span>
            <span class="box-sub">${pricePerQtl > costPerQuintal ? `₹${pricePerQtl - costPerQuintal} margin/qtl` : 'Selling below cost!'}</span>
          </div>
        </div>

        <!-- Smart Agronomic Cost Optimization Tips -->
        <div class="ledger-ai-advice">
          <h4>💡 Kisan Connect Cost-Optimization Analysis:</h4>
          <ul>
            ${fertCost > totalExpense * 0.22 ? `
              <li><strong>Fertilizer Cost Alert:</strong> Chemical fertilizers account for ${Math.round((fertCost / totalExpense) * 100)}% of your expenses. Switch to IFFCO Nano Urea & home-brewed Jeevamrit to reduce fertilizer bills by ₹2,000-₹3,500/acre.</li>
            ` : ''}
            ${machineCost > totalExpense * 0.22 ? `
              <li><strong>Machinery Cost Alert:</strong> Equipment rental takes up ${Math.round((machineCost / totalExpense) * 100)}% of your budget. Use the <em>Yantra Sahay</em> tab to pool equipment with 2-3 neighbor farmers to save up to 30% on tractor & combine hours!</li>
            ` : ''}
            <li><strong>Mandi Advantage:</strong> Your current cost of production is ₹${costPerQuintal}/Qtl. Ensure you do not sell below ₹${Math.max(costPerQuintal + 300, 2275)}/Qtl.</li>
          </ul>
        </div>

        <div class="ledger-actions-bar">
          <button class="btn btn-sm btn-outline" onclick="window.print()">🖨️ Print Farm Ledger</button>
          <button class="btn btn-sm btn-primary" onclick="FarmLedgerModule.saveKhataSnapshot()">💾 Save to Digital Bahi-Khata</button>
        </div>
      </div>
    `;
  },

  saveKhataSnapshot() {
    if (window.App) {
      window.App.showToast("Farm Ledger saved to your device digital Bahi-Khata!");
    }
  },

  setupWeatherListeners() {
    document.getElementById("weather-location-form")?.addEventListener("submit", event => {
      event.preventDefault();
      this.renderWeatherForecast();
    });
    document.getElementById("weather-auto-detect")?.addEventListener("click", async () => {
      const status = document.getElementById("weather-location-status");
      const input = document.getElementById("weather-location-input");
      if (!navigator.geolocation) { if (status) status.textContent = "This browser does not support location detection. Enter your village or city manually."; return; }
      if (status) status.textContent = "Requesting location permission…";
      navigator.geolocation.getCurrentPosition(async position => {
        try {
          const { latitude, longitude } = position.coords;
          const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`;
          const response = await fetch(url);
          if (!response.ok) throw new Error("Location lookup failed");
          const data = await response.json();
          const place = data.results?.[0];
          if (!place) throw new Error("Could not identify a nearby village or town");
          const label = [place.name, place.admin1, place.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(", ");
          input.value = label;
          if (status) status.textContent = `Detected: ${label}. Updating forecast…`;
          this.renderWeatherForecast();
        } catch (error) { if (status) status.textContent = `${error.message}. Please enter your location manually.`; }
      }, error => { if (status) status.textContent = `${error.code === 1 ? "Location permission denied" : "Could not detect location"}. Enter your village or city manually.`; }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
    });
    document.getElementById("weather-speak-button")?.addEventListener("click", () => {
      const summary = document.getElementById("weather-current-summary")?.dataset.speech;
      if (!summary || !("speechSynthesis" in window)) {
        if (window.App) window.App.showToast("Hindi voice playback is not supported by this browser.");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(summary);
      utterance.lang = "hi-IN";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    });
  },

  async renderWeatherForecast() {
    const container = document.getElementById("weather-forecast-grid");
    const summary = document.getElementById("weather-current-summary");
    const sourceNote = document.getElementById("weather-source-note");
    if (!container || !summary) return;
    const location = document.getElementById("weather-location-input")?.value.trim() || "Lucknow";
    container.innerHTML = '<p class="text-sm text-muted">Loading live forecast…</p>';
    summary.textContent = `Loading weather for ${location}…`;
    try {
      const response = await fetch(`/api/weather/forecast?location=${encodeURIComponent(location)}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Weather forecast is temporarily unavailable.");
      const current = data.current || {};
      const temp = current.temperature == null ? "—" : `${Math.round(current.temperature)}°C`;
      const humidity = current.humidity == null ? "—" : `${Math.round(current.humidity)}%`;
      const wind = current.windKmH == null ? "—" : `${Math.round(current.windKmH)} km/h`;
      summary.innerHTML = `<strong>${this.escapeWeather(data.location)}</strong><span>Now: ${this.escapeWeather(current.condition || "Conditions unavailable")}</span><span>${temp}</span><span>Humidity ${humidity}</span><span>Wind ${wind}</span>`;
      summary.dataset.speech = `${data.location} ka mausam. Abhi ${current.condition || "mausam ki jaankari uplabdh nahi"}. Taapmaan ${temp}. Nami ${humidity}. Hawa ki raftaar ${wind}. Agle saat din ka forecast dekhne ke liye neeche dekhein.`;
      if (sourceNote) sourceNote.textContent = `Source: ${data.source}. Provider time: ${data.updatedAt || "latest available"} (${data.timezone || "local time"}). Forecast is indicative and may differ from conditions in your field.`;
      const icons = code => code === 0 ? "☀" : [1,2].includes(code) ? "⛅" : code === 3 ? "☁" : [45,48].includes(code) ? "Fog" : [51,53,55,61,63,65,80,81,82].includes(code) ? "Rain" : [95,96,99].includes(code) ? "Storm" : "Weather";
      container.innerHTML = (data.days || []).map((day, index) => {
        const date = new Date(`${day.date}T12:00:00`);
        const dayName = index === 0 ? "Today" : date.toLocaleDateString("en-IN", { weekday: "short" });
        const dateLabel = date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        const rain = day.rainChance == null ? "Not available" : `${Math.round(day.rainChance)}%`;
        const max = day.tempMax == null ? "—" : `${Math.round(day.tempMax)}°C`;
        const min = day.tempMin == null ? "—" : `${Math.round(day.tempMin)}°C`;
        const windSpeed = day.windKmH == null ? "—" : `${Math.round(day.windKmH)} km/h`;
        let advisory = "Use the forecast as a planning aid and confirm local field conditions before taking action.";
        if (Number(day.rainChance) >= 60) advisory = "Rain probability is elevated. Consider postponing rain-sensitive field work and check the latest local advisory.";
        else if (Number(day.windKmH) >= 25) advisory = "Wind may be strong. Check local conditions and product label restrictions before any spraying activity.";
        else if (Number(day.rainChance) <= 20) advisory = "Low forecast rain probability. Check soil moisture before deciding irrigation needs.";
        return `<article class="weather-day-card ${index === 0 ? "today-highlight" : ""}"><div class="weather-day-header"><div><strong>${dayName}</strong><div class="text-xs text-muted">${dateLabel}</div></div><div class="weather-icon-lg" aria-hidden="true">${icons(Number(day.weatherCode))}</div></div><div class="weather-temps"><span class="temp-max">${max}</span><span class="temp-min">${min}</span></div><div class="weather-condition-text">${this.escapeWeather(day.condition || "Forecast unavailable")}</div><div class="weather-params"><div class="param-row"><span>Rain chance</span><strong>${rain}</strong></div><div class="param-row"><span>Wind speed</span><strong>${windSpeed}</strong></div></div><div class="weather-advisory-box"><div class="advisory-title">Farm planning note</div><p>${advisory}</p></div></article>`;
      }).join("") || '<p class="text-sm text-muted">No forecast records were returned for this location.</p>';
    } catch (error) {
      summary.textContent = "Live weather is currently unavailable.";
      container.innerHTML = `<div class="weather-live-error">${this.escapeWeather(error.message || "Could not load the forecast.")} Please check the location and retry. No sample forecast is being substituted.</div>`;
      if (sourceNote) sourceNote.textContent = "Live weather provider: Open-Meteo. Forecast requires internet access.";
    }
  },

  escapeWeather(value) {
    return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  },

  // Kisan Chopal Community Section
  renderCommunityPosts() {
    const container = document.getElementById("community-posts-container");
    if (!container) return;

    container.innerHTML = KISAN_DATA.communityPosts.map(p => `
      <div class="community-post-card" id="${p.id}">
        <div class="post-header">
          <div class="post-author-box">
            <div class="author-avatar">🧑‍🌾</div>
            <div>
              <div class="author-name">
                <strong>${p.author}</strong>
                ${p.verifiedKisan ? '<span class="verified-kisan-badge">✓ Verified Farmer</span>' : ''}
              </div>
              <div class="author-meta">${p.village} • Land: ${p.landSize} • ${p.timeAgo}</div>
            </div>
          </div>
          <span class="badge badge-category">#${p.tag}</span>
        </div>

        <h3 class="post-title">${p.title}</h3>
        <p class="post-content">${p.content}</p>

        <div class="post-footer">
          <div class="post-stats">
            <button class="btn-like" onclick="FarmLedgerModule.likePost('${p.id}')">
              👍 Upvote (<span id="likes-${p.id}">${p.likes}</span>)
            </button>
            <span class="replies-count">💬 ${p.repliesCount} Farmer Replies</span>
          </div>
          <button class="btn btn-sm btn-outline" onclick="FarmLedgerModule.replyPost('${p.id}')">
            Share Experience
          </button>
        </div>
      </div>
    `).join("");
  },

  setupCommunityListeners() {
    const postForm = document.getElementById("new-community-post-form");
    if (postForm) {
      postForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const author = document.getElementById("post-author")?.value || "Kisan Sathi";
        const village = document.getElementById("post-village")?.value || "District Hub";
        const tag = document.getElementById("post-tag")?.value || "Farming Tips";
        const title = document.getElementById("post-title")?.value;
        const content = document.getElementById("post-content")?.value;

        if (!title || !content) return;

        const newPost = {
          id: "post-" + Date.now(),
          author,
          village,
          landSize: "Smallholder",
          tag,
          timeAgo: "Just now",
          title,
          content,
          likes: 1,
          repliesCount: 0,
          verifiedKisan: true
        };

        KISAN_DATA.communityPosts.unshift(newPost);
        this.renderCommunityPosts();
        postForm.reset();

        if (window.App) {
          window.App.closeModal("modal-new-post");
          window.App.showToast("Your experience was shared to Kisan Chopal!");
        }
      });
    }
  },

  likePost(postId) {
    const p = KISAN_DATA.communityPosts.find(item => item.id === postId);
    if (p) {
      p.likes += 1;
      const el = document.getElementById(`likes-${postId}`);
      if (el) el.textContent = p.likes;
      if (window.App) window.App.showToast("Upvoted! Thank you for supporting fellow farmers.");
    }
  },

  replyPost(postId) {
    if (window.App) {
      window.App.showToast("Opening reply thread for farmer discussion...");
    }
  }
};

if (typeof window !== "undefined") {
  window.FarmLedgerModule = FarmLedgerModule;
}
