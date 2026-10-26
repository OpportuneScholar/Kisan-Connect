/**
 * Kisan Connect - Kisan AI Doctor & Crop Diagnostic Lab
 * Visual crop disease diagnosis engine, organic/chemical IPM prescriptions,
 * and Kisan Sahayak multilingual agricultural chatbot with voice read-aloud.
 */

const AIDoctorModule = {
  selectedSampleId: "wheat-rust",
  currentDiagnosis: null,
  chatHistory: [],

  init() {
    this.renderSampleThumbnails();
    this.setupListeners();
    this.initChatbot();
    // Pre-load default diagnosis
    this.runDiagnosis("wheat-rust");
  },

  setupListeners() {
    // Custom photo file upload
    const fileInput = document.getElementById("crop-photo-input");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.handleCustomImageUpload(event.target.result, file.name);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Audio read aloud button
    const speechBtn = document.getElementById("btn-voice-readout");
    if (speechBtn) {
      speechBtn.addEventListener("click", () => {
        this.speakCurrentDiagnosis();
      });
    }
  },

  renderSampleThumbnails() {
    const container = document.getElementById("disease-samples-grid");
    if (!container) return;

    container.innerHTML = KISAN_DATA.cropDiseases.map(d => {
      const isSelected = d.id === this.selectedSampleId;
      return `
        <div class="sample-leaf-card ${isSelected ? 'active' : ''}" onclick="AIDoctorModule.selectSample('${d.id}')">
          <div class="sample-crop-badge">${d.crop}</div>
          <div class="sample-name">${d.diseaseName}</div>
          <span class="badge ${d.severity === 'Critical' ? 'badge-danger' : (d.severity === 'High' ? 'badge-warning' : 'badge-neutral')}">
            ${d.severity} Severity
          </span>
        </div>
      `;
    }).join("");
  },

  selectSample(diseaseId) {
    this.selectedSampleId = diseaseId;
    this.renderSampleThumbnails();
    this.runDiagnosis(diseaseId);
  },

  async handleCustomImageUpload(dataUrl, fileName) {
    const previewContainer = document.getElementById("diagnosis-image-preview");
    const reportContainer = document.getElementById("diagnosis-report-container");
    const fileInput = document.getElementById("crop-photo-input");
    const mimeType = (dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,/) || [])[1];
    if (!mimeType) {
      if (window.App) window.App.showToast("Please upload a JPG, PNG or WebP crop photo.");
      if (fileInput) fileInput.value = "";
      return;
    }
    const base64 = dataUrl.split(",")[1] || "";
    if (base64.length > 11_000_000) {
      if (window.App) window.App.showToast("Image is too large. Please choose a photo under 8 MB.");
      if (fileInput) fileInput.value = "";
      return;
    }
    if (previewContainer) {
      previewContainer.innerHTML = "";
      const image = document.createElement("img");
      image.src = dataUrl;
      image.alt = "Uploaded crop photo";
      image.className = "scanned-leaf-img";
      previewContainer.appendChild(image);
      const caption = document.createElement("p");
      caption.className = "text-sm text-muted";
      caption.textContent = fileName || "Uploaded crop photo";
      previewContainer.appendChild(caption);
    }
    if (reportContainer) {
      reportContainer.innerHTML = '<div class="ai-scanning-state"><div class="scanner-anim-ring"></div><h4>AI Crop Doctor is analysing your photo…</h4><p class="text-muted">Checking visible symptoms. This may take a few seconds.</p></div>';
    }
    this.currentDiagnosis = null;
    const crop = document.getElementById("crop-photo-crop")?.value || "";
    try {
      const response = await fetch("/api/crop-doctor/analyze", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, crop })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "AI analysis is temporarily unavailable. Please try again.");
      this.renderVisionAnalysis(data.analysis || {}, data.disclaimer || "AI suggestions can be wrong. Confirm with a qualified agricultural expert.");
    } catch (error) {
      if (reportContainer) {
        reportContainer.innerHTML = "";
        const card = document.createElement("div");
        card.className = "diagnosis-card";
        const heading = document.createElement("h3");
        heading.textContent = "Could not complete AI analysis";
        const message = document.createElement("p");
        message.textContent = error.message || "Please try again in a moment.";
        const note = document.createElement("p");
        note.className = "text-sm text-muted";
        note.textContent = "If this continues, check the backend deployment logs for the Gemini error. Confirm GEMINI_API_KEY is configured on the backend (never in frontend code). For urgent crop issues, contact your local Krishi Vigyan Kendra.";
        card.append(heading, message, note);
        reportContainer.appendChild(card);
      }
    }
  },

  renderVisionAnalysis(analysis, disclaimer) {
    const container = document.getElementById("diagnosis-report-container");
    if (!container) return;
    const safe = value => this.escapeHtml(String(value ?? ""));
    const list = value => Array.isArray(value) && value.length
      ? value.map(item => `<li>${safe(item)}</li>`).join("")
      : "<li>No specific suggestions returned.</li>";
    const observations = Array.isArray(analysis.observations)
      ? analysis.observations.map(item => typeof item === "string" ? item : JSON.stringify(item)).join(" ")
      : (analysis.observations || "No clear observations returned.");
    const causes = Array.isArray(analysis.possibleCauses) ? analysis.possibleCauses : [];
    const confidence = ["low", "medium", "high"].includes(String(analysis.confidence || "").toLowerCase())
      ? String(analysis.confidence).toLowerCase() : "not specified";
    container.innerHTML = `
      <div class="diagnosis-card">
        <div class="diagnosis-header"><div><div class="crop-tag">Gemini Vision</div><h2 class="diagnosis-title">Photo-based crop health assessment</h2></div><span class="badge badge-neutral">Confidence: ${safe(confidence)}</span></div>
        <div class="symptom-alert-box"><div class="alert-icon">🔍</div><div><strong>Visible observations</strong><p>${safe(observations)}</p></div></div>
        <div class="treatment-columns">
          <div class="treatment-box"><h4>Possible causes to consider</h4><ul class="treatment-steps">${list(causes)}</ul></div>
          <div class="treatment-box organic-box"><h4>Safer next steps</h4><ul class="treatment-steps">${list(analysis.safeNextSteps)}</ul></div>
        </div>
        <div class="preventive-box"><span class="icon">🛡️</span><div><strong>When to contact an expert</strong><p>${safe(analysis.whenToContactExpert || "If symptoms spread, the crop is wilting rapidly, or you are unsure, contact a local agriculture expert.")}</p></div></div>
        <p class="text-sm text-muted">${safe(disclaimer)}</p>
      </div>`;
  },

  runDiagnosis(diseaseId, isCustom = false) {
    const disease = KISAN_DATA.cropDiseases.find(d => d.id === diseaseId) || KISAN_DATA.cropDiseases[0];
    this.currentDiagnosis = disease;

    const reportContainer = document.getElementById("diagnosis-report-container");
    if (!reportContainer) return;

    // Show simulated scanning animation first
    reportContainer.innerHTML = `
      <div class="ai-scanning-state">
        <div class="scanner-anim-ring"></div>
        <h4>AI Agronomist Scanning Leaf Tissue...</h4>
        <p class="text-muted">Analyzing chlorosis, fungal spore patterns, and leaf vein lesions...</p>
        <div class="scan-progress-bar">
          <div class="scan-bar-fill"></div>
        </div>
      </div>
    `;

    setTimeout(() => {
      this.renderDiagnosisReport(disease, isCustom);
    }, 450);
  },

  renderDiagnosisReport(disease, isCustom = false) {
    const reportContainer = document.getElementById("diagnosis-report-container");
    if (!reportContainer) return;

    const confidence = null;
    const severityClass = disease.severity === "Critical" ? "badge-danger" : (disease.severity === "High" ? "badge-warning" : "badge-neutral");

    reportContainer.innerHTML = `
      <div class="diagnosis-card">
        <div class="diagnosis-header">
          <div>
            <div class="crop-tag">${disease.crop}</div>
            <h2 class="diagnosis-title">${disease.diseaseName}</h2>
            <div class="scientific-name"><em>${disease.scientificName}</em></div>
          </div>
          <div class="diagnosis-meta-badges">
            <span class="badge ${severityClass}">${disease.severity} Risk</span>
            <span class="badge badge-neutral">Reference guide — not an AI diagnosis</span>
          </div>
        </div>

        <div class="symptom-alert-box">
          <div class="alert-icon">🔍</div>
          <div>
            <strong>Visible Symptoms & Diagnostic Signs:</strong>
            <p>${disease.symptoms}</p>
            <div class="text-sm text-muted"><strong>Favorable Weather Trigger:</strong> ${disease.favorableConditions}</div>
          </div>
        </div>

        <div class="treatment-columns">
          <!-- 1. Organic / Biological Zero-Cost Treatment -->
          <div class="treatment-box organic-box">
            <div class="treatment-box-header">
              <span class="icon">🌿</span>
              <div>
                <h4>Zero-Cost Organic Remedies</h4>
                <div class="sub">Bio-fungicides & natural village formulations</div>
              </div>
            </div>
            <ul class="treatment-steps">
              ${disease.organicTreatment.map(t => `<li>✓ ${t}</li>`).join("")}
            </ul>
          </div>

          <!-- 2. Scientific Agrochemical / IPM Prescription -->
          <div class="treatment-box chemical-box">
            <div class="treatment-box-header">
              <span class="icon">🔬</span>
              <div>
                <h4>Scientific Agrochemical Prescription</h4>
                <div class="sub">ICAR & CIBRC recommended exact dosages</div>
              </div>
            </div>
            <ul class="treatment-steps">
              ${disease.chemicalTreatment.map(t => `<li>🧪 ${t}</li>`).join("")}
            </ul>
          </div>
        </div>

        <div class="preventive-box">
          <span class="icon">🛡️</span>
          <div>
            <strong>Preventive Agronomic Advice:</strong>
            <p>${disease.preventiveAdvice}</p>
          </div>
        </div>

        <div class="diagnosis-footer-bar">
          <button id="btn-voice-readout" class="btn btn-outline" onclick="AIDoctorModule.speakCurrentDiagnosis()">
            🔊 Listen to Audio Advice (बोलकर सुनें)
          </button>
          <button class="btn btn-primary" onclick="AIDoctorModule.openInChatbot('${disease.diseaseName}')">
            💬 Ask Kisan Sahayak AI More
          </button>
        </div>
      </div>
    `;
  },

  speakCurrentDiagnosis() {
    if (!this.currentDiagnosis) return;

    if (!("speechSynthesis" in window)) {
      if (window.App) {
        window.App.showToast("Voice speech synthesis is not supported on this browser.");
      }
      return;
    }

    // Cancel any running speech
    window.speechSynthesis.cancel();

    const d = this.currentDiagnosis;
    const textToSpeak = `संदर्भ जानकारी: ${d.crop} में ${d.diseaseName} से जुड़े लक्षण। यह AI द्वारा पुष्टि किया गया निदान नहीं है। जैविक उपाय: ${d.organicTreatment[0]}। रासायनिक उपचार अपनाने से पहले स्थानीय कृषि विशेषज्ञ से सलाह लें।`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Try Hindi or fallback to default
    const voices = window.speechSynthesis.getVoices();
    const hiVoice = voices.find(v => v.lang.includes("hi") || v.lang.includes("IN"));
    if (hiVoice) {
      utterance.voice = hiVoice;
    }

    utterance.onstart = () => {
      if (window.App) window.App.showToast("🔊 Audio advisory playing in Hindi/English...");
    };

    window.speechSynthesis.speak(utterance);
  },

  // Interactive Kisan Sahayak Chatbot
  initChatbot() {
    const chatInput = document.getElementById("ai-chat-input");
    const sendBtn = document.getElementById("btn-send-chat");

    if (sendBtn && chatInput) {
      sendBtn.addEventListener("click", () => this.handleSendMessage());
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.handleSendMessage();
      });
    }

    // Pre-populate welcome message
    this.appendBotMessage(
      "नमस्ते किसान साथी! 🙏 I am your **Kisan Sahayak AI**. Ask me anything about crop diseases, organic fertilizers (Jeevamrit, Vermicompost), current Mandi rates, government subsidies, or spray schedules."
    );
  },

  openInChatbot(diseaseName) {
    const chatTabBtn = document.querySelector('[data-tab="tab-doctor"]');
    if (chatTabBtn) chatTabBtn.click();

    const chatSection = document.getElementById("kisan-chat-wrapper");
    if (chatSection) {
      chatSection.scrollIntoView({ behavior: "smooth" });
    }

    this.sendPredefinedQuery(`What is the complete treatment schedule for ${diseaseName}?`);
  },

  sendPredefinedQuery(queryText) {
    const input = document.getElementById("ai-chat-input");
    if (input) {
      input.value = queryText;
      this.handleSendMessage();
    }
  },

  handleSendMessage() {
    const input = document.getElementById("ai-chat-input");
    if (!input) return;

    const userText = input.value.trim();
    if (!userText) return;

    this.appendUserMessage(userText);
    input.value = "";

    // Generate intelligent agronomist response
    setTimeout(() => {
      const botResponse = this.generateAgriResponse(userText);
      this.appendBotMessage(botResponse);
    }, 500);
  },

  generateAgriResponse(query) {
    const q = query.toLowerCase();

    if (q.includes("rust") || q.includes("रतुआ") || q.includes("yellow")) {
      return "🌾 **Yellow Rust (पीला रतुआ) Alert**: Cool foggy weather accelerates this fungal disease. **Immediate step**: Spray Propiconazole 25% EC @ 1ml/litre water (200ml per acre). For organic control, spray 4-day sour buttermilk (खट्टी छाछ 5L in 200L water). Avoid heavy nitrogen urea top-dressing right now.";
    }

    if (q.includes("urea") || q.includes("fertilizer") || q.includes("यूरिया") || q.includes("khad")) {
      return "🌱 **Fertilizer & Nano Urea Advisory**: Excessive broadcast urea causes soft vegetative growth vulnerable to pests. Switch to **IFFCO Nano Urea (liquid)**: 1 bottle (500ml @ ₹225) replaces 1 full 45kg bag of conventional urea! Spray at 30-35 days after sowing during active tillering with 100-125 litres of water per acre.";
    }

    if (q.includes("jeevamrit") || q.includes("जीवामृत") || q.includes("organic")) {
      return "🧪 **Home-made Jeevamrit Recipe (for 1 Acre)**: Mix 10kg fresh desi cow dung + 10L cow urine + 2kg jaggery (Gur) + 2kg besan (chickpea flour) + handful of fertile bund soil in 200L water. Stir clockwise twice daily for 4-5 days. Filter and apply through irrigation water or foliar spray to enrich active soil microbes.";
    }

    if (q.includes("solar") || q.includes("kusum") || q.includes("pump") || q.includes("सोलर")) {
      return "☀️ **PM-KUSUM Solar Pump Subsidy**: Small & marginal farmers receive up to **90% subsidy** (30% Central + 30% State + 30% Bank loan) for standalone 3HP to 7.5HP solar pumps! You only contribute 10%. Go to the **Govt Schemes** tab on Kisan Connect to check your exact state eligibility.";
    }

    if (q.includes("pm kisan") || q.includes("pm-kisan") || q.includes("6000") || q.includes("installment")) {
      return "🏛️ **PM-KISAN Samman Nidhi**: Eligible farmers receive ₹6,000/year in 3 quarterly DBT installments of ₹2,000. **Requirements**: 1) Aadhaar e-KYC completed, 2) Land record seeded with state revenue portal, 3) NPCI Aadhaar bank account mapping active. Check status at pmkisan.gov.in or call 155261.";
    }

    if (q.includes("spray") || q.includes("rain") || q.includes("weather") || q.includes("छिड़काव")) {
      return "🌦️ **Spray Window Advisory**: Check today's wind velocity (<10 km/h) and rain probability. Avoid spraying when rain is forecasted within 24 hours. Always add 1ml surfactant/soap per litre of spray solution to prevent droplet bounce and improve leaf absorption.";
    }

    if (q.includes("mandi") || q.includes("price") || q.includes("rate") || q.includes("भाव")) {
      return "📊 **Mandi Price Intelligence**: Wheat is currently trading at ₹2,480/Qtl (above MSP ₹2,275). Mustard is strong at ₹5,850/Qtl. Soybean is trading soft at ₹4,420 (below MSP ₹4,600 - hold if you have safe storage). Check the **Kisan Mandi** tab for live rates.";
    }

    return "🧑‍🌾 **Kisan Sahayak Advice**: For your query regarding '" + query + "', we recommend consulting with your local Krishi Vigyan Kendra (KVK) or contacting your nearest Krishi Vigyan Kendra (KVK). You can also explore our **Mandi**, **Machinery Pooling**, and **Govt Schemes** tabs for direct assistance!";
  },

  appendUserMessage(text) {
    const chatContainer = document.getElementById("ai-chat-messages");
    if (!chatContainer) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-msg user-msg";
    msgDiv.innerHTML = `
      <div class="msg-bubble">${this.escapeHtml(text)}</div>
      <span class="msg-sender">🧑‍🌾 You</span>
    `;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  },

  appendBotMessage(markdownText) {
    const chatContainer = document.getElementById("ai-chat-messages");
    if (!chatContainer) return;

    // Simple markdown formatting (bold, links, lists)
    let formatted = markdownText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-msg bot-msg";
    msgDiv.innerHTML = `
      <span class="msg-sender">🤖 Kisan Sahayak AI</span>
      <div class="msg-bubble">${formatted}</div>
    `;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  },

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
};

if (typeof window !== "undefined") {
  window.AIDoctorModule = AIDoctorModule;
}
