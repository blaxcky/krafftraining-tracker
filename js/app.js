class App {
  constructor() {
    this.currentTab = 'training';
    this.editingExercise = null;
    this.editingType = 'exercise';
    this.showCompletedExercises = false;
    this.plans = [];
    this.currentPlanId = 'default';
    this.startPlanId = 'default';
    this.tabOrder = ['exercises', 'training', 'calories', 'settings'];
    this.version = '2.11.2';
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
    await this.loadPlans();
    await this.loadExercises();
    await this.loadTraining();
    this.loadSettingsTab();
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
    const settingsTabBtn = document.getElementById('tab-settings');
    if (settingsTabBtn) {
      settingsTabBtn.addEventListener('click', () => this.switchTab('settings'));
    }

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
    const settingsEmailInput = document.getElementById('settings-email-input');
    if (settingsEmailInput) {
      settingsEmailInput.addEventListener('change', (e) => this.saveEmailAddress(e.target.value));
    }
    const settingsSaveEmailBtn = document.getElementById('settings-save-email-btn');
    if (settingsSaveEmailBtn) {
      settingsSaveEmailBtn.addEventListener('click', () => this.saveEmailFromSettings());
    }

    document.addEventListener('click', (e) => {
      if (e.target.id === 'exercise-modal') {
        this.hideExerciseModal();
      }
    });

    const planSelect = document.getElementById('plan-select');
    if (planSelect) {
      planSelect.addEventListener('change', (e) => {
        const planId = e.target && e.target.value ? String(e.target.value) : 'default';
        this.setCurrentPlan(planId);
      });
    }

    const startPlanSelect = document.getElementById('start-plan-select');
    if (startPlanSelect) {
      startPlanSelect.addEventListener('change', (e) => {
        const planId = e.target && e.target.value ? String(e.target.value) : 'default';
        this.setStartPlan(planId);
      });
    }

    const newPlanBtn = document.getElementById('plan-new-btn');
    if (newPlanBtn) {
      newPlanBtn.addEventListener('click', () => this.createPlan());
    }
    const renamePlanBtn = document.getElementById('plan-rename-btn');
    if (renamePlanBtn) {
      renamePlanBtn.addEventListener('click', () => this.renameCurrentPlan());
    }
    const deletePlanBtn = document.getElementById('plan-delete-btn');
    if (deletePlanBtn) {
      deletePlanBtn.addEventListener('click', () => this.deleteCurrentPlan());
    }

    this.setupExerciseSwipeGestures();
    window.addEventListener('resize', () => {
      this.setTabTransform(this.getTabIndex(this.currentTab), false);
    });
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

  async loadPlans() {
    try {
      this.plans = await storage.getPlans();
      const savedCurrentPlan = localStorage.getItem('kraft_currentPlanId');
      const currentCandidate = savedCurrentPlan ? String(savedCurrentPlan) : this.currentPlanId;
      this.currentPlanId = this.resolvePlanId(currentCandidate);
      localStorage.setItem('kraft_currentPlanId', this.currentPlanId);

      const savedStartPlan = localStorage.getItem('kraft_startPlanId');
      const startCandidate = savedStartPlan ? String(savedStartPlan) : this.currentPlanId;
      this.startPlanId = this.resolvePlanId(startCandidate);
      localStorage.setItem('kraft_startPlanId', this.startPlanId);

      this.renderPlanSelects();
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  }

  renderPlanSelects() {
    const plans = Array.isArray(this.plans) && this.plans.length > 0
      ? this.plans
      : [{ id: 'default', name: 'Standard' }];

    const planSelect = document.getElementById('plan-select');
    const startPlanSelect = document.getElementById('start-plan-select');
    const optionsHtml = plans
      .map(p => `<option value="${p.id}">${this.escapeHtml(p.name || p.id)}</option>`)
      .join('');

    if (planSelect) {
      planSelect.innerHTML = optionsHtml;
      planSelect.value = this.currentPlanId;
    }
    if (startPlanSelect) {
      startPlanSelect.innerHTML = optionsHtml;
      startPlanSelect.value = this.startPlanId;
    }

    const isDefault = this.currentPlanId === 'default';
    const renameBtn = document.getElementById('plan-rename-btn');
    const deleteBtn = document.getElementById('plan-delete-btn');
    if (renameBtn) renameBtn.disabled = isDefault;
    if (deleteBtn) deleteBtn.disabled = isDefault;
    if (isDefault) {
      if (renameBtn) renameBtn.classList.add('opacity-40', 'cursor-not-allowed');
      if (deleteBtn) deleteBtn.classList.add('opacity-40', 'cursor-not-allowed');
    } else {
      if (renameBtn) renameBtn.classList.remove('opacity-40', 'cursor-not-allowed');
      if (deleteBtn) deleteBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    }
  }

  setCurrentPlan(planId, { refreshExercises = true } = {}) {
    const id = this.resolvePlanId(planId);
    this.currentPlanId = id;
    localStorage.setItem('kraft_currentPlanId', id);
    this.renderPlanSelects();
    if (refreshExercises) {
      void this.loadExercises();
    }
    return id;
  }

  setStartPlan(planId) {
    const id = this.resolvePlanId(planId);
    this.startPlanId = id;
    localStorage.setItem('kraft_startPlanId', id);
    this.renderPlanSelects();
    return id;
  }

  resolvePlanId(planId) {
    const id = String(planId || '').trim() || 'default';
    const exists = Array.isArray(this.plans) && this.plans.some(p => p && p.id === id);
    return exists ? id : 'default';
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async createPlan() {
    const name = prompt('Name für neuen Trainingsplan:');
    if (!name || !String(name).trim()) return;
    try {
      const newId = await storage.addPlan(String(name).trim());
      await this.loadPlans();
      this.setCurrentPlan(newId);
      this.showToast('Trainingsplan erstellt', 'success');
    } catch (error) {
      console.error('Error creating plan:', error);
      this.showToast('Fehler beim Erstellen', 'error');
    }
  }

  async renameCurrentPlan() {
    if (this.currentPlanId === 'default') return;
    const current = Array.isArray(this.plans) ? this.plans.find(p => p && p.id === this.currentPlanId) : null;
    const name = prompt('Neuer Name:', current ? current.name : '');
    if (!name || !String(name).trim()) return;
    try {
      await storage.renamePlan(this.currentPlanId, String(name).trim());
      await this.loadPlans();
      this.showToast('Trainingsplan umbenannt', 'success');
    } catch (error) {
      console.error('Error renaming plan:', error);
      this.showToast('Fehler beim Umbenennen', 'error');
    }
  }

  async deleteCurrentPlan() {
    if (this.currentPlanId === 'default') return;
    const deletedPlanId = this.currentPlanId;
    const current = Array.isArray(this.plans) ? this.plans.find(p => p && p.id === deletedPlanId) : null;
    const name = current ? current.name : this.currentPlanId;
    if (!confirm(`Trainingsplan "${name}" löschen? Alle Übungen dieses Plans werden gelöscht.`)) return;
    try {
      await storage.deletePlan(deletedPlanId);
      await this.loadPlans();
      if (this.startPlanId === deletedPlanId) {
        this.setStartPlan('default');
      }
      this.setCurrentPlan('default');
      this.showToast('Trainingsplan gelöscht', 'success');
    } catch (error) {
      console.error('Error deleting plan:', error);
      this.showToast('Fehler beim Löschen', 'error');
    }
  }

  setupExerciseSwipeGestures() {
    const container = document.getElementById('training-exercises');
    if (!container) return;

    const HOLD_DELAY_MS = 2000;
    const HOLD_MOVE_TOLERANCE = 12;
    const SWIPE_SLOP = 8;
    let tracking = null;

    const wait = (ms) => new Promise(resolve => window.setTimeout(resolve, ms));
    const isControlTarget = (target) => {
      if (!target || !(target instanceof Element)) return false;
      return Boolean(
        target.closest(
          '[data-swipe-ignore], button, a, input, select, textarea, label, [role="button"], [role="switch"]'
        )
      );
    };

    const clearHoldFeedback = (state, { animate = true } = {}) => {
      if (!state || !state.card || !state.swipeRoot) return;
      state.swipeRoot.dataset.holdState = '';
      state.card.classList.remove('is-holding');
      state.card.style.removeProperty('--hold-progress');
      if (animate) {
        state.card.style.transition = 'opacity 0.16s ease';
      }
      state.card.style.opacity = '1';
    };

    const cancelHold = (state, { animate = true, forceClear = false } = {}) => {
      if (!state) return;
      if (state.holdTimerId) {
        window.clearTimeout(state.holdTimerId);
        state.holdTimerId = null;
      }
      if (state.holdRafId) {
        window.cancelAnimationFrame(state.holdRafId);
        state.holdRafId = null;
      }
      if (forceClear || !state.holdTriggered) {
        clearHoldFeedback(state, { animate });
      }
    };

    const startHold = (state) => {
      if (!state || !state.card || !state.swipeRoot) return;
      state.holdStart = performance.now();
      state.swipeRoot.dataset.holdState = 'pressing';
      state.card.classList.add('is-holding');
      state.card.style.setProperty('--hold-progress', '0');

      const tick = () => {
        if (!tracking || tracking !== state || state.actionCommitted || state.holdTriggered) return;
        const elapsed = performance.now() - state.holdStart;
        const progress = Math.min(1, elapsed / HOLD_DELAY_MS);
        state.card.style.setProperty('--hold-progress', progress.toFixed(3));
        state.card.style.opacity = String(Math.max(0.42, 1 - (progress * 0.58)));
        state.holdRafId = window.requestAnimationFrame(tick);
      };

      state.holdRafId = window.requestAnimationFrame(tick);
      state.holdTimerId = window.setTimeout(() => {
        if (!tracking || tracking !== state || state.actionCommitted) return;
        state.holdTriggered = true;
        tracking = null;
        cancelHold(state, { animate: false, forceClear: true });
        state.swipeRoot.dataset.holdState = '';
        const shouldSkip = window.confirm('Übung wirklich überspringen?');
        if (!shouldSkip) {
          state.holdTriggered = false;
          resetCard(state);
          return;
        }
        void commitState(state, 'skipped', 'left');
      }, HOLD_DELAY_MS);
    };

    const resetCard = (state) => {
      if (!state || !state.card || !state.swipeRoot) return;
      cancelHold(state, { animate: true, forceClear: true });
      state.swipeRoot.dataset.swipeDir = '';
      const card = state.card;
      if (!card) return;
      card.style.transition = 'transform 0.24s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease';
      card.style.transform = 'translate3d(0, 0, 0)';
      card.style.opacity = '1';
    };

    const animateCardExit = async (swipeRoot, card, direction = 'right') => {
      if (!swipeRoot || !card) return;

      const sign = direction === 'left' ? -1 : 1;
      const exitDistance = Math.max(160, Math.round(swipeRoot.clientWidth * 0.85)) * sign;
      card.style.transition = 'transform 0.23s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.23s ease';
      card.style.transform = `translate3d(${exitDistance}px, 0, 0) scale(0.98)`;
      card.style.opacity = '0';
      await wait(220);

      const computed = window.getComputedStyle(swipeRoot);
      const height = swipeRoot.offsetHeight;
      const marginTop = parseFloat(computed.marginTop) || 0;
      const marginBottom = parseFloat(computed.marginBottom) || 0;

      swipeRoot.style.height = `${height}px`;
      swipeRoot.style.marginTop = `${marginTop}px`;
      swipeRoot.style.marginBottom = `${marginBottom}px`;
      swipeRoot.style.overflow = 'hidden';
      swipeRoot.style.transition = 'height 0.24s cubic-bezier(0.22, 1, 0.36, 1), margin 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease';
      swipeRoot.offsetHeight;
      swipeRoot.style.height = '0px';
      swipeRoot.style.marginTop = '0px';
      swipeRoot.style.marginBottom = '0px';
      swipeRoot.style.opacity = '0';
      await wait(240);
    };

    const commitState = async (state, action, direction = 'right') => {
      if (!state || state.actionCommitted || !state.swipeRoot || !state.card) return;
      state.actionCommitted = true;
      tracking = null;
      cancelHold(state, { animate: false });
      state.swipeRoot.dataset.holdState = '';
      state.swipeRoot.dataset.swipeDir = '';
      state.swipeRoot.dataset.animating = 'true';
      try {
        await animateCardExit(state.swipeRoot, state.card, direction);
        await this.setExerciseState(state.exerciseId, action);
      } finally {
        state.swipeRoot.dataset.animating = '';
      }
    };

    container.addEventListener('pointerdown', (event) => {
      if (tracking) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      const modal = document.getElementById('exercise-modal');
      if (modal && !modal.classList.contains('hidden')) return;
      const startedOnControl = isControlTarget(event.target);

      const swipeRoot = event.target.closest('.exercise-swipe');
      if (!swipeRoot) return;
      if (swipeRoot.dataset.animating === 'true') return;
      if (swipeRoot.dataset.exerciseDone === 'true') return;

      const exerciseId = Number(swipeRoot.dataset.trainingExerciseId);
      if (!Number.isFinite(exerciseId)) return;

      const card = swipeRoot.querySelector('.exercise-swipe-card');
      if (!card) return;

      tracking = {
        pointerId: event.pointerId,
        swipeRoot,
        card,
        exerciseId,
        startX: event.clientX,
        startY: event.clientY,
        lastDx: 0,
        isHorizontal: null,
        holdStart: 0,
        holdTimerId: null,
        holdRafId: null,
        holdTriggered: false,
        actionCommitted: false,
        startedOnControl
      };
      swipeRoot.dataset.swipeDir = '';
      swipeRoot.dataset.holdState = '';
      card.style.transition = 'none';
      card.style.transform = 'translate3d(0, 0, 0)';
      card.style.opacity = '1';

      try {
        swipeRoot.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture not supported by all devices, continue without it.
      }

      if (!startedOnControl) {
        startHold(tracking);
      }
    });

    container.addEventListener('pointermove', (event) => {
      if (!tracking) return;
      if (event.pointerId !== tracking.pointerId) return;
      if (tracking.actionCommitted || tracking.holdTriggered) return;

      const dx = event.clientX - tracking.startX;
      const dy = event.clientY - tracking.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > HOLD_MOVE_TOLERANCE || absY > HOLD_MOVE_TOLERANCE) {
        cancelHold(tracking);
      }

      if (tracking.isHorizontal === null) {
        const slop = tracking.startedOnControl ? 18 : SWIPE_SLOP;
        if (absX < slop && absY < slop) return;
        tracking.isHorizontal = absX > absY * 1.15;
      }

      if (!tracking.isHorizontal) return;
      cancelHold(tracking, { animate: false });
      if (event.cancelable) event.preventDefault();

      const max = Math.min(160, tracking.swipeRoot.clientWidth * 0.45);
      const clamped = Math.max(-max, Math.min(max, dx));
      tracking.lastDx = clamped;

      tracking.card.style.transition = 'none';
      tracking.card.style.transform = `translate3d(${clamped}px, 0, 0)`;
      tracking.card.style.opacity = '1';
      tracking.swipeRoot.dataset.swipeDir = clamped > 0 ? 'right' : (clamped < 0 ? 'left' : '');
    });

    const finishPointer = (event, cancelled = false) => {
      if (!tracking) return;
      if (event.pointerId !== tracking.pointerId) return;
      const state = tracking;
      tracking = null;

      cancelHold(state);
      state.swipeRoot.dataset.holdState = '';

      try {
        state.swipeRoot.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Nothing to release if pointer capture was never acquired.
      }

      if (cancelled || state.actionCommitted || state.holdTriggered) return;

      const threshold = Math.min(110, state.swipeRoot.clientWidth * 0.22);
      const abs = Math.abs(state.lastDx);

      if (!state.isHorizontal || abs < threshold) {
        resetCard(state);
        return;
      }

      const direction = state.lastDx >= 0 ? 'right' : 'left';
      void commitState(state, 'completed', direction);
    };

    container.addEventListener('pointerup', (event) => {
      finishPointer(event, false);
    });
    container.addEventListener('pointercancel', (event) => {
      finishPointer(event, true);
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
    if (tab === 'settings') {
      this.loadSettingsTab();
    }
  }

  async loadExercises() {
    const exercises = await storage.getAllExercises(this.currentPlanId);
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

      const exerciseControls = `
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
      const headerControls = `
        <div class="header-actions-grid" role="group" aria-label="Abschnitt Aktionen">
          <button onclick="app.moveExercise(${exercise.id}, 'up')"
                  class="icon-btn header-action-btn ${moveUpDisabled ? 'opacity-30 cursor-not-allowed' : ''}"
                  ${moveUpDisabled ? 'disabled' : ''}
                  title="Nach oben">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m4.5 15.75 7.5-7.5 7.5 7.5"/>
            </svg>
          </button>
          <button onclick="app.moveExercise(${exercise.id}, 'down')"
                  class="icon-btn header-action-btn ${moveDownDisabled ? 'opacity-30 cursor-not-allowed' : ''}"
                  ${moveDownDisabled ? 'disabled' : ''}
                  title="Nach unten">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          <button onclick="app.editExercise(${exercise.id})" class="icon-btn edit-btn header-action-btn" title="Bearbeiten">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
          </button>
          <button onclick="app.deleteExercise(${exercise.id})" class="icon-btn delete-btn header-action-btn" title="Löschen">
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
              <div class="header-badge__row px-5 pt-4 pb-5">
                <div class="header-badge__title">
                  ${icon}
                  <h3 class="text-lg font-bold text-gray-800 leading-tight">${exercise.name}</h3>
                </div>
                <div class="header-badge__controls">${headerControls}</div>
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
          ${exerciseControls}
        </div>
      `;
    }).join('');
  }

  async loadTraining() {
    const training = await storage.getCurrentTraining();
    
    if (!training) {
      document.getElementById('no-training').classList.remove('hidden');
      document.getElementById('active-training').classList.add('hidden');
      const badge = document.getElementById('training-plan-badge');
      if (badge) badge.classList.add('hidden');
      return;
    }
    
    document.getElementById('no-training').classList.add('hidden');
    document.getElementById('active-training').classList.remove('hidden');
    this.renderTrainingExercises(training);
    const badge = document.getElementById('training-plan-badge');
    if (badge) {
      const planName = (training.planName || '').trim();
      const nameEl = badge.querySelector('.plan-chip__name');
      if (nameEl) {
        nameEl.textContent = planName;
      } else {
        badge.textContent = planName ? `Plan: ${planName}` : '';
      }
      if (planName) {
        badge.title = `Plan: ${planName}`;
      } else {
        badge.removeAttribute('title');
      }
      badge.classList.toggle('hidden', !planName);
    }
    this.setTabTransform(this.getTabIndex(this.currentTab), false);
  }

  async refreshTrainingPreserveScroll() {
    const scrollContainer = document.getElementById('training-tab');
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
    await this.loadTraining();
    requestAnimationFrame(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollTop;
      } else {
        window.scrollTo(0, scrollTop);
      }
    });
  }

  renderTrainingExercises(training) {
    const exercises = Array.isArray(training && training.exercises)
      ? training.exercises.filter(ex => ex && typeof ex === 'object')
      : [];
    const actualExercises = exercises.filter(ex => ex.type !== 'header');
    const completedAll = actualExercises.filter(ex => this.isExerciseDone(ex)).length;
    const totalAll = actualExercises.length;
    let mainCompleted = 0;
    let mainTotal = 0;
    let sectionType = 'main';

    exercises.forEach((exercise) => {
      if (exercise.type === 'header') {
        const nextSectionType = this.getHeaderSectionType(exercise.name);
        if (nextSectionType) {
          sectionType = nextSectionType;
        }
        return;
      }

      const isCompleted = this.isExerciseDone(exercise);
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
              <h3 class="text-lg font-bold text-gray-800 leading-tight">${pendingHeader.name}</h3>
            </div>
          </div>
        </div>
      `);
      pendingHeader = null;
      pendingHeaderExtraGap = false;
    };

    exercises.forEach((exercise) => {
      if (exercise.type === 'header') {
        const headerType = this.getHeaderSectionType(exercise.name) || renderSectionType;
        pendingHeaderExtraGap = lastItemWasExercise && renderSectionType === 'main' && headerType === 'optional';
        pendingHeader = exercise;
        renderSectionType = headerType;
        lastItemWasExercise = false;
        return;
      }

      const isCompleted = this.isExerciseDone(exercise);
      const isSkipped = this.isExerciseSkipped(exercise);

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
      const stateLabel = isCompleted
        ? (isSkipped ? 'Übersprungen' : 'Erledigt')
        : '';
      const stateLabelTone = isSkipped
        ? 'bg-gray-100 text-gray-700 border-gray-200'
        : 'bg-emerald-50 text-emerald-800 border-emerald-100';

      fragments.push(`
        <div class="exercise-swipe" data-training-exercise-id="${exercise.id}" data-exercise-done="${isCompleted ? 'true' : 'false'}">
          <div class="exercise-swipe-bg exercise-swipe-bg--complete exercise-swipe-bg--left" aria-hidden="true">
            <span class="material-symbols-outlined">done</span>
            <span>Erledigt</span>
          </div>
          <div class="exercise-swipe-bg exercise-swipe-bg--complete exercise-swipe-bg--right" aria-hidden="true">
            <span>Erledigt</span>
            <span class="material-symbols-outlined">done</span>
          </div>
          <div class="card p-4 exercise-swipe-card ${cardStateClasses}">
            <div class="flex items-start justify-between gap-3 mb-2">
              <div class="flex items-start gap-2 min-w-0">
                <span class="material-symbols-outlined text-[18px] leading-none mt-0.5 opacity-70 text-primary-dark" aria-hidden="true">fitness_center</span>
                <h3 class="font-semibold text-base leading-snug min-w-0 ${nameClasses}">${exercise.name}</h3>
              </div>
              <div class="flex items-center gap-2">
                ${stateLabel ? `
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold border ${stateLabelTone}">
                    ${stateLabel}
                  </span>
                ` : ''}
                ${isCompleted ? `
                  <button type="button" data-swipe-ignore onclick="app.setExerciseState(${exercise.id}, 'open')"
                    class="icon-btn h-9 w-9 rounded-xl flex items-center justify-center"
                    aria-label="Zurücksetzen" title="Zurücksetzen">
                    <span class="material-symbols-outlined text-base">restart_alt</span>
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="training-divider mb-3"></div>
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <label class="text-xs text-black font-medium w-24">Basisgewicht:</label>
                <div class="flex items-center gap-2">
                  <button type="button" onclick="app.adjustTrainingWeight(${exercise.id}, -1)"
                    class="weight-adj-btn w-9 h-9 flex items-center justify-center rounded-lg text-base">-</button>
                  <span class="w-16 text-center font-bold text-base text-black">${this.formatWeight(baseWeight)} kg</span>
                  <button type="button" onclick="app.adjustTrainingWeight(${exercise.id}, 1)"
                    class="weight-adj-btn w-9 h-9 flex items-center justify-center rounded-lg text-base">+</button>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <label class="text-xs text-gray-500 font-medium w-24">Zusatzgewichte:</label>
                <div class="flex gap-2">
                  <label class="cursor-pointer">
                    <input type="checkbox" ${additionalPlates >= 1 ? 'checked' : ''}
                      onchange="app.updateTrainingPlates(${exercise.id}, 1, this.checked)"
                      class="sr-only peer">
                    <span class="chip inline-flex items-center px-3 py-1 rounded-full text-xs peer-checked:active">
                      +2,5 kg
                    </span>
                  </label>
                  <label class="cursor-pointer">
                    <input type="checkbox" ${additionalPlates >= 2 ? 'checked' : ''}
                      onchange="app.updateTrainingPlates(${exercise.id}, 2, this.checked)"
                      class="sr-only peer">
                    <span class="chip inline-flex items-center px-3 py-1 rounded-full text-xs peer-checked:active">
                      +2,5 kg
                    </span>
                  </label>
                </div>
              </div>
              <div class="flex items-center gap-3 mt-0.5">
                <span class="text-xs text-black font-medium w-24">Gesamtgewicht:</span>
                <span class="font-bold text-black text-base">${this.formatWeight(baseWeight + (additionalPlates * 2.5))} kg</span>
              </div>
              ${calories > 0 ? `
              <div class="mt-0.5">
                <span class="kcal-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs">
                  <span class="material-symbols-outlined kcal-icon">local_fire_department</span>
                  ${calories} kcal
                </span>
              </div>
              ` : ''}
            </div>
          </div>
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

  isExerciseSkipped(exercise) {
    if (!exercise) return false;
    return this.normalizeSkippedValue(exercise.skipped);
  }

  isExerciseDone(exercise) {
    return this.isExerciseCompleted(exercise) || this.isExerciseSkipped(exercise);
  }

  normalizeCompletedValue(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  normalizeSkippedValue(value) {
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
          await storage.addHeader(name, this.currentPlanId);
        } else {
          await storage.addExercise(name, weight, additionalPlates, calories, this.currentPlanId);
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
    const exercises = await storage.getAllExercises(this.currentPlanId);
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
      const select = document.getElementById('start-plan-select');
      const selectedPlanId = select && select.value ? String(select.value) : this.startPlanId;
      const planId = this.setStartPlan(selectedPlanId);
      await storage.startTraining(planId);
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
      await this.setExerciseState(exerciseId, this.normalizeCompletedValue(completed) ? 'completed' : 'open');
    } catch (error) {
      console.error('Error toggling exercise:', error);
    }
  }

  async setExerciseState(exerciseId, state) {
    try {
      const training = await storage.getCurrentTraining();
      if (!training || !Array.isArray(training.exercises)) {
        this.showToast('Kein aktives Training gefunden.', 'error');
        return;
      }

      const normalizedId = Number(exerciseId);
      if (!Number.isFinite(normalizedId)) {
        this.showToast('Ungültige Übung-ID.', 'error');
        return;
      }
      const exercise = training.exercises.find(ex => ex && ex.id === normalizedId);
      if (!exercise) {
        this.showToast('Übung nicht gefunden.', 'error');
        return;
      }

      const baseWeight = exercise.baseWeight || 0;
      const additionalPlates = exercise.additionalPlates || 0;
      const completedParam = state === 'skipped' ? 'skipped' : (state === 'completed');
      const saveToMaster = state === 'completed';

      await storage.updateTrainingExercise(normalizedId, baseWeight, completedParam, additionalPlates, saveToMaster);
      await this.refreshTrainingPreserveScroll();

      if (state === 'completed') this.showToast('✓ Erledigt', 'success');
      if (state === 'skipped') this.showToast('Übung übersprungen', 'success');
    } catch (error) {
      console.error('Error setting exercise state:', error);
    }
  }

  async updateWeight(exerciseId, weight) {
    try {
      const training = await storage.getCurrentTraining();
      const exercise = training && Array.isArray(training.exercises)
        ? training.exercises.find(ex => ex && ex.id === exerciseId)
        : null;
      const additionalPlates = exercise ? (exercise.additionalPlates || 0) : 0;
      // Nicht in Master-Daten speichern, nur Training-Session
      await storage.updateTrainingExercise(exerciseId, weight, undefined, additionalPlates, false);
      await this.refreshTrainingPreserveScroll();
    } catch (error) {
      console.error('Error updating training weight:', error);
    }
  }

  async updateTrainingWeight(exerciseId, weight) {
    try {
      const training = await storage.getCurrentTraining();
      const exercise = training.exercises.find(ex => ex.id === exerciseId);
      const additionalPlates = exercise ? (exercise.additionalPlates || 0) : 0;
      // Nicht in Master-Daten speichern, nur Training-Session
      await storage.updateTrainingExercise(exerciseId, weight, undefined, additionalPlates, false);
      await this.refreshTrainingPreserveScroll();
    } catch (error) {
      console.error('Error updating training weight:', error);
    }
  }

  async updateTrainingPlates(exerciseId, plateNumber, checked) {
    try {
      const training = await storage.getCurrentTraining();
      if (!training || !Array.isArray(training.exercises)) {
        this.showToast('Kein aktives Training gefunden.', 'error');
        return;
      }

      const normalizedId = Number(exerciseId);
      const exercise = training.exercises.find(ex => ex && ex.id === normalizedId);
      if (!exercise) {
        console.warn('Training exercise not found for plates update:', exerciseId);
        this.showToast('Übung nicht gefunden.', 'error');
        return;
      }

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
      // Nicht in Master-Daten speichern, nur Training-Session
      await storage.updateTrainingExercise(normalizedId, baseWeight, undefined, additionalPlates, false);
      await this.refreshTrainingPreserveScroll();
    } catch (error) {
      console.error('Error updating training plates:', error);
      this.showToast('Fehler beim Aktualisieren der Zusatzgewichte.', 'error');
    }
  }

  async adjustTrainingWeight(exerciseId, delta) {
    const training = await storage.getCurrentTraining();
    const exercise = training.exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;

    const newWeight = Math.max(0, Math.min(200, (exercise.baseWeight || 0) + delta));
    await storage.updateTrainingExercise(exerciseId, newWeight, undefined, exercise.additionalPlates || 0, false);
    await this.refreshTrainingPreserveScroll();
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
      await this.loadPlans();
      await this.loadExercises();
      
      this.showToast(`Import erfolgreich! ${result.imported} Übungen importiert${result.skipped > 0 ? `, ${result.skipped} übersprungen` : ''}. Vorherige Übungen wurden ersetzt.`);
      
      event.target.value = '';
    } catch (error) {
      console.error('Error importing exercises:', error);
      this.showToast(`Import-Fehler: ${error.message}.`, 'error');
      event.target.value = '';
    }
  }

  async moveExercise(exerciseId, direction) {
    try {
      const success = await storage.moveExercise(exerciseId, direction, this.currentPlanId);
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

    await this.updateCaloriesDisplay();
  }

  loadSettingsTab() {
    const emailAddress = storage.getEmailAddress();
    const emailInput = document.getElementById('settings-email-input');
    if (emailInput && document.activeElement !== emailInput) {
      emailInput.value = emailAddress;
    }
    this.updateEmailSettingsUI(emailAddress);
  }

  updateEmailSettingsUI(emailValue = '') {
    const trimmed = String(emailValue || '').trim();
    const status = document.getElementById('settings-email-status');
    if (status) {
      status.textContent = trimmed.length > 0
        ? `Aktuell hinterlegt: ${trimmed}`
        : 'Noch keine E-Mail hinterlegt';
    }
  }

  saveEmailFromSettings() {
    const emailInput = document.getElementById('settings-email-input');
    const emailAddress = emailInput ? String(emailInput.value || '').trim() : '';
    this.saveEmailAddress(emailAddress);
    this.showToast(emailAddress ? 'E-Mail gespeichert' : 'E-Mail entfernt');
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

    const total = Number(summary.totalCalories) || 0;
    const strength = Number(summary.exerciseCalories) || 0;
    const cardio = Number(summary.cardioCalories) || 0;
    const hasAny = total > 0;
    const strengthPct = hasAny ? Math.round((strength / total) * 100) : 0;
    const cardioPct = hasAny ? Math.max(0, 100 - strengthPct) : 0;

    const strengthPercentEl = document.getElementById('exercise-calories-percent');
    const cardioPercentEl = document.getElementById('cardio-calories-percent');
    if (strengthPercentEl) strengthPercentEl.textContent = `${strengthPct}%`;
    if (cardioPercentEl) cardioPercentEl.textContent = `${cardioPct}%`;

    const splitBar = document.getElementById('calories-split-bar');
    const strengthBar = document.getElementById('calories-split-strength');
    const cardioBar = document.getElementById('calories-split-cardio');
    if (splitBar) splitBar.dataset.empty = hasAny ? 'false' : 'true';
    if (strengthBar && cardioBar) {
      if (!hasAny) {
        strengthBar.style.width = '50%';
        cardioBar.style.width = '50%';
      } else {
        strengthBar.style.width = `${strengthPct}%`;
        cardioBar.style.width = `${cardioPct}%`;
      }
    }

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

  async addQuickCardioBatch() {
    const quickEntries = [
      { name: 'Crosstrainer', inputId: 'quick-cardio-crosstrainer' },
      { name: 'Ergometer', inputId: 'quick-cardio-ergometer' }
    ];

    const entriesToAdd = quickEntries
      .map((entry) => {
        const input = document.getElementById(entry.inputId);
        const calories = parseInt(input && input.value, 10) || 0;
        return {
          ...entry,
          input,
          calories
        };
      })
      .filter(entry => entry.calories > 0);

    if (entriesToAdd.length === 0) {
      this.showToast('Bitte mindestens einen Wert > 0 eingeben', 'error');
      return;
    }

    try {
      for (const entry of entriesToAdd) {
        await storage.addCardioToSession(entry.name, entry.calories);
      }

      entriesToAdd.forEach((entry) => {
        if (entry.input) entry.input.value = '';
      });

      const totalCalories = entriesToAdd.reduce((sum, entry) => sum + entry.calories, 0);
      await this.updateCaloriesDisplay();

      if (entriesToAdd.length === 1) {
        const single = entriesToAdd[0];
        this.showToast(`${single.name} hinzugefügt: ${single.calories} kcal`);
      } else {
        this.showToast(`${entriesToAdd.length} Cardio-Einträge hinzugefügt: ${totalCalories} kcal`);
      }
    } catch (error) {
      console.error('Error adding quick cardio batch:', error);
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

    // E-Mail-Adresse aus Einstellungen holen
    const settingsInput = document.getElementById('settings-email-input');
    const pendingEmail = settingsInput ? settingsInput.value.trim() : '';
    const emailAddress = pendingEmail || storage.getEmailAddress().trim();

    if (!emailAddress) {
      this.showToast('Bitte E-Mail in Einstellungen hinterlegen', 'error');
      return;
    }

    // E-Mail-Adresse speichern
    this.saveEmailAddress(emailAddress);

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
