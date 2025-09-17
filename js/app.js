class App {
  constructor() {
    this.currentTab = 'exercises';
    this.editingExercise = null;
    this.editingType = 'exercise';
    this.showCompletedExercises = false;
    this.version = '2.3';
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
      return `
        <div class="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between ${marginTop} ${isHeader ? 'border-l-4 border-gray-400' : ''}">
          <div class="flex-1">
            <h3 class="font-medium ${isHeader ? 'text-lg font-bold text-gray-800 border-b-2 border-gray-400 pb-3' : 'text-gray-900'}">${exercise.name}</h3>
            ${!isHeader ? `<p class="text-sm text-gray-600">${exercise.weight} kg</p>` : ''}
          </div>
          <div class="flex gap-1">
            <button onclick="app.moveExercise(${exercise.id}, 'up')" 
                    class="icon-button text-gray-500 hover:text-gray-700 p-2 ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${index === 0 ? 'disabled' : ''}>
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m4.5 15.75 7.5-7.5 7.5 7.5"/>
              </svg>
            </button>
            <button onclick="app.moveExercise(${exercise.id}, 'down')" 
                    class="icon-button text-gray-500 hover:text-gray-700 p-2 ${index === exercises.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${index === exercises.length - 1 ? 'disabled' : ''}>
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
    const completed = actualExercises.filter(ex => ex.completed).length;
    const total = actualExercises.length;
    
    document.getElementById('training-progress').textContent = `${completed} von ${total} Übungen erledigt`;
    
    const container = document.getElementById('training-exercises');
    const showCompleted = this.showCompletedExercises;
    const fragments = [];
    let pendingHeader = null;

    const flushPendingHeader = () => {
      if (!pendingHeader) return;
      const marginTop = fragments.length > 0 ? 'mt-10' : '';
      fragments.push(`
        <div class="bg-white rounded-lg p-4 ${marginTop} border-l-4 border-gray-400">
          <h3 class="text-lg font-bold text-gray-800 border-b-2 border-gray-400 pb-3">${pendingHeader.name}</h3>
        </div>
      `);
      pendingHeader = null;
    };

    training.exercises.forEach((exercise) => {
      if (exercise.type === 'header') {
        pendingHeader = exercise;
        return;
      }

      if (!showCompleted && exercise.completed) {
        return;
      }

      if (pendingHeader) {
        flushPendingHeader();
      }

      const cardStateClasses = exercise.completed ? 'opacity-75 bg-green-50' : '';
      const nameClasses = exercise.completed ? 'line-through text-gray-500' : 'text-gray-900';

      fragments.push(`
        <div class="bg-white rounded-lg shadow-sm p-4 ${cardStateClasses}">
          <div class="flex items-center gap-3">
            <input 
              type="checkbox" 
              ${exercise.completed ? 'checked' : ''} 
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
                onchange="app.updateWeight(${exercise.id}, this.value, ${exercise.completed})"
                class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
              >
              <span class="text-sm text-gray-600">kg</span>
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
        weightInput.value = exercise.weight;
      }
    } else {
      nameInput.value = '';
      weightInput.value = '';
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
    
    if (!name) return;
    
    try {
      if (this.editingExercise) {
        await storage.updateExercise(this.editingExercise.id, name, weight);
      } else {
        if (this.editingType === 'header') {
          await storage.addHeader(name);
        } else {
          await storage.addExercise(name, weight);
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
      await storage.updateTrainingExercise(exerciseId, exercise.weight, completed);
      await this.loadTraining();
    } catch (error) {
      console.error('Error toggling exercise:', error);
    }
  }

  async updateWeight(exerciseId, weight, completed) {
    try {
      await storage.updateTrainingExercise(exerciseId, weight, completed);
      await this.loadTraining();
    } catch (error) {
      console.error('Error updating weight:', error);
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
