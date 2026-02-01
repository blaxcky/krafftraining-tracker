const clearAppCaches = async () => {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
};

const hardReload = () => {
  const url = new URL(window.location.href);
  url.searchParams.set('v', Date.now().toString());
  window.location.replace(url.toString());
};

const forceUpdate = async (registration) => {
  await clearAppCaches();

  const attachInstallHandler = (worker) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }

  if (registration.installing) {
    attachInstallHandler(registration.installing);
  } else {
    registration.addEventListener('updatefound', () => {
      attachInstallHandler(registration.installing);
    }, { once: true });
  }

  try {
    await registration.update();
  } catch (error) {
    console.log('SW update failed: ', error);
  }

  setTimeout(async () => {
    if (!registration.waiting && !registration.installing) {
      await registration.unregister();
      hardReload();
    }
  }, 1200);
};

const showUpdateAction = (registration) => {
  const updateBtn = document.getElementById('update-btn');
  if (!updateBtn) return;
  updateBtn.classList.add('show');
  updateBtn.onclick = async () => {
    updateBtn.disabled = true;
    updateBtn.querySelector('.material-symbols-outlined').textContent = 'autorenew';
    await forceUpdate(registration);
  };
};

const showUpdateBanner = (registration) => {
  if (document.getElementById('update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';

  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.textContent = 'system_update';

  const text = document.createElement('div');
  text.className = 'update-banner__text';
  text.textContent = 'Update verfügbar';

  const actions = document.createElement('div');
  actions.className = 'update-banner__actions';

  const laterBtn = document.createElement('button');
  laterBtn.className = 'update-banner__ghost';
  laterBtn.textContent = 'Später';
  laterBtn.addEventListener('click', () => {
    banner.remove();
  });

  const updateBtn = document.createElement('button');
  updateBtn.className = 'update-banner__btn';
  updateBtn.textContent = 'Aktualisieren';
  updateBtn.addEventListener('click', () => {
    updateBtn.disabled = true;
    updateBtn.textContent = 'Aktualisiere...';
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      registration.update();
    }
  });

  actions.appendChild(laterBtn);
  actions.appendChild(updateBtn);
  banner.appendChild(icon);
  banner.appendChild(text);
  banner.appendChild(actions);

  document.body.appendChild(banner);
  showUpdateAction(registration);
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);

        showUpdateAction(registration);

        if (registration.waiting) {
          showUpdateBanner(registration);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner(registration);
            }
          });
        });

        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const installButton = document.createElement('button');
  installButton.textContent = 'App installieren';
  installButton.className = 'fixed bottom-4 right-4 bg-primary text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50';
  installButton.id = 'install-button';
  
  installButton.addEventListener('click', () => {
    installButton.style.display = 'none';
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null;
    });
  });
  
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    document.body.appendChild(installButton);
  }
});

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  const installButton = document.getElementById('install-button');
  if (installButton) {
    installButton.remove();
  }
});
