/* Progressive enhancements: transparent calculators, install prompt and real vision endpoint. */
(() => {
  const byId = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
  const num = id => Number(byId(id)?.value || 0);
  const toast = message => {
    if (window.App?.showToast) window.App.showToast(message);
    else console.info(message);
  };
  function calculateNetMandi() {
    const qty = num("net-qty"), price = num("net-price");
    const costs = ["net-transport","net-loading","net-commission","net-other"].reduce((sum,id)=>sum+num(id),0);
    const out = byId("net-mandi-result");
    if (!out) return;
    if (qty <= 0 || price < 0 || ["net-transport","net-loading","net-commission","net-other"].some(id=>num(id)<0)) {
      out.textContent = "Enter a positive quantity and non-negative values."; return;
    }
    const gross = qty * price, net = gross - costs;
    out.innerHTML = `<div class="calculator-result"><strong>Gross sale value: ${money(gross)}</strong><br>Total selling costs: ${money(costs)}<br><strong>Estimated net proceeds: ${money(net)}</strong><br>Net proceeds per quintal: ${money(net/qty)}<p class="text-muted">Estimate only; cultivation costs, taxes and other expenses are not included unless entered.</p></div>`;
  }
  function calculateDose() {
    const rate=num("dose-rate"), area=num("dose-area"), water=num("dose-water"), out=byId("pesticide-dose-result");
    if (!out) return;
    if (rate<=0 || area<=0 || water<=0) { out.textContent="Enter the dose and water rate exactly as printed on the product label, plus the treated area."; return; }
    out.innerHTML=`<div class="calculator-result"><strong>Label-scaled product quantity: ${(rate*area).toLocaleString("en-IN",{maximumFractionDigits:3})} ml or g</strong><br>Label-scaled water volume: ${(water*area).toLocaleString("en-IN",{maximumFractionDigits:2})} litres<p>Confirm that the label rate is per acre and approved for your crop and target pest before use.</p></div>`;
  }
  document.addEventListener("DOMContentLoaded", () => {
    byId("btn-calc-net-mandi")?.addEventListener("click", calculateNetMandi);
    byId("btn-calc-dose")?.addEventListener("click", calculateDose);
    if (byId("net-mandi-result")) calculateNetMandi();
    let installPrompt;
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault(); installPrompt=e;
      if (byId("btn-install-pwa")) return;
      const button=document.createElement("button");
      button.id="btn-install-pwa"; button.className="btn btn-outline"; button.textContent="Install app";
      button.addEventListener("click",async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;button.remove();});
      document.querySelector(".header-action-group")?.appendChild(button);
    });
  });
  // API helper for future UI upload wiring; no image is sent to a third party from the browser.
  window.KisanVision = {
    async diagnose(file, crop="") {
      if (!(file instanceof File) || !file.type.startsWith("image/")) throw new Error("Please choose an image file.");
      if (file.size > 8*1024*1024) throw new Error("Image must be 8 MB or smaller.");
      const base64 = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});
      const response=await fetch("/api/crop-doctor/analyze",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({imageBase64:base64,mimeType:file.type,crop})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.detail || "Crop analysis is not available.");
      return data;
    }
  };
})();