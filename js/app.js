class App {
  constructor() {
    this.currentTab = 'exercises';
    this.editingExercise = null;
    this.editingType = 'exercise';
    this.showCompletedExercises = false;
    this.version = '2.5';
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
    await this.loadExercises();
    await this.loadTraining();
  }

  updateVersionBadge() {
    const badge = document.getElementById('version-badge');
    if (badge) {
      badge.textContent = `v${this.version} (c17)`;
    }
  }

  setupEventListeners() {
    document.getElementById('tab-exercises').addEventListener('click', () => this.switchTab('exercises'));
    document.getElementById('tab-training').addEventListener('click', () => this.switchTab('training'));

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

    document.addEventListener('click', (e) => {
      if (e.target.id === 'exercise-modal') {
        this.hideExerciseModal();
      }
    });
  }

  switchTab(tab) {
    this.currentTab = tab;
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(btn => {
      btn.classList.remove('bg-primary', 'text-white');
      btn.classList.add('text-gray-600', 'hover:bg-gray-50');
    });
    
    document.getElementById(`${tab}-tab`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-${tab}`);
    activeBtn.classList.add('bg-primary', 'text-white');
    activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-50');
  }

  async loadExercises() {
    const exercises = await storage.getAllExercises();
    const container = document.getElementById('exercises-list');
    
    if (exercises.length === 0) {
      container.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          <div class="text-4xl mb-2">🏋️‍♂️</div>
          <p>Noch keine Übungen vorhanden.</p>
          <p class="text-sm mt-1">Füge deine erste Übung hinzu!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = exercises.map((exercise, index) => {
      const isHeader = exercise.type === 'header';
      const marginTop = isHeader && index > 0 ? 'mt-10' : '';
      const moveUpDisabled = index === 0;
      const moveDownDisabled = index === exercises.length - 1;

      const controls = `
        <div class="flex gap-1">
          <button onclick="app.moveExercise(${exercise.id}, 'up')" 
                  class="icon-button text-gray-500 hover:text-gray-700 p-2 ${moveUpDisabled ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${moveUpDisabled ? 'disabled' : ''}>
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m4.5 15.75 7.5-7.5 7.5 7.5"/>
            </svg>
          </button>
          <button onclick="app.moveExercise(${exercise.id}, 'down')" 
                  class="icon-button text-gray-500 hover:text-gray-700 p-2 ${moveDownDisabled ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${moveDownDisabled ? 'disabled' : ''}>
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>
          <button onclick="app.editExercise(${exercise.id})" class="icon-button text-blue-500 hover:text-blue-600 p-2">
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
            </svg>
          </button>
          <button onclick="app.deleteExercise(${exercise.id})" class="icon-button text-red-500 hover:text-red-600 p-2">
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      `;

      if (isHeader) {
        const icon = this.getHeaderIcon(exercise.name);
        return `
          <div class="${marginTop}">
            <div class="relative overflow-hidden rounded-xl border border-primary/10 bg-gradient-to-r from-primary/15 via-secondary/10 to-primary/5 shadow-sm">
              <div class="flex items-center justify-between px-5 py-3 bg-white/80 backdrop-blur-sm">
                <div class="flex items-center gap-3">
                  ${icon}
                  <h3 class="text-lg font-semibold text-primary">${exercise.name}</h3>
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
      let weightDisplay = `${this.formatWeight(baseWeight)} kg`;
      if (additionalPlates > 0) {
        weightDisplay += ` <span class="text-xs text-green-600">+ ${additionalPlates}x 2.5kg</span>`;
      }
      const totalWeight = baseWeight + (additionalPlates * 2.5);

      return `
        <div class="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between ${marginTop}">
          <div class="flex-1">
            <h3 class="font-medium text-gray-900">${exercise.name}</h3>
            <p class="text-sm text-gray-600">
              ${weightDisplay}
              ${additionalPlates > 0 ? `<span class="text-xs text-gray-500"> = ${this.formatWeight(totalWeight)} kg</span>` : ''}
            </p>
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
    const completed = actualExercises.filter(ex => this.isExerciseCompleted(ex)).length;
    const total = actualExercises.length;
    
    document.getElementById('training-progress').textContent = `${completed} von ${total} Übungen erledigt`;
    
    const container = document.getElementById('training-exercises');
    const showCompleted = this.showCompletedExercises;
    const fragments = [];
    let pendingHeader = null;

    const flushPendingHeader = () => {
      if (!pendingHeader) return;
      const marginTop = fragments.length > 0 ? 'mt-10' : '';
      const icon = this.getHeaderIcon(pendingHeader.name);
      fragments.push(`
        <div class="${marginTop}">
          <div class="relative overflow-hidden rounded-xl border border-primary/10 bg-gradient-to-r from-primary/15 via-secondary/10 to-primary/5 shadow-sm">
            <div class="flex items-center gap-3 px-5 py-3 bg-white/80 backdrop-blur-sm">
              ${icon}
              <h3 class="text-lg font-semibold text-primary">${pendingHeader.name}</h3>
            </div>
          </div>
        </div>
      `);
      pendingHeader = null;
    };

    training.exercises.forEach((exercise) => {
      if (exercise.type === 'header') {
        pendingHeader = exercise;
        return;
      }

      const isCompleted = this.isExerciseCompleted(exercise);

      if (!showCompleted && isCompleted) {
        return;
      }

      if (pendingHeader) {
        flushPendingHeader();
      }

      const cardStateClasses = isCompleted ? 'opacity-75 bg-green-50' : '';
      const nameClasses = isCompleted ? 'line-through text-gray-500' : 'text-gray-900';
      const baseWeight = exercise.baseWeight || 0;
      const additionalPlates = exercise.additionalPlates || 0;

      fragments.push(`
        <div class="bg-white rounded-lg shadow-sm p-4 ${cardStateClasses}">
          <div class="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              ${isCompleted ? 'checked' : ''}
              onchange="app.toggleExercise(${exercise.id}, this.checked)"
              class="w-5 h-5 text-green-500 rounded focus:ring-green-500"
            >
            <div class="flex-1">
              <h3 class="font-medium ${nameClasses}">${exercise.name}</h3>
            </div>
          </div>
          <div class="flex flex-col gap-2 ml-8">
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600 w-20">Basisgewicht:</label>
              <input
                type="text"
                inputmode="decimal"
                value="${this.formatWeight(baseWeight)}"
                onchange="app.updateTrainingWeight(${exercise.id}, this.value, ${isCompleted})"
                class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
              >
              <span class="text-sm text-gray-600">kg</span>
            </div>
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600 w-20">Zusatzgewichte: </label>
              <div class="flex gap-3">
                <label class="flex items-center gap-1">
                  <input
                    type="checkbox"
                    ${additionalPlates >= 1 ? 'checked' : ''}
                    onchange="app.updateTrainingPlates(${exercise.id}, 1, this.checked, ${isCompleted})"
                    class="w-4 h-4 text-primary rounded focus:ring-primary"
                  >
                  <span class="text-xs text-gray-700">2.5kg</span>
                </label>
                <label class="flex items-center gap-1">
                  <input
                    type="checkbox"
                    ${additionalPlates >= 2 ? 'checked' : ''}
                    onchange="app.updateTrainingPlates(${exercise.id}, 2, this.checked, ${isCompleted})"
                    class="w-4 h-4 text-primary rounded focus:ring-primary"
                  >
                  <span class="text-xs text-gray-700">2.5kg</span>
                </label>
              </div>
            </div>
            <div class="text-xs text-gray-600">
              <span>Gesamtgewicht: </span>
              <span class="font-semibold text-primary">${this.formatWeight(baseWeight + (additionalPlates * 2.5))} kg</span>
            </div>
          </div>
        </div>
      `);
    });

    if (fragments.length === 0) {
      const messageIcon = total > 0 ? '🎉' : '🏋️';
      const messageText = total > 0 ? 'Alle Übungen erledigt!' : 'Keine Übungen verfügbar.';
      const messageHint = total > 0
        ? (showCompleted ? 'Blende erledigte Übungen aus, um nur offene zu sehen.' : 'Blende erledigte Übungen ein, wenn du sie erneut sehen möchtest.')
        : 'Füge Übungen hinzu, um loszulegen.';

      container.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm p-6 text-center text-gray-600">
          <div class="text-4xl mb-2">${messageIcon}</div>
          <p>${messageText}</p>
          <p class="text-sm text-gray-500 mt-1">${messageHint}</p>
        </div>
      `;
    } else {
      container.innerHTML = fragments.join('');
    }

    this.updateToggleCompletedButton(completed);
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

    button.textContent = this.showCompletedExercises ? 'Erledigte ausblenden' : 'Erledigte anzeigen';
    const shouldDisable = completedCount === 0 && !this.showCompletedExercises;
    button.disabled = shouldDisable;
    button.classList.toggle('text-gray-500', !shouldDisable);
    button.classList.toggle('hover:text-gray-700', !shouldDisable);
    button.classList.toggle('text-gray-300', shouldDisable);
    button.classList.toggle('cursor-not-allowed', shouldDisable);
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
      <span class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <img src="${src}" alt="${alt}" class="h-7 w-7" loading="lazy" decoding="async">
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
      }
    } else {
      nameInput.value = '';
      weightInput.value = '';
      if (plate1) plate1.checked = false;
      if (plate2) plate2.checked = false;
    }

    this.updateTotalWeight();
    modal.classList.remove('hidden');
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

    if (!name) return;

    try {
      if (this.editingExercise) {
        await storage.updateExercise(this.editingExercise.id, name, weight, additionalPlates);
      } else {
        if (this.editingType === 'header') {
          await storage.addHeader(name);
        } else {
          await storage.addExercise(name, weight, additionalPlates);
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

  async exportExercises() {
    try {
      const exportData = await storage.exportExercises();
      this.showToast(`${exportData.exercises.length} Übungen erfolgreich exportiert! 📤`);
    } catch (error) {
      console.error('Error exporting exercises:', error);
      this.showToast('Fehler beim Exportieren der Übungen ❌', 'error');
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
      
      this.showToast(`Import erfolgreich! ${result.imported} Übungen importiert${result.skipped > 0 ? `, ${result.skipped} übersprungen` : ''} 📥`);
      
      event.target.value = '';
    } catch (error) {
      console.error('Error importing exercises:', error);
      this.showToast(`Import-Fehler: ${error.message} ❌`, 'error');
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
    toast.className = `fixed top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-lg text-white font-medium z-50 transition-all duration-300 ${
      type === 'error' ? 'bg-red-500' : 'bg-green-500'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new App();
});
