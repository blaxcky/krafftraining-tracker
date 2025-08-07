class App {
  constructor() {
    this.currentTab = 'exercises';
    this.editingExercise = null;
    this.init();
  }

  async init() {
    await storage.init();
    this.setupEventListeners();
    await this.loadExercises();
    await this.loadTraining();
  }

  setupEventListeners() {
    document.getElementById('tab-exercises').addEventListener('click', () => this.switchTab('exercises'));
    document.getElementById('tab-training').addEventListener('click', () => this.switchTab('training'));
    
    document.getElementById('add-exercise-btn').addEventListener('click', () => this.showExerciseModal());
    document.getElementById('cancel-btn').addEventListener('click', () => this.hideExerciseModal());
    document.getElementById('exercise-form').addEventListener('submit', (e) => this.saveExercise(e));
    
    document.getElementById('start-training-btn').addEventListener('click', () => this.startTraining());
    document.getElementById('end-training-btn').addEventListener('click', () => this.endTraining());
    
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
    
    container.innerHTML = exercises.map((exercise, index) => `
      <div class="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
        <div class="flex-1">
          <h3 class="font-medium text-gray-900">${exercise.name}</h3>
          <p class="text-sm text-gray-600">${exercise.weight} kg</p>
        </div>
        <div class="flex gap-1">
          <button onclick="app.moveExercise(${exercise.id}, 'up')" 
                  class="text-gray-500 hover:text-gray-700 p-2 ${index === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${index === 0 ? 'disabled' : ''}>
            ↑
          </button>
          <button onclick="app.moveExercise(${exercise.id}, 'down')" 
                  class="text-gray-500 hover:text-gray-700 p-2 ${index === exercises.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}"
                  ${index === exercises.length - 1 ? 'disabled' : ''}>
            ↓
          </button>
          <button onclick="app.editExercise(${exercise.id})" class="text-blue-500 hover:text-blue-600 p-2">
            ✏️
          </button>
          <button onclick="app.deleteExercise(${exercise.id})" class="text-red-500 hover:text-red-600 p-2">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
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
    const completed = training.exercises.filter(ex => ex.completed).length;
    const total = training.exercises.length;
    
    document.getElementById('training-progress').textContent = `${completed} von ${total} Übungen erledigt`;
    
    const container = document.getElementById('training-exercises');
    container.innerHTML = training.exercises.map(exercise => `
      <div class="bg-white rounded-lg shadow-sm p-4 ${exercise.completed ? 'opacity-75 bg-green-50' : ''}">
        <div class="flex items-center gap-3">
          <input 
            type="checkbox" 
            ${exercise.completed ? 'checked' : ''} 
            onchange="app.toggleExercise(${exercise.id}, this.checked)"
            class="w-5 h-5 text-green-500 rounded focus:ring-green-500"
          >
          <div class="flex-1">
            <h3 class="font-medium ${exercise.completed ? 'line-through text-gray-500' : 'text-gray-900'}">${exercise.name}</h3>
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
    `).join('');
  }

  showExerciseModal(exercise = null) {
    this.editingExercise = exercise;
    const modal = document.getElementById('exercise-modal');
    const title = document.getElementById('modal-title');
    const nameInput = document.getElementById('exercise-name');
    const weightInput = document.getElementById('exercise-weight');
    
    if (exercise) {
      title.textContent = 'Übung bearbeiten';
      nameInput.value = exercise.name;
      weightInput.value = exercise.weight;
    } else {
      title.textContent = 'Neue Übung';
      nameInput.value = '';
      weightInput.value = '';
    }
    
    modal.classList.remove('hidden');
    nameInput.focus();
  }

  hideExerciseModal() {
    document.getElementById('exercise-modal').classList.add('hidden');
    this.editingExercise = null;
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
        await storage.addExercise(name, weight);
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