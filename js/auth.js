const Auth = {
  mode: "login",
  currentUser: null,
  roles: {
    farmer: "Farmer / Seller",
    localBuyer: "Local Buyer",
    bulkBuyer: "Bulk Buyer / Trader",
    admin: "Admin"
  },

  async init() {
    const form = document.getElementById("auth-form");
    if (form) form.addEventListener("submit", (event) => this.submit(event));
    const switchButton = document.getElementById("auth-switch");
    if (switchButton) switchButton.addEventListener("click", () => this.open(this.mode === "login" ? "register" : "login"));
    await this.loadSession();
  },

  async request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Request failed. Please try again.");
    return data;
  },

  async loadSession() {
    try {
      const data = await this.request("/api/auth/me", { headers: {} });
      this.currentUser = data.user;
    } catch (_) {
      this.currentUser = null;
    }
    this.refreshHeader();
    if (this.currentUser && this.currentUser.role === "farmer") {
      const nameField = document.getElementById("harvest-farmer-name");
      if (nameField) nameField.value = this.currentUser.name;
    }
  },

  open(mode = "login") {
    this.mode = mode;
    const isRegister = mode === "register";
    document.getElementById("auth-title").textContent = isRegister ? "Create your account" : "Welcome back";
    document.getElementById("auth-description").textContent = isRegister ? "Choose how you want to use Kisan Connect." : "Sign in to your Kisan Connect account.";
    document.getElementById("auth-name-group").hidden = !isRegister;
    const legalConsent = document.getElementById("auth-legal-consent");
    if (legalConsent) legalConsent.hidden = !isRegister;
    const agreeTerms = document.getElementById("auth-agree-terms");
    if (agreeTerms) { agreeTerms.required = isRegister; if (!isRegister) agreeTerms.checked = false; }
    document.getElementById("auth-name").required = isRegister;
    document.getElementById("auth-password").autocomplete = isRegister ? "new-password" : "current-password";
    document.getElementById("auth-password").minLength = isRegister ? 8 : 1;
    document.getElementById("auth-password").placeholder = isRegister ? "At least 8 characters" : "Your password";
    document.getElementById("auth-submit").textContent = isRegister ? "Create account" : "Log in";
    document.getElementById("auth-switch-copy").textContent = isRegister ? "Already registered?" : "New to Kisan Connect?";
    document.getElementById("auth-switch").textContent = isRegister ? "Log in" : "Create an account";
    document.querySelector(".auth-demo-note").textContent = "Use a strong password you do not use on other websites. Kisan Connect will never display your password.";
    document.getElementById("auth-modal").classList.add("active");
    document.getElementById("auth-modal").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  },

  async submit(event) {
    event.preventDefault();
    if (this.mode === "register" && !document.getElementById("auth-agree-terms")?.checked) {
      window.App?.showToast?.("Please accept the User Agreement and Privacy Policy to create an account.");
      return;
    }
    const button = document.getElementById("auth-submit");
    button.disabled = true;
    const body = {
      email: document.getElementById("auth-email").value.trim().toLowerCase(),
      password: document.getElementById("auth-password").value
    };
    if (this.mode === "register") {
      body.name = document.getElementById("auth-name").value.trim();
      body.role = document.getElementById("auth-role").value;
    }
    try {
      const result = await this.request(`/api/auth/${this.mode === "register" ? "register" : "login"}`, {
        method: "POST", body: JSON.stringify(body)
      });
      this.currentUser = result.user;
      this.close();
      this.refreshHeader();
      window.App.showToast(`Signed in as ${this.roles[this.currentUser.role] || this.currentUser.role}.`);
      if (this.currentUser.role === "farmer") {
        document.getElementById("harvest-farmer-name").value = this.currentUser.name;
        window.App.openModal("modal-list-harvest");
      } else {
        window.App.switchTab("tab-mandi");
      }
      if (window.MandiModule) await window.MandiModule.loadUserListings();
    } catch (error) {
      window.App.showToast(error.message);
    } finally {
      button.disabled = false;
    }
  },

  async ensureRole(roles, message = "Please log in with the appropriate account to continue.") {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!this.currentUser) {
      window.App.showToast(message);
      this.open("login");
      return false;
    }
    if (!allowed.includes(this.currentUser.role)) {
      window.App.showToast(`This action is available to: ${allowed.map(role => this.roles[role]).join(", ")}.`);
      return false;
    }
    return true;
  },

  close() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "";
  },

  refreshHeader() {
    const loginButton = document.getElementById("account-action");
    const registerButton = document.getElementById("btn-register");
    if (!loginButton) return;
    const enquiriesButton = document.getElementById("btn-my-enquiries");
    if (enquiriesButton) enquiriesButton.hidden = !this.currentUser || !["farmer", "admin"].includes(this.currentUser.role);
    if (this.currentUser) {
      loginButton.textContent = this.currentUser.name || this.roles[this.currentUser.role] || "My account";
      loginButton.onclick = () => this.showAccountMenu();
      if (registerButton) registerButton.hidden = true;
    } else {
      loginButton.textContent = "Log in";
      loginButton.onclick = () => this.open("login");
      if (registerButton) registerButton.hidden = false;
    }
  },

  async showAccountMenu() {
    if (!this.currentUser) return;
    const user = this.currentUser;
    if (!window.confirm(`${user.name}\n${this.roles[user.role] || user.role}\n\nSign out?`)) return;
    try {
      await this.request("/api/auth/logout", { method: "POST", body: "{}" });
      this.currentUser = null;
      this.refreshHeader();
      window.App.showToast("You have signed out.");
    } catch (error) {
      window.App.showToast(error.message);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => Auth.init());
window.Auth = Auth;
