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
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const request = store.add({
        name: name.trim(),
        weight: parseFloat(weight) || 0,
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
      request.onsuccess = () => resolve(request.result);
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
          exercise.weight = parseFloat(weight) || 0;
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
        weight: ex.weight,
        completed: false
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
}

const storage = new Storage();