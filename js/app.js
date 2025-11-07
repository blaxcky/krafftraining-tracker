class App {
  constructor() {
    this.currentTab = 'exercises';
    this.editingExercise = null;
    this.editingType = 'exercise';
    this.showCompletedExercises = false;
    this.version = '2.5';
    this.init();
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

      const additionalWeightInfo = [];
      if (exercise.additionalWeight1) additionalWeightInfo.push('+2.5kg');
      if (exercise.additionalWeight2) additionalWeightInfo.push('+2.5kg');
      const additionalWeightText = additionalWeightInfo.length > 0
        ? ` <span class="text-xs text-primary font-semibold">(${additionalWeightInfo.join(' ')})</span>`
        : '';

      return `
        <div class="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between ${marginTop}">
          <div class="flex-1">
            <h3 class="font-medium text-gray-900">${exercise.name}</h3>
            <p class="text-sm text-gray-600">${exercise.weight} kg${additionalWeightText}</p>
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

      fragments.push(`
        <div class="bg-white rounded-lg shadow-sm p-4 ${cardStateClasses}">
          <div class="flex items-center gap-3">
            <input
              type="checkbox"
              ${isCompleted ? 'checked' : ''}
              onchange="app.toggleExercise(${exercise.id}, this.checked)"
              class="w-5 h-5 text-green-500 rounded focus:ring-green-500"
            >
            <div class="flex-1">
              <h3 class="font-medium ${nameClasses}">${exercise.name}</h3>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="number"
                value="${exercise.weight}"
                step="0.5"
                min="0"
                onchange="app.updateWeight(${exercise.id}, this.value, ${isCompleted})"
                class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
              >
              <span class="text-sm text-gray-600">kg</span>
            </div>
          </div>
          <div class="flex items-center gap-3 mt-2 ml-8">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
              <input
                type="checkbox"
                ${exercise.additionalWeight1 ? 'checked' : ''}
                onchange="app.updateAdditionalWeight(${exercise.id}, 'additionalWeight1', this.checked)"
                class="w-3.5 h-3.5 text-primary rounded focus:ring-1 focus:ring-primary"
              >
              <span>+2.5kg</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
              <input
                type="checkbox"
                ${exercise.additionalWeight2 ? 'checked' : ''}
                onchange="app.updateAdditionalWeight(${exercise.id}, 'additionalWeight2', this.checked)"
                class="w-3.5 h-3.5 text-primary rounded focus:ring-1 focus:ring-primary"
              >
              <span>+2.5kg</span>
            </label>
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
    const additionalWeightsField = document.getElementById('additional-weights-field');
    const additionalWeight1Input = document.getElementById('additional-weight-1');
    const additionalWeight2Input = document.getElementById('additional-weight-2');

    if (this.editingType === 'header') {
      weightField.style.display = 'none';
      additionalWeightsField.style.display = 'none';
      title.textContent = exercise ? 'Überschrift bearbeiten' : 'Neue Überschrift';
    } else {
      weightField.style.display = 'block';
      additionalWeightsField.style.display = 'block';
      title.textContent = exercise ? 'Übung bearbeiten' : 'Neue Übung';
    }

    if (exercise) {
      nameInput.value = exercise.name;
      if (this.editingType === 'exercise') {
        weightInput.value = exercise.weight;
        additionalWeight1Input.checked = exercise.additionalWeight1 || false;
        additionalWeight2Input.checked = exercise.additionalWeight2 || false;
      }
    } else {
      nameInput.value = '';
      weightInput.value = '';
      additionalWeight1Input.checked = false;
      additionalWeight2Input.checked = false;
    }

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
    const additionalWeight1 = document.getElementById('additional-weight-1').checked;
    const additionalWeight2 = document.getElementById('additional-weight-2').checked;

    if (!name) return;

    try {
      if (this.editingExercise) {
        await storage.updateExercise(this.editingExercise.id, name, weight, additionalWeight1, additionalWeight2);
      } else {
        if (this.editingType === 'header') {
          await storage.addHeader(name);
        } else {
          await storage.addExercise(name, weight, additionalWeight1, additionalWeight2);
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
      await storage.updateTrainingExercise(
        exerciseId,
        exercise.weight,
        completedValue,
        exercise.additionalWeight1,
        exercise.additionalWeight2
      );
      await this.loadTraining();
    } catch (error) {
      console.error('Error toggling exercise:', error);
    }
  }

  async updateWeight(exerciseId, weight, completed) {
    try {
      const training = await storage.getCurrentTraining();
      const exercise = training.exercises.find(ex => ex.id === exerciseId);
      const completedValue = this.normalizeCompletedValue(completed);
      await storage.updateTrainingExercise(
        exerciseId,
        weight,
        completedValue,
        exercise.additionalWeight1,
        exercise.additionalWeight2
      );
      await this.loadTraining();
    } catch (error) {
      console.error('Error updating weight:', error);
    }
  }

  async updateAdditionalWeight(exerciseId, field, checked) {
    try {
      const training = await storage.getCurrentTraining();
      const exercise = training.exercises.find(ex => ex.id === exerciseId);
      if (!exercise) return;

      const additionalWeight1 = field === 'additionalWeight1' ? checked : exercise.additionalWeight1;
      const additionalWeight2 = field === 'additionalWeight2' ? checked : exercise.additionalWeight2;

      await storage.updateTrainingExercise(
        exerciseId,
        exercise.weight,
        exercise.completed,
        additionalWeight1,
        additionalWeight2
      );
      await this.loadTraining();
    } catch (error) {
      console.error('Error updating additional weight:', error);
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
