
(() => {
  let deferredInstallPrompt = null;

  const menuButton = document.getElementById("pwa-menu-button");
  const menu = document.getElementById("pwa-menu");
  const installButton = document.getElementById("pwa-install-button");
  const statusMessage = document.getElementById("pwa-status");

  if (!menuButton || !menu || !installButton) {
    console.warn("PWA menu elements are missing from this page.");
    return;
  }

  const isInstalled = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const showStatus = (message) => {
    if (statusMessage) statusMessage.textContent = message;
  };

  const closeMenu = () => {
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  };

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();

    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    menuButton.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  const updateInstallButton = () => {
    if (isInstalled()) {
      installButton.textContent = "App Installed";
      installButton.disabled = true;
    } else {
      installButton.textContent = "Install App";
      installButton.disabled = false;
    }
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButton();
  });

  installButton.addEventListener("click", async () => {
    closeMenu();

    if (isInstalled()) {
      showStatus("KADINAMA IRU is already installed.");
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();

      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;

      if (choice.outcome === "accepted") {
        showStatus("KADINAMA IRU installation started!");
      } else {
        showStatus("Installation cancelled.");
      }

      updateInstallButton();
      return;
    }

    showStatus(
      "Install option isn't available yet. Open the deployed website in a supported browser and use its browser menu to install the app."
    );
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallButton();
    showStatus("KADINAMA IRU installed successfully!");
  });

  updateInstallButton();

  // Register the service worker only on HTTPS or localhost.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });
    });
  }
})();
