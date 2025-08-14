class Storage {
  constructor() {
    this.dbName = 'KrafttrainingDB';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('exercises')) {
          const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
          exerciseStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('training')) {
          const trainingStore = db.createObjectStore('training', { keyPath: 'id' });
          trainingStore.createIndex('active', 'active', { unique: false });
        }
      };
    });
  }

  async addExercise(name, weight = 0) {
    const exercises = await this.getAllExercises();
    const maxOrder = exercises.length > 0 ? Math.max(...exercises.map(e => e.order || 0)) : -1;
    
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const request = store.add({
        name: name.trim(),
        weight: parseFloat(weight) || 0,
        type: 'exercise',
        order: maxOrder + 1,
        createdAt: new Date()
      });
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addHeader(name) {
    const exercises = await this.getAllExercises();
    const maxOrder = exercises.length > 0 ? Math.max(...exercises.map(e => e.order || 0)) : -1;
    
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const request = store.add({
        name: name.trim(),
        type: 'header',
        order: maxOrder + 1,
        createdAt: new Date()
      });
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllExercises() {
    const transaction = this.db.transaction(['exercises'], 'readonly');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const exercises = request.result;
        exercises.sort((a, b) => (a.order || 0) - (b.order || 0));
        resolve(exercises);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateExercise(id, name, weight) {
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const exercise = getRequest.result;
        if (exercise) {
          exercise.name = name.trim();
          if (exercise.type !== 'header') {
            exercise.weight = parseFloat(weight) || 0;
          }
          exercise.updatedAt = new Date();
          
          const updateRequest = store.put(exercise);
          updateRequest.onsuccess = () => resolve(exercise);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Exercise not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteExercise(id) {
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async startTraining() {
    const exercises = await this.getAllExercises();
    const trainingData = {
      id: 'current',
      active: true,
      startedAt: new Date(),
      exercises: exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        type: ex.type || 'exercise',
        weight: ex.weight || 0,
        completed: ex.type === 'header' ? null : false
      }))
    };

    const transaction = this.db.transaction(['training'], 'readwrite');
    const store = transaction.objectStore('training');
    
    return new Promise((resolve, reject) => {
      const request = store.put(trainingData);
      request.onsuccess = () => resolve(trainingData);
      request.onerror = () => reject(request.error);
    });
  }

  async getCurrentTraining() {
    const transaction = this.db.transaction(['training'], 'readonly');
    const store = transaction.objectStore('training');
    
    return new Promise((resolve, reject) => {
      const request = store.get('current');
      request.onsuccess = () => {
        const training = request.result;
        resolve(training && training.active ? training : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateTrainingExercise(exerciseId, weight, completed) {
    const training = await this.getCurrentTraining();
    if (!training) return null;

    const exercise = training.exercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      exercise.weight = parseFloat(weight) || 0;
      exercise.completed = completed;
      
      if (completed) {
        await this.updateExercise(exerciseId, exercise.name, weight);
      }
    }

    const transaction = this.db.transaction(['training'], 'readwrite');
    const store = transaction.objectStore('training');
    
    return new Promise((resolve, reject) => {
      const request = store.put(training);
      request.onsuccess = () => resolve(training);
      request.onerror = () => reject(request.error);
    });
  }

  async endTraining() {
    const transaction = this.db.transaction(['training'], 'readwrite');
    const store = transaction.objectStore('training');
    
    return new Promise((resolve, reject) => {
      const request = store.delete('current');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async exportExercises() {
    const exercises = await this.getAllExercises();
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      exercises: exercises.map(ex => ({
        name: ex.name,
        type: ex.type || 'exercise',
        weight: ex.type === 'header' ? undefined : ex.weight
      }))
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `krafttraining-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(link.href);
    return exportData;
  }

  async importExercises(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const importData = JSON.parse(e.target.result);
          
          if (!importData.exercises || !Array.isArray(importData.exercises)) {
            throw new Error('Ungültiges Backup-Format');
          }
          
          let importedCount = 0;
          let skippedCount = 0;
          
          for (const exercise of importData.exercises) {
            if (!exercise.name || exercise.name.trim() === '') {
              skippedCount++;
              continue;
            }
            
            try {
              if (exercise.type === 'header') {
                await this.addHeader(exercise.name);
              } else {
                await this.addExercise(exercise.name, exercise.weight || 0);
              }
              importedCount++;
            } catch (error) {
              console.warn(`Fehler beim Importieren von "${exercise.name}":`, error);
              skippedCount++;
            }
          }
          
          resolve({
            imported: importedCount,
            skipped: skippedCount,
            total: importData.exercises.length
          });
        } catch (error) {
          reject(new Error('Fehler beim Lesen der Backup-Datei: ' + error.message));
        }
      };
      
      reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
      reader.readAsText(file);
    });
  }

  async moveExercise(exerciseId, direction) {
    const exercises = await this.getAllExercises();
    const currentIndex = exercises.findIndex(ex => ex.id === exerciseId);
    
    if (currentIndex === -1) return false;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= exercises.length) return false;
    
    const currentExercise = exercises[currentIndex];
    const targetExercise = exercises[newIndex];
    
    const tempOrder = currentExercise.order;
    currentExercise.order = targetExercise.order;
    targetExercise.order = tempOrder;
    
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const updateCurrent = store.put(currentExercise);
      const updateTarget = store.put(targetExercise);
      
      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === 2) resolve(true);
      };
      
      updateCurrent.onsuccess = checkComplete;
      updateTarget.onsuccess = checkComplete;
      updateCurrent.onerror = () => reject(updateCurrent.error);
      updateTarget.onerror = () => reject(updateTarget.error);
    });
  }

  async clearAllExercises() {
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const storage = new Storage();