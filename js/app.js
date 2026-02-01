class App {
  constructor() {
    this.currentTab = 'training';
    this.editingExercise = null;
    this.editingType = 'exercise';
    this.showCompletedExercises = false;
    this.tabOrder = ['exercises', 'training', 'calories'];
    this.version = '2.9.18';
    this.init();
  }

  // Hilfsfunktion: Formatiert Gewicht mit Punkt statt Komma
  formatWeight(weight) {
    if (!weight && weight !== 0) return '0';
    return String(weight).replace(',', '.');
  }

  // Aktualisiert die Checkboxen für Zusatzgewichte (cascading logic)
  updatePlateCheckboxes() {
    const plate1 = document.getElementById('plate-1');
    const plate2 = document.getElementById('plate-2');

    // Wenn Scheibe 2 ausgewählt ist, muss Scheibe 1 auch ausgewählt sein
    if (plate2 && plate2.checked) {
      if (plate1) plate1.checked = true;
    }

    this.updateTotalWeight();
  }

  // Berechnet und aktualisiert die Anzeige des Gesamtgewichts
  updateTotalWeight() {
    const weightInput = document.getElementById('exercise-weight');
    const plate1 = document.getElementById('plate-1');
    const plate2 = document.getElementById('plate-2');
    const totalWeightSpan = document.getElementById('total-weight');

    if (!weightInput || !totalWeightSpan) return;

    const baseWeight = parseFloat(weightInput.value.replace(',', '.')) || 0;
    let additionalPlates = 0;

    if (plate1 && plate1.checked) additionalPlates++;
    if (plate2 && plate2.checked) additionalPlates++;

    const totalWeight = baseWeight + (additionalPlates * 2.5);
    totalWeightSpan.textContent = `${totalWeight} kg`;
  }

  // Initialisiert den Weight-Picker
  initWeightPicker(pickerId, inputId) {
    const picker = document.getElementById(pickerId);
    const input = document.getElementById(inputId);
    if (!picker) return;

    picker.innerHTML = '<div class="weight-picker-spacer"></div>';
    for (let w = 0; w <= 200; w += 1) {
      picker.innerHTML += `<div class="weight-picker-item" data-value="${w}">${w} kg</div>`;
    }
    picker.innerHTML += '<div class="weight-picker-spacer"></div>';

    picker.addEventListener('scroll', () => {
      clearTimeout(this.pickerTimeout);
      this.pickerTimeout = setTimeout(() => this.onPickerScroll(picker, input), 50);
    });
  }

  onPickerScroll(picker, input) {
    const items = picker.querySelectorAll('.weight-picker-item');
    const center = picker.getBoundingClientRect().top + 60;
    let closest = null, minDist = Infinity;

    items.forEach(item => {
      item.classList.remove('selected');
      const dist = Math.abs(item.getBoundingClientRect().top + 18 - center);
      if (dist < minDist) { minDist = dist; closest = item; }
    });

    if (closest) {
      closest.classList.add('selected');
      input.value = closest.dataset.value;
      this.updateTotalWeight();
    }
  }

  setPickerValue(pickerId, value) {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    const snapped = Math.round(value);
    const index = snapped;
    picker.scrollTop = index * 36;
  }

  // Gibt die Anzahl der Zusatzscheiben zurück
  getAdditionalPlates() {
    const plate1 = document.getElementById('plate-1');
    const plate2 = document.getElementById('plate-2');

    let plates = 0;
    if (plate1 && plate1.checked) plates++;
    if (plate2 && plate2.checked) plates++;

    return plates;
  }

  async init() {
    await storage.init();
    this.setupEventListeners();
    this.updateVersionBadge();
    this.switchTab(this.currentTab, { animate: false });
    await this.loadExercises();
    await this.loadTraining();
  }

  updateVersionBadge() {
    const badge = document.getElementById('version-badge');
    if (badge) {
      badge.textContent = `v${this.version}`;
    }
  }

  setupEventListeners() {
    document.getElementById('tab-exercises').addEventListener('click', () => this.switchTab('exercises'));
    document.getElementById('tab-training').addEventListener('click', () => this.switchTab('training'));
    document.getElementById('tab-calories').addEventListener('click', () => this.switchTab('calories'));

    document.getElementById('add-exercise-btn').addEventListener('click', () => this.showExerciseModal());
    document.getElementById('add-header-btn').addEventListener('click', () => this.showHeaderModal());
    document.getElementById('cancel-btn').addEventListener('click', () => this.hideExerciseModal());
    document.getElementById('exercise-form').addEventListener('submit', (e) => this.saveExercise(e));

    // Event-Listener für Gewichtsberechnung
    document.getElementById('exercise-weight').addEventListener('input', () => this.updateTotalWeight());

    document.getElementById('start-training-btn').addEventListener('click', () => this.startTraining());
    document.getElementById('end-training-btn').addEventListener('click', () => this.endTraining());
    const toggleCompletedBtn = document.getElementById('toggle-completed-btn');
    if (toggleCompletedBtn) {
      toggleCompletedBtn.addEventListener('click', () => this.toggleCompletedVisibility());
    }

    document.getElementById('export-btn').addEventListener('click', () => this.exportExercises());
    document.getElementById('import-btn').addEventListener('click', () => this.importExercises());
    document.getElementById('import-file').addEventListener('change', (e) => this.handleImportFile(e));

    // Cardio Event-Listener
    document.getElementById('add-cardio-btn').addEventListener('click', () => this.addCardioEntry());

    // E-Mail senden Button und Eingabefeld
    document.getElementById('send-calories-email-btn').addEventListener('click', () => this.sendCaloriesSummaryEmail());
    document.getElementById('email-address-input').addEventListener('change', (e) => this.saveEmailAddress(e.target.value));

    document.addEventListener('click', (e) => {
      if (e.target.id === 'exercise-modal') {
        this.hideExerciseModal();
      }
    });

    this.setupSwipeNavigation();
  }

  getTabIndex(tab) {
    return this.tabOrder.indexOf(tab);
  }

  setTabTransform(index, animate = true) {
    const strip = document.getElementById('tab-strip');
    const panels = document.getElementById('tab-panels');
    if (!strip || !panels) return;

    const safeIndex = index < 0 ? 0 : index;
    const width = panels.clientWidth;
    const offset = -safeIndex * width;
    strip.style.transition = animate ? 'transform 0.25s ease' : 'none';
    strip.style.transform = `translate3d(${offset}px, 0, 0)`;
  }

  shouldIgnoreSwipe(target) {
    if (!target) return false;
    return Boolean(
      target.closest('[data-swipe-ignore], .weight-picker, .weight-picker-container')
    );
  }

  setupSwipeNavigation() {
    const panels = document.getElementById('tab-panels');
    const strip = document.getElementById('tab-strip');
    if (!panels || !strip) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let startOffset = 0;
    let tracking = false;
    let isHorizontal = null;

    const getWidth = () => panels.clientWidth;
    const getBounds = () => {
      const width = getWidth();
      return {
        min: -(this.tabOrder.length - 1) * width,
        max: 0,
        width
      };
    };

    panels.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) return;
      const modal = document.getElementById('exercise-modal');
      if (modal && !modal.classList.contains('hidden')) return;
      if (this.shouldIgnoreSwipe(event.target)) {
        tracking = false;
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      isHorizontal = null;
      tracking = true;

      const { width } = getBounds();
      const currentIndex = Math.max(0, this.getTabIndex(this.currentTab));
      startOffset = -currentIndex * width;
      strip.style.transition = 'none';
    }, { passive: true });

    panels.addEventListener('touchmove', (event) => {
      if (!tracking) return;
      const touch = event.touches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (isHorizontal === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.1;
      }

      if (!isHorizontal) return;
      event.preventDefault();

      const { min, max, width } = getBounds();
      const overscroll = width * 0.12;
      let nextOffset = startOffset + dx;
      nextOffset = Math.max(min - overscroll, Math.min(max + overscroll, nextOffset));

      strip.style.transform = `translate3d(${nextOffset}px, 0, 0)`;
    }, { passive: false });

    panels.addEventListener('touchend', (event) => {
      if (!tracking) return;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const elapsed = Date.now() - startTime;
      tracking = false;

      if (!isHorizontal || Math.abs(dx) < Math.abs(dy)) {
        this.setTabTransform(this.getTabIndex(this.currentTab), true);
        return;
      }

      const { width } = getBounds();
      const velocity = Math.abs(dx) / Math.max(1, elapsed);
      const movedEnough = Math.abs(dx) > width * 0.25 || velocity > 0.6;

      let nextIndex = this.getTabIndex(this.currentTab);
      if (movedEnough) {
        if (dx < 0) {
          nextIndex = Math.min(this.tabOrder.length - 1, nextIndex + 1);
        } else if (dx > 0) {
          nextIndex = Math.max(0, nextIndex - 1);
        }
      }

      this.switchTab(this.tabOrder[nextIndex], { animate: true });
    }, { passive: true });

    panels.addEventListener('touchcancel', () => {
      tracking = false;
      this.setTabTransform(this.getTabIndex(this.currentTab), true);
    }, { passive: true });

    window.addEventListener('resize', () => {
      this.setTabTransform(this.getTabIndex(this.currentTab), false);
    });
  }

  switchTab(tab, { animate = true } = {}) {
    if (!this.tabOrder.includes(tab)) return;
    this.currentTab = tab;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    const activeBtn = document.getElementById(`tab-${tab}`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.setAttribute('aria-hidden', panel.id !== `${tab}-tab`);
    });

    document.body.dataset.tab = tab;
    this.setTabTransform(this.getTabIndex(tab), animate);

    // Kalorien-Tab laden wenn ausgewählt
    if (tab === 'calories') {
      this.loadCaloriesTab();
    }
  }

  async loadExercises() {
    const exercises = await storage.getAllExercises();
    const container = document.getElementById('exercises-list');

    if (exercises.length === 0) {
      container.innerHTML = `
        <div class="card p-8 text-center">
          <div class="empty-state-icon tone-primary">
            <span class="material-symbols-outlined text-3xl">fitness_center</span>
          </div>
          <p class="text-gray-600">Noch keine Übungen vorhanden.</p>
          <p class="text-sm text-gray-400 mt-1">Füge deine erste Übung hinzu!</p>
        </div>
      `;
      return;
    }

    let listSectionType = 'main';
    let listLastWasExercise = false;

    container.innerHTML = exercises.map((exercise, index) => {
      const isHeader = exercise.type === 'header';
      const moveUpDisabled = index === 0;
      const moveDownDisabled = index === exercises.length - 1;

      const controls = `
        <div class="flex gap-1 items-start shrink-0 self-start">
          <button onclick="app.moveExercise(${exercise.id}, 'up')"
                  class="icon-btn ${moveUpDisabled ? 'opacity-30 cursor-not-allowed' : ''}"
                  ${moveUpDisabled ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m4.5 15.75 7.5-7.5 7.5 7.5"/>
            </svg>
          </button>
          <button onclick="app.moveExercise(${exercise.id}, 'down')"
                  class="icon-btn ${moveDownDisabled ? 'opacity-30 cursor-not-allowed' : ''}"
                  ${moveDownDisabled ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          <button onclick="app.editExercise(${exercise.id})" class="icon-btn edit-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
          </button>
          <button onclick="app.deleteExercise(${exercise.id})" class="icon-btn delete-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      `;

      if (isHeader) {
        const headerType = this.getHeaderSectionType(exercise.name) || listSectionType;
        const extraGap = listLastWasExercise && listSectionType === 'main' && headerType === 'optional';
        const spacer = extraGap ? '<div class="h-4"></div>' : '';
        listSectionType = headerType;
        listLastWasExercise = false;
        const icon = this.getHeaderIcon(exercise.name);
        return `
          ${spacer}
          <div>
            <div class="header-badge rounded-xl overflow-hidden">
              <div class="flex items-start justify-between px-5 py-4">
                <div class="flex items-center gap-3 min-w-0 pr-3">
                  ${icon}
                  <h3 class="text-lg font-bold text-gray-800 break-words">${exercise.name}</h3>
                </div>
                ${controls}
              </div>
            </div>
          </div>
        `;
      }

      // Anzeige der Zusatzgewichte
      const baseWeight = exercise.baseWeight || 0;
      const additionalPlates = exercise.additionalPlates || 0;
      const calories = exercise.calories || 0;
      let weightDisplay = `${this.formatWeight(baseWeight)} kg`;
      if (additionalPlates > 0) {
        weightDisplay += ` <span class="text-xs text-primary font-semibold">+ ${additionalPlates}x 2.5kg</span>`;
      }
      const totalWeight = baseWeight + (additionalPlates * 2.5);

      listLastWasExercise = true;
      return `
        <div class="card p-4 flex items-start justify-between">
          <div class="flex-1 min-w-0 pr-3">
            <h3 class="font-semibold text-gray-900 break-words">${exercise.name}</h3>
            <div class="text-sm text-gray-500 mt-1">
              <p>${weightDisplay}${additionalPlates > 0 ? ` <span class="text-xs text-gray-400">= ${this.formatWeight(totalWeight)} kg</span>` : ''}</p>
              ${calories > 0 ? `
              <div class="mt-2">
                <span class="kcal-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs">
                  <span class="material-symbols-outlined kcal-icon">local_fire_department</span>
                  ${calories} kcal
                </span>
              </div>
            ` : ''}
            </div>
          </div>
          ${controls}
        </div>
      `;
    }).join('');
  }

  async loadTraining() {
    const training = await storage.getCurrentTraining();
    
    if (!training) {
      document.getElementById('no-training').classList.remove('hidden');
      document.getElementById('active-training').classList.add('hidden');
      return;
    }
    
    document.getElementById('no-training').classList.add('hidden');
    document.getElementById('active-training').classList.remove('hidden');
    this.renderTrainingExercises(training);
  }

  renderTrainingExercises(training) {
    const actualExercises = training.exercises.filter(ex => ex.type !== 'header');
    const completedAll = actualExercises.filter(ex => this.isExerciseCompleted(ex)).length;
    const totalAll = actualExercises.length;
    let mainCompleted = 0;
    let mainTotal = 0;
    let sectionType = 'main';

    training.exercises.forEach((exercise) => {
      if (exercise.type === 'header') {
        const nextSectionType = this.getHeaderSectionType(exercise.name);
        if (nextSectionType) {
          sectionType = nextSectionType;
        }
        return;
      }

      const isCompleted = this.isExerciseCompleted(exercise);
      if (sectionType !== 'optional') {
        mainTotal += 1;
        if (isCompleted) mainCompleted += 1;
      }
    });

    const progressText = document.getElementById('training-progress');
    if (progressText) {
      progressText.textContent = `${mainCompleted} von ${mainTotal} Hauptübungen erledigt`;
    }
    const progressBar = document.getElementById('training-progress-bar');
    const progressTrack = progressBar ? progressBar.closest('.progress-track') : null;
    const percentage = mainTotal === 0 ? 0 : Math.round((mainCompleted / mainTotal) * 100);
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
    if (progressTrack) {
      progressTrack.setAttribute('aria-valuenow', String(percentage));
    }

    const container = document.getElementById('training-exercises');
    const showCompleted = this.showCompletedExercises;
    const fragments = [];
    let pendingHeader = null;
    let pendingHeaderExtraGap = false;
    let renderSectionType = 'main';
    let lastItemWasExercise = false;

    const flushPendingHeader = () => {
      if (!pendingHeader) return;
      if (pendingHeaderExtraGap) {
        fragments.push('<div class="h-4"></div>');
      }
      const icon = this.getHeaderIcon(pendingHeader.name);
      fragments.push(`
        <div>
          <div class="header-badge rounded-xl overflow-hidden">
            <div class="flex items-center gap-3 px-5 py-4">
              ${icon}
              <h3 class="text-lg font-bold text-gray-800">${pendingHeader.name}</h3>
            </div>
          </div>
        </div>
      `);
      pendingHeader = null;
      pendingHeaderExtraGap = false;
    };

    training.exercises.forEach((exercise) => {
      if (exercise.type === 'header') {
        const headerType = this.getHeaderSectionType(exercise.name) || renderSectionType;
        pendingHeaderExtraGap = lastItemWasExercise && renderSectionType === 'main' && headerType === 'optional';
        pendingHeader = exercise;
        renderSectionType = headerType;
        lastItemWasExercise = false;
        return;
      }

      const isCompleted = this.isExerciseCompleted(exercise);

      if (!showCompleted && isCompleted) {
        return;
      }

      if (pendingHeader) {
        flushPendingHeader();
      }

      const cardStateClasses = isCompleted ? 'opacity-70' : '';
      const nameClasses = isCompleted ? 'line-through text-gray-400' : 'text-gray-900';
      const baseWeight = exercise.baseWeight || 0;
      const additionalPlates = exercise.additionalPlates || 0;
      const calories = exercise.calories || 0;

      fragments.push(`
        <div class="card p-5 ${cardStateClasses}">
          <div class="mb-4">
            <h3 class="font-bold text-lg ${nameClasses}">${exercise.name}</h3>
          </div>
          <div class="h-px bg-gray-100 mb-4"></div>
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <label class="text-xs text-gray-500 font-medium w-24">Basisgewicht:</label>
              <div class="flex items-center gap-2">
                <button type="button" onclick="app.adjustTrainingWeight(${exercise.id}, -1, ${isCompleted})"
                  class="weight-adj-btn w-10 h-10 flex items-center justify-center rounded-lg text-lg">-</button>
                <span class="w-16 text-center font-bold text-lg text-primary">${this.formatWeight(baseWeight)} kg</span>
                <button type="button" onclick="app.adjustTrainingWeight(${exercise.id}, 1, ${isCompleted})"
                  class="weight-adj-btn w-10 h-10 flex items-center justify-center rounded-lg text-lg">+</button>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <label class="text-xs text-gray-500 font-medium w-24">Zusatzgewichte:</label>
              <div class="flex gap-2">
                <label class="cursor-pointer">
                  <input type="checkbox" ${additionalPlates >= 1 ? 'checked' : ''}
                    onchange="app.updateTrainingPlates(${exercise.id}, 1, this.checked, ${isCompleted})"
                    class="sr-only peer">
                  <span class="chip inline-flex items-center px-3 py-1.5 rounded-full text-xs peer-checked:active">
                    +2,5 kg
                  </span>
                </label>
                <label class="cursor-pointer">
                  <input type="checkbox" ${additionalPlates >= 2 ? 'checked' : ''}
                    onchange="app.updateTrainingPlates(${exercise.id}, 2, this.checked, ${isCompleted})"
                    class="sr-only peer">
                  <span class="chip inline-flex items-center px-3 py-1.5 rounded-full text-xs peer-checked:active">
                    +2,5 kg
                  </span>
                </label>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-1">
              <span class="text-xs text-gray-500 font-medium w-24">Gesamtgewicht:</span>
              <span class="font-bold text-primary text-lg">${this.formatWeight(baseWeight + (additionalPlates * 2.5))} kg</span>
            </div>
            ${calories > 0 ? `
            <div class="mt-1">
              <span class="kcal-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs">
                <span class="material-symbols-outlined kcal-icon">local_fire_department</span>
                ${calories} kcal
              </span>
            </div>
            ` : ''}
          </div>
          <button
            type="button"
            onclick="app.toggleExercise(${exercise.id}, ${!isCompleted})"
            class="complete-btn w-full mt-5 py-3 rounded-xl text-sm font-semibold text-center ${isCompleted ? 'completed' : ''}">
            ${isCompleted ? '✓ Erledigt' : 'Übung abschließen'}
          </button>
        </div>
      `);
      lastItemWasExercise = true;
    });

    if (fragments.length === 0) {
      const messageIcon = totalAll > 0 ? 'celebration' : 'fitness_center';
      const messageTone = totalAll > 0 ? 'tone-tertiary' : 'tone-primary';
      const messageText = totalAll > 0 ? 'Alle Übungen erledigt!' : 'Keine Übungen verfügbar.';
      const messageHint = totalAll > 0
        ? (showCompleted ? 'Blende erledigte Übungen aus, um nur offene zu sehen.' : 'Blende erledigte Übungen ein, wenn du sie erneut sehen möchtest.')
        : 'Füge Übungen hinzu, um loszulegen.';

      container.innerHTML = `
        <div class="card p-8 text-center">
          <div class="empty-state-icon ${messageTone}">
            <span class="material-symbols-outlined text-3xl">${messageIcon}</span>
          </div>
          <p class="text-gray-600">${messageText}</p>
          <p class="text-sm text-gray-400 mt-2">${messageHint}</p>
        </div>
      `;
    } else {
      container.innerHTML = fragments.join('');
    }

    this.updateToggleCompletedButton(completedAll);
  }

  async toggleCompletedVisibility() {
    this.showCompletedExercises = !this.showCompletedExercises;
    const training = await storage.getCurrentTraining();
    if (training) {
      this.renderTrainingExercises(training);
    }
  }

  updateToggleCompletedButton(completedCount = 0) {
    const button = document.getElementById('toggle-completed-btn');
    if (!button) return;

    const icon = document.getElementById('toggle-completed-icon');
    const isShowing = this.showCompletedExercises;
    if (icon) {
      icon.textContent = isShowing ? 'visibility' : 'visibility_off';
    }
    const titleText = isShowing ? 'Erledigte ausblenden' : 'Erledigte anzeigen';
    button.setAttribute('aria-label', titleText);
    button.setAttribute('title', titleText);
    const shouldDisable = completedCount === 0 && !this.showCompletedExercises;
    button.disabled = shouldDisable;
    button.classList.toggle('active', isShowing);
  }

  isExerciseCompleted(exercise) {
    if (!exercise) return false;
    return this.normalizeCompletedValue(exercise.completed);
  }

  normalizeCompletedValue(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss');
  }

  getHeaderSectionType(name) {
    const normalized = this.normalizeText(name);
    if (normalized.includes('optional')) return 'optional';
    if (normalized.includes('haupt')) return 'main';
    return null;
  }

  getHeaderIcon(name) {
    const normalized = this.normalizeText(name);
    if (normalized.includes('bein') || normalized.includes('leg')) return this.renderHeaderIcon('legs');
    if (normalized.includes('arm') || normalized.includes('oberkoerper') || normalized.includes('upper')) return this.renderHeaderIcon('arms');
    if (normalized.includes('rueck') || normalized.includes('back')) return this.renderHeaderIcon('back');
    if (normalized.includes('bauch') || normalized.includes('core') || normalized.includes('abs')) return this.renderHeaderIcon('core');
    return this.renderHeaderIcon('default');
  }

  renderHeaderIcon(type) {
    const icons = {
      legs: this.wrapIconImg('icons/body-legs.svg', 'Beine'),
      arms: this.wrapIconImg('icons/body-arms.svg', 'Arme'),
      back: this.wrapIconImg('icons/body-back.svg', 'Rücken'),
      core: this.wrapIconImg('icons/body-core.svg', 'Core'),
      default: this.wrapIconImg('icons/body-default.svg', 'Training')
    };

    return icons[type] || icons.default;
  }

  wrapIconImg(src, alt) {
    return `
      <span class="icon-pill flex h-10 w-10 items-center justify-center rounded-xl">
        <img src="${src}" alt="${alt}" class="h-6 w-6" loading="lazy" decoding="async">
      </span>
    `;
  }

  showExerciseModal(exercise = null) {
    this.editingExercise = exercise;
    if (exercise && exercise.type) {
      this.editingType = exercise.type;
    }
    const modal = document.getElementById('exercise-modal');
    const title = document.getElementById('modal-title');
    const nameInput = document.getElementById('exercise-name');
    const weightInput = document.getElementById('exercise-weight');
    const weightField = document.getElementById('weight-field');
    const plate1 = document.getElementById('plate-1');
    const plate2 = document.getElementById('plate-2');
    const caloriesInput = document.getElementById('exercise-calories');

    if (this.editingType === 'header') {
      weightField.style.display = 'none';
      title.textContent = exercise ? 'Überschrift bearbeiten' : 'Neue Überschrift';
    } else {
      weightField.style.display = 'block';
      title.textContent = exercise ? 'Übung bearbeiten' : 'Neue Übung';
    }

    if (exercise) {
      nameInput.value = exercise.name;
      if (this.editingType === 'exercise') {
        weightInput.value = this.formatWeight(exercise.baseWeight || 0);
        const additionalPlates = exercise.additionalPlates || 0;
        if (plate1) plate1.checked = additionalPlates >= 1;
        if (plate2) plate2.checked = additionalPlates >= 2;
        if (caloriesInput) caloriesInput.value = exercise.calories || '';
      }
    } else {
      nameInput.value = '';
      weightInput.value = '';
      if (plate1) plate1.checked = false;
      if (plate2) plate2.checked = false;
      if (caloriesInput) caloriesInput.value = '';
    }

    this.updateTotalWeight();
    modal.classList.remove('hidden');

    if (this.editingType !== 'header') {
      this.initWeightPicker('exercise-weight-picker', 'exercise-weight');
      const weight = exercise ? (exercise.baseWeight || 0) : 0;
      setTimeout(() => this.setPickerValue('exercise-weight-picker', weight), 50);
    }

    nameInput.focus();
  }

  showHeaderModal(header = null) {
    this.editingExercise = header;
    this.editingType = 'header';
    this.showExerciseModal(header);
  }

  hideExerciseModal() {
    document.getElementById('exercise-modal').classList.add('hidden');
    this.editingExercise = null;
    this.editingType = 'exercise';
  }

  async saveExercise(e) {
    e.preventDefault();
    const name = document.getElementById('exercise-name').value.trim();
    const weight = document.getElementById('exercise-weight').value;
    const additionalPlates = this.getAdditionalPlates();
    const caloriesInput = document.getElementById('exercise-calories');
    const calories = caloriesInput ? caloriesInput.value : 0;

    if (!name) return;

    try {
      if (this.editingExercise) {
        await storage.updateExercise(this.editingExercise.id, name, weight, additionalPlates, calories);
      } else {
        if (this.editingType === 'header') {
          await storage.addHeader(name);
        } else {
          await storage.addExercise(name, weight, additionalPlates, calories);
        }
      }

      this.hideExerciseModal();
      await this.loadExercises();

      const training = await storage.getCurrentTraining();
      if (training) {
        await this.loadTraining();
      }
    } catch (error) {
      console.error('Error saving exercise:', error);
    }
  }

  async editExercise(id) {
    const exercises = await storage.getAllExercises();
    const exercise = exercises.find(ex => ex.id === id);
    if (exercise) {
      this.showExerciseModal(exercise);
    }
  }

  async deleteExercise(id) {
    if (confirm('Übung wirklich löschen?')) {
      try {
        await storage.deleteExercise(id);
        await this.loadExercises();
        
        const training = await storage.getCurrentTraining();
        if (training) {
          await this.loadTraining();
        }
      } catch (error) {
        console.error('Error deleting exercise:', error);
      }
    }
  }

  async startTraining() {
    try {
      await storage.startTraining();
      this.showCompletedExercises = false;
      await this.loadTraining();
      this.switchTab('training');
    } catch (error) {
      console.error('Error starting training:', error);
    }
  }

  async endTraining() {
    if (confirm('Training beenden?')) {
      try {
        await storage.endTraining();
        this.showCompletedExercises = false;
        await this.loadTraining();
      } catch (error) {
        console.error('Error ending training:', error);
      }
    }
  }

  async toggleExercise(exerciseId, completed) {
    try {
      const training = await storage.getCurrentTraining();
      const exercise = training.exercises.find(ex => ex.id === exerciseId);
      const completedValue = this.normalizeCompletedValue(completed);
      const baseWeight = exercise.baseWeight || 0;
      const additionalPlates = exercise.additionalPlates || 0;

      // Nur beim Abhaken (completed=true) die Master-Daten aktualisieren
      const saveToMaster = completedValue === true;
      await storage.updateTrainingExercise(exerciseId, baseWeight, completedValue, additionalPlates, saveToMaster);
      await this.loadTraining();
    } catch (error) {
      console.error('Error toggling exercise:', error);
    }
  }

  async updateWeight(exerciseId, weight, completed) {
    try {
      const completedValue = this.normalizeCompletedValue(completed);
      // Nicht in Master-Daten speichern, nur Training-Session
      await storage.updateTrainingExercise(exerciseId, weight, completedValue, 0, false);
      await this.loadTraining();
    } catch (error) {
      console.error('Error updating weight:', error);
    }
  }

  async updateTrainingWeight(exerciseId, weight, completed) {
    try {
      const training = await storage.getCurrentTraining();
      const exercise = training.exercises.find(ex => ex.id === exerciseId);
      const additionalPlates = exercise ? (exercise.additionalPlates || 0) : 0;
      const completedValue = this.normalizeCompletedValue(completed);
      // Nicht in Master-Daten speichern, nur Training-Session
      await storage.updateTrainingExercise(exerciseId, weight, completedValue, additionalPlates, false);
      await this.loadTraining();
    } catch (error) {
      console.error('Error updating training weight:', error);
    }
  }

  async updateTrainingPlates(exerciseId, plateNumber, checked, completed) {
    try {
      const training = await storage.getCurrentTraining();
      const exercise = training.exercises.find(ex => ex.id === exerciseId);
      if (!exercise) return;

      let additionalPlates = exercise.additionalPlates || 0;

      // Logik für cascading checkboxes
      if (plateNumber === 1) {
        if (checked) {
          additionalPlates = Math.max(additionalPlates, 1);
        } else {
          additionalPlates = 0; // Wenn Scheibe 1 deaktiviert, beide deaktivieren
        }
      } else if (plateNumber === 2) {
        if (checked) {
          additionalPlates = 2; // Beide Scheiben aktivieren
        } else {
          additionalPlates = 1; // Nur Scheibe 1 bleibt
        }
      }

      const baseWeight = exercise.baseWeight || 0;
      const completedValue = this.normalizeCompletedValue(completed);
      // Nicht in Master-Daten speichern, nur Training-Session
      await storage.updateTrainingExercise(exerciseId, baseWeight, completedValue, additionalPlates, false);
      await this.loadTraining();
    } catch (error) {
      console.error('Error updating training plates:', error);
    }
  }

  async adjustTrainingWeight(exerciseId, delta, completed) {
    const training = await storage.getCurrentTraining();
    const exercise = training.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const newWeight = Math.max(0, Math.min(200, (exercise.baseWeight || 0) + delta));
    await storage.updateTrainingExercise(exerciseId, newWeight, this.normalizeCompletedValue(completed), exercise.additionalPlates || 0, false);
    await this.loadTraining();
  }

  async exportExercises() {
    try {
      const exportData = await storage.exportExercises();
      this.showToast(`${exportData.exercises.length} Übungen erfolgreich exportiert.`);
    } catch (error) {
      console.error('Error exporting exercises:', error);
      this.showToast('Fehler beim Exportieren der Übungen.', 'error');
    }
  }

  importExercises() {
    document.getElementById('import-file').click();
  }

  async handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const result = await storage.importExercises(file);
      await this.loadExercises();
      
      this.showToast(`Import erfolgreich! ${result.imported} Übungen importiert${result.skipped > 0 ? `, ${result.skipped} übersprungen` : ''}.`);
      
      event.target.value = '';
    } catch (error) {
      console.error('Error importing exercises:', error);
      this.showToast(`Import-Fehler: ${error.message}.`, 'error');
      event.target.value = '';
    }
  }

  async moveExercise(exerciseId, direction) {
    try {
      const success = await storage.moveExercise(exerciseId, direction);
      if (success) {
        await this.loadExercises();
        const training = await storage.getCurrentTraining();
        if (training) {
          await this.loadTraining();
        }
      }
    } catch (error) {
      console.error('Error moving exercise:', error);
    }
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast fixed top-16 left-1/2 transform -translate-x-1/2 px-5 py-3 font-semibold z-50 transition-all duration-300 text-gray-800 ${
      type === 'error' ? 'error' : 'success'
    }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -10px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Kalorien-Tab laden
  async loadCaloriesTab() {
    const training = await storage.getCurrentTraining();

    if (!training) {
      document.getElementById('no-training-calories').classList.remove('hidden');
      document.getElementById('active-calories').classList.add('hidden');
      return;
    }

    document.getElementById('no-training-calories').classList.add('hidden');
    document.getElementById('active-calories').classList.remove('hidden');

    // E-Mail-Adresse laden
    const emailInput = document.getElementById('email-address-input');
    const emailAddress = storage.getEmailAddress();
    if (emailInput) {
      emailInput.value = emailAddress;
    }
    this.updateEmailSettingsUI(emailAddress);

    await this.updateCaloriesDisplay();
  }

  updateEmailSettingsUI(emailValue = '') {
    const trimmed = String(emailValue || '').trim();
    const details = document.getElementById('email-settings');
    const label = document.getElementById('email-settings-label');
    if (details) {
      details.open = trimmed.length === 0;
    }
    if (label) {
      label.textContent = trimmed.length > 0 ? 'E-Mail ändern' : 'E-Mail hinzufügen';
    }
  }

  // E-Mail-Adresse speichern
  saveEmailAddress(email) {
    const trimmed = String(email || '').trim();
    storage.saveEmailAddress(trimmed);
    this.updateEmailSettingsUI(trimmed);
  }

  // Kalorien-Anzeige aktualisieren
  async updateCaloriesDisplay() {
    const summary = await storage.getSessionCaloriesSummary();

    // Gesamtkalorien-Anzeige aktualisieren
    document.getElementById('total-calories-display').textContent = summary.totalCalories;
    document.getElementById('exercise-calories-display').textContent = summary.exerciseCalories;
    document.getElementById('cardio-calories-display').textContent = summary.cardioCalories;

    // Cardio-Liste rendern
    const cardioListContainer = document.getElementById('cardio-list-container');
    const cardioList = document.getElementById('cardio-list');

    if (summary.cardioEntries.length > 0) {
      cardioListContainer.classList.remove('hidden');
      cardioList.innerHTML = summary.cardioEntries.map(entry => `
        <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
          <div>
            <span class="font-semibold text-gray-900">${entry.name}</span>
            <span class="text-sm text-tertiary font-semibold ml-2">${entry.calories} kcal</span>
          </div>
          <button onclick="app.deleteCardioEntry(${entry.id})" class="icon-btn delete-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      `).join('');
    } else {
      cardioListContainer.classList.add('hidden');
    }

    // Krafttraining-Kalorien-Liste rendern
    const exerciseCaloriesContainer = document.getElementById('exercise-calories-container');
    const exerciseCaloriesList = document.getElementById('exercise-calories-list');

    const exercisesWithCalories = summary.completedExercises.filter(ex => ex.calories > 0);

    if (exercisesWithCalories.length > 0) {
      exerciseCaloriesContainer.classList.remove('hidden');
      exerciseCaloriesList.innerHTML = exercisesWithCalories.map(ex => `
        <div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
          <span class="text-gray-900 font-medium">${ex.name}</span>
          <span class="text-sm text-tertiary font-semibold">${ex.calories} kcal</span>
        </div>
      `).join('');
    } else {
      exerciseCaloriesContainer.classList.add('hidden');
    }
  }

  // Cardio-Eintrag hinzufügen
  async addCardioEntry() {
    const nameInput = document.getElementById('cardio-name');
    const caloriesInput = document.getElementById('cardio-calories');

    const name = nameInput.value.trim();
    const calories = parseInt(caloriesInput.value) || 0;

    if (!name || calories <= 0) {
      this.showToast('Bitte Name und Kalorien eingeben', 'error');
      return;
    }

    try {
      await storage.addCardioToSession(name, calories);
      nameInput.value = '';
      caloriesInput.value = '';
      await this.updateCaloriesDisplay();
      this.showToast(`${name} hinzugefügt: ${calories} kcal`);
    } catch (error) {
      console.error('Error adding cardio:', error);
      this.showToast('Fehler beim Hinzufügen', 'error');
    }
  }

  // Schnellauswahl-Cardio hinzufügen
  async addQuickCardio(name, inputId) {
    const caloriesInput = document.getElementById(inputId);
    const calories = parseInt(caloriesInput.value) || 0;

    if (calories <= 0) {
      this.showToast('Bitte Kalorien eingeben', 'error');
      return;
    }

    try {
      await storage.addCardioToSession(name, calories);
      caloriesInput.value = '';
      await this.updateCaloriesDisplay();
      this.showToast(`${name} hinzugefügt: ${calories} kcal`);
    } catch (error) {
      console.error('Error adding quick cardio:', error);
      this.showToast('Fehler beim Hinzufügen', 'error');
    }
  }

  // Cardio-Eintrag löschen
  async deleteCardioEntry(cardioId) {
    try {
      await storage.removeCardioFromSession(cardioId);
      await this.updateCaloriesDisplay();
    } catch (error) {
      console.error('Error deleting cardio:', error);
      this.showToast('Fehler beim Löschen', 'error');
    }
  }

  // Kalorien-Übersicht per E-Mail senden
  async sendCaloriesSummaryEmail() {
    const summary = await storage.getSessionCaloriesSummary();

    if (summary.totalCalories === 0) {
      this.showToast('Keine Kalorien zum Senden vorhanden', 'error');
      return;
    }

    // E-Mail-Adresse aus Eingabefeld holen und speichern
    const emailInput = document.getElementById('email-address-input');
    const emailAddress = emailInput ? emailInput.value.trim() : '';

    if (!emailAddress) {
      this.showToast('Bitte E-Mail-Adresse eingeben', 'error');
      return;
    }

    // E-Mail-Adresse speichern
    storage.saveEmailAddress(emailAddress);

    // Datum formatieren
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // E-Mail-Betreff
    const subject = `Trainings-Dokumentation vom ${dateStr}`;

    // Schön formatierter E-Mail-Body
    let body = '';

    // Header
    body += `TRAININGS-DOKUMENTATION\n`;
    body += `========================\n\n`;

    body += `${dateStr}\n`;
    body += `${timeStr} Uhr\n\n`;

    // Gesamtkalorien-Box
    body += `----------------------------------------\n`;
    body += `GESAMTKALORIEN VERBRANNT: ${summary.totalCalories} kcal\n`;
    body += `----------------------------------------\n\n`;

    // Aufschlüsselung
    body += `Krafttraining: ${summary.exerciseCalories} kcal\n`;
    body += `Cardio: ${summary.cardioCalories} kcal\n\n`;

    // Krafttraining-Details
    const exercisesWithCalories = summary.completedExercises.filter(ex => ex.calories > 0);
    if (exercisesWithCalories.length > 0) {
      body += `-- KRAFTTRAINING --\n\n`;
      exercisesWithCalories.forEach(ex => {
        const dots = '.'.repeat(Math.max(2, 32 - ex.name.length - String(ex.calories).length));
        body += `${ex.name} ${dots} ${ex.calories} kcal\n`;
      });
      body += `\n`;
    }

    // Cardio-Details
    if (summary.cardioEntries.length > 0) {
      body += `-- CARDIO --\n\n`;
      summary.cardioEntries.forEach(entry => {
        const dots = '.'.repeat(Math.max(2, 32 - entry.name.length - String(entry.calories).length));
        body += `${entry.name} ${dots} ${entry.calories} kcal\n`;
      });
      body += `\n`;
    }

    // Footer
    body += `----------------------------------------\n`;
    body += `Gesendet von Krafttraining Tracker\n`;

    // mailto-Link erstellen und öffnen
    const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;

    this.showToast('E-Mail-Client wird geöffnet...');
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
});
