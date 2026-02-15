class Storage {
  constructor() {
    this.dbName = 'KrafttrainingDB';
    this.dbVersion = 2;
    this.db = null;
  }

  // Hilfsfunktion: Konvertiert Komma zu Punkt und parst das Gewicht
  parseWeight(weight) {
    if (typeof weight === 'number') return weight;
    if (!weight) return 0;
    const normalized = String(weight).replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  // Hilfsfunktion: Formatiert Gewicht mit Punkt
  formatWeight(weight) {
    const num = this.parseWeight(weight);
    return String(num).replace(',', '.');
  }

  // Berechnet das Gesamtgewicht basierend auf Basisgewicht und Zusatzscheiben
  calculateTotalWeight(baseWeight, additionalPlates = 0) {
    const base = this.parseWeight(baseWeight);
    const plates = parseInt(additionalPlates) || 0;
    return base + (plates * 2.5);
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
        const tx = event.target.transaction;

        let exerciseStore = null;
        if (!db.objectStoreNames.contains('exercises')) {
          exerciseStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
          exerciseStore.createIndex('name', 'name', { unique: false });
        } else {
          exerciseStore = tx.objectStore('exercises');
        }
        if (exerciseStore && !exerciseStore.indexNames.contains('planId')) {
          exerciseStore.createIndex('planId', 'planId', { unique: false });
        }

        if (!db.objectStoreNames.contains('training')) {
          const trainingStore = db.createObjectStore('training', { keyPath: 'id' });
          trainingStore.createIndex('active', 'active', { unique: false });
        }

        let plansStore = null;
        if (!db.objectStoreNames.contains('plans')) {
          plansStore = db.createObjectStore('plans', { keyPath: 'id' });
        } else {
          plansStore = tx.objectStore('plans');
        }

        // Default plan + migration: existing exercises belong to "default".
        try {
          if (plansStore) {
            plansStore.get('default').onsuccess = (e) => {
              const existing = e.target.result;
              if (!existing) {
                try {
                  plansStore.add({
                    id: 'default',
                    name: 'Standard',
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });
                } catch (error) {
                  // ignore
                }
              }
            };
          }

          if (exerciseStore) {
            exerciseStore.openCursor().onsuccess = (e) => {
              const cursor = e.target.result;
              if (!cursor) return;
              const value = cursor.value;
              if (value && typeof value.planId === 'undefined') {
                value.planId = 'default';
                cursor.update(value);
              }
              cursor.continue();
            };
          }
        } catch (error) {
          console.warn('Upgrade migration warning:', error);
        }
      };
    });
  }

  generatePlanId() {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (error) {
      // ignore
    }
    return `plan_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  async getPlans() {
    const transaction = this.db.transaction(['plans'], 'readonly');
    const store = transaction.objectStore('plans');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const plans = Array.isArray(request.result) ? request.result : [];
        plans.sort((a, b) => {
          const ta = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return ta - tb;
        });
        resolve(plans);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getPlanById(planId) {
    const id = String(planId || '').trim() || 'default';
    const transaction = this.db.transaction(['plans'], 'readonly');
    const store = transaction.objectStore('plans');

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async addPlan(name) {
    const planName = String(name || '').trim();
    if (!planName) throw new Error('Plan name required');

    const transaction = this.db.transaction(['plans'], 'readwrite');
    const store = transaction.objectStore('plans');
    const id = this.generatePlanId();
    const now = new Date();

    return new Promise((resolve, reject) => {
      const request = store.add({
        id,
        name: planName,
        createdAt: now,
        updatedAt: now
      });
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async renamePlan(planId, name) {
    const id = String(planId || '').trim();
    const planName = String(name || '').trim();
    if (!id) throw new Error('Plan id required');
    if (!planName) throw new Error('Plan name required');

    const transaction = this.db.transaction(['plans'], 'readwrite');
    const store = transaction.objectStore('plans');

    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const plan = getReq.result;
        if (!plan) return reject(new Error('Plan not found'));
        plan.name = planName;
        plan.updatedAt = new Date();
        const putReq = store.put(plan);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async deletePlan(planId) {
    const id = String(planId || '').trim();
    if (!id) throw new Error('Plan id required');
    if (id === 'default') throw new Error('Default plan cannot be deleted');

    const transaction = this.db.transaction(['plans', 'exercises'], 'readwrite');
    const plansStore = transaction.objectStore('plans');
    const exercisesStore = transaction.objectStore('exercises');

    return new Promise((resolve, reject) => {
      const delReq = plansStore.delete(id);
      delReq.onerror = () => reject(delReq.error);

      const idx = exercisesStore.indexNames.contains('planId') ? exercisesStore.index('planId') : null;
      if (!idx) {
        const scan = exercisesStore.openCursor();
        scan.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          const ex = cursor.value;
          if (ex && ex.planId === id) cursor.delete();
          cursor.continue();
        };
        scan.onerror = () => reject(scan.error);
      } else {
        const cursorReq = idx.openCursor(IDBKeyRange.only(id));
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) return;
          cursor.delete();
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || delReq.error);
      transaction.onabort = () => reject(transaction.error || delReq.error);
    });
  }

  async addExercise(name, weight = 0, additionalPlates = 0, calories = 0, planId = 'default') {
    const exercises = await this.getAllExercises(planId);
    const maxOrder = exercises.length > 0 ? Math.max(...exercises.map(e => e.order || 0)) : -1;

    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');

    return new Promise((resolve, reject) => {
      const baseWeight = this.parseWeight(weight);
      const plates = parseInt(additionalPlates) || 0;
      const totalWeight = this.calculateTotalWeight(baseWeight, plates);

      const request = store.add({
        name: name.trim(),
        baseWeight: baseWeight,
        additionalPlates: plates,
        weight: totalWeight, // Für Rückwärtskompatibilität
        calories: parseInt(calories) || 0,
        type: 'exercise',
        planId: String(planId || 'default'),
        order: maxOrder + 1,
        createdAt: new Date()
      });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addHeader(name, planId = 'default') {
    const exercises = await this.getAllExercises(planId);
    const maxOrder = exercises.length > 0 ? Math.max(...exercises.map(e => e.order || 0)) : -1;
    
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');
    
    return new Promise((resolve, reject) => {
      const request = store.add({
        name: name.trim(),
        type: 'header',
        planId: String(planId || 'default'),
        order: maxOrder + 1,
        createdAt: new Date()
      });
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllExercises(planId = 'default') {
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');

    return new Promise((resolve, reject) => {
      const safePlanId = String(planId || 'default');
      const request = store.indexNames.contains('planId')
        ? store.index('planId').getAll(safePlanId)
        : store.getAll();
      request.onsuccess = async () => {
        let exercises = request.result;
        if (!store.indexNames.contains('planId')) {
          exercises = Array.isArray(exercises) ? exercises.filter(ex => (ex && (ex.planId || 'default') === safePlanId)) : [];
        }
        exercises = Array.isArray(exercises) ? exercises : [];

        // Auto-Migration: Fehlende Order-Werte und Gewichtsfelder hinzufügen
        let needsUpdate = false;
        exercises.forEach((exercise, index) => {
          if (typeof exercise.planId === 'undefined') {
            exercise.planId = safePlanId;
            needsUpdate = true;
          }
          if (exercise.order === undefined || exercise.order === null) {
            exercise.order = index;
            needsUpdate = true;
          }

          // Migration: Alte weight-only Daten zu neuem Format
          if (exercise.type !== 'header' && exercise.baseWeight === undefined) {
            exercise.baseWeight = exercise.weight || 0;
            exercise.additionalPlates = 0;
            needsUpdate = true;
          }

          // Migration: calories-Feld hinzufügen
          if (exercise.type !== 'header' && exercise.calories === undefined) {
            exercise.calories = 0;
            needsUpdate = true;
          }

          // Gesamtgewicht immer aktualisieren
          if (exercise.type !== 'header') {
            exercise.weight = this.calculateTotalWeight(exercise.baseWeight, exercise.additionalPlates);
          }
        });

        // Updates speichern falls nötig
        if (needsUpdate) {
          for (const exercise of exercises) {
            if (exercise.order !== undefined) {
              store.put(exercise);
            }
          }
        }

        exercises.sort((a, b) => (a.order || 0) - (b.order || 0));
        resolve(exercises);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllExercisesAllPlans() {
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = async () => {
        const exercises = Array.isArray(request.result) ? request.result : [];

        let needsUpdate = false;
        exercises.forEach((exercise, index) => {
          if (typeof exercise.planId === 'undefined') {
            exercise.planId = 'default';
            needsUpdate = true;
          }
          if (exercise.order === undefined || exercise.order === null) {
            exercise.order = index;
            needsUpdate = true;
          }
          if (exercise.type !== 'header' && exercise.baseWeight === undefined) {
            exercise.baseWeight = exercise.weight || 0;
            exercise.additionalPlates = 0;
            needsUpdate = true;
          }
          if (exercise.type !== 'header' && exercise.calories === undefined) {
            exercise.calories = 0;
            needsUpdate = true;
          }
          if (exercise.type !== 'header') {
            exercise.weight = this.calculateTotalWeight(exercise.baseWeight, exercise.additionalPlates);
          }
        });

        if (needsUpdate) {
          for (const exercise of exercises) {
            if (exercise.order !== undefined) {
              store.put(exercise);
            }
          }
        }

        exercises.sort((a, b) => (a.order || 0) - (b.order || 0));
        resolve(exercises);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateExercise(id, name, weight, additionalPlates, calories = null) {
    const transaction = this.db.transaction(['exercises'], 'readwrite');
    const store = transaction.objectStore('exercises');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const exercise = getRequest.result;
        if (exercise) {
          exercise.name = name.trim();
          if (exercise.type !== 'header') {
            exercise.baseWeight = this.parseWeight(weight);
            exercise.additionalPlates = parseInt(additionalPlates) || 0;
            exercise.weight = this.calculateTotalWeight(exercise.baseWeight, exercise.additionalPlates);
            if (calories !== null) {
              exercise.calories = parseInt(calories) || 0;
            }
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

  async startTraining(planId = 'default') {
    const safePlanId = String(planId || 'default');
    const [exercises, plan] = await Promise.all([
      this.getAllExercises(safePlanId),
      this.getPlanById(safePlanId)
    ]);
    const trainingData = {
      id: 'current',
      active: true,
      startedAt: new Date(),
      planId: safePlanId,
      planName: plan ? plan.name : (safePlanId === 'default' ? 'Standard' : safePlanId),
      cardioEntries: [], // NEU: Cardio-Einträge für diese Session
      exercises: exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        type: ex.type || 'exercise',
        baseWeight: ex.baseWeight || 0,
        additionalPlates: ex.additionalPlates || 0,
        weight: ex.weight || 0,
        calories: ex.calories || 0, // NEU: Kalorien pro Übung
        completed: ex.type === 'header' ? null : false,
        skipped: ex.type === 'header' ? null : false
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

  async updateTrainingExercise(exerciseId, weight, completed, additionalPlates, saveToMaster = false) {
    const training = await this.getCurrentTraining();
    if (!training) return null;

    const exercise = training.exercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      exercise.baseWeight = this.parseWeight(weight);
      exercise.additionalPlates = parseInt(additionalPlates) || 0;
      exercise.weight = this.calculateTotalWeight(exercise.baseWeight, exercise.additionalPlates);
      if (typeof completed !== 'undefined') {
        if (completed === 'skipped') {
          exercise.completed = false;
          exercise.skipped = true;
        } else {
          const isCompleted = !!completed;
          exercise.completed = isCompleted;
          exercise.skipped = false;
        }
      } else if (typeof exercise.skipped === 'undefined') {
        exercise.skipped = false;
      }

      // Nur in Master-Daten speichern wenn explizit gewünscht (beim Abhaken)
      if (saveToMaster && exercise.completed === true) {
        await this.updateExercise(exerciseId, exercise.name, exercise.baseWeight, exercise.additionalPlates);
      }
    }

    const transaction = this.db.transaction(['training'], 'readwrite');
    const store = transaction.objectStore('training');

    return new Promise((resolve, reject) => {
      const request = store.put(training);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(training);
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || request.error);
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
    const [exercises, plans] = await Promise.all([
      this.getAllExercisesAllPlans(),
      this.getPlans()
    ]);
    const emailAddress = this.getEmailAddress();
    const webhookUrl = this.getWebhookUrl();
    const exportData = {
      version: '2.3',
      exportDate: new Date().toISOString(),
      settings: {
        emailAddress: emailAddress || undefined,
        webhookUrl: webhookUrl || undefined
      },
      plans: plans.map(p => ({
        id: p.id,
        name: p.name
      })),
      exercises: exercises.map(ex => ({
        name: ex.name,
        type: ex.type || 'exercise',
        baseWeight: ex.type === 'header' ? undefined : ex.baseWeight,
        additionalPlates: ex.type === 'header' ? undefined : ex.additionalPlates,
        weight: ex.type === 'header' ? undefined : ex.weight,
        calories: ex.type === 'header' ? undefined : (ex.calories || 0),
        order: ex.order,
        planId: ex.planId || 'default'
      }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    const now = new Date();
    const dateTime = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `krafttraining-backup-${dateTime}.json`;
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

          const importPlans = Array.isArray(importData.plans) ? importData.plans : [{ id: 'default', name: 'Standard' }];

          // Import ersetzt bestehende Übungen, um Duplikate zu vermeiden.
          await this.clearAllExercises();

          const existingPlans = await this.getPlans();
          const existingPlanIds = new Set(existingPlans.map(p => p && p.id).filter(Boolean));

          // Ensure plans exist (do not overwrite existing plans).
          for (const plan of importPlans) {
            const planId = String(plan && plan.id ? plan.id : '').trim() || 'default';
            if (existingPlanIds.has(planId)) continue;
            const planName = String(plan && plan.name ? plan.name : '').trim() || (planId === 'default' ? 'Standard' : planId);

            try {
              const transaction = this.db.transaction(['plans'], 'readwrite');
              const store = transaction.objectStore('plans');
              await new Promise((res, rej) => {
                const req = store.add({ id: planId, name: planName, createdAt: new Date(), updatedAt: new Date() });
                req.onsuccess = () => res();
                req.onerror = () => rej(req.error);
              });
              existingPlanIds.add(planId);
            } catch (error) {
              // ignore
            }
          }
          
          let importedCount = 0;
          let skippedCount = 0;
          
          for (const exercise of importData.exercises) {
            if (!exercise.name || exercise.name.trim() === '') {
              skippedCount++;
              continue;
            }
            
            try {
              let newId;
              const planId = String(exercise.planId || 'default');
              if (exercise.type === 'header') {
                newId = await this.addHeader(exercise.name, planId);
              } else {
                // Unterstütze sowohl neues Format (baseWeight + additionalPlates) als auch altes (weight)
                const baseWeight = exercise.baseWeight !== undefined ? exercise.baseWeight : (exercise.weight || 0);
                const additionalPlates = exercise.additionalPlates !== undefined ? exercise.additionalPlates : 0;
                const calories = exercise.calories !== undefined ? exercise.calories : 0;
                newId = await this.addExercise(exercise.name, baseWeight, additionalPlates, calories, planId);
              }

              // Order-Feld setzen falls vorhanden
              if (exercise.order !== undefined && newId) {
                const transaction = this.db.transaction(['exercises'], 'readwrite');
                const store = transaction.objectStore('exercises');
                const getRequest = store.get(newId);
                getRequest.onsuccess = () => {
                  const savedExercise = getRequest.result;
                  if (savedExercise) {
                    savedExercise.order = exercise.order;
                    store.put(savedExercise);
                  }
                };
              }

              importedCount++;
            } catch (error) {
              console.warn(`Fehler beim Importieren von "${exercise.name}":`, error);
              skippedCount++;
            }
          }
          
          // E-Mail-Adresse importieren falls vorhanden
          if (importData.settings && importData.settings.emailAddress) {
            this.saveEmailAddress(importData.settings.emailAddress);
          }
          if (importData.settings && importData.settings.webhookUrl) {
            this.saveWebhookUrl(importData.settings.webhookUrl);
          }

          resolve({
            imported: importedCount,
            skipped: skippedCount,
            total: importData.exercises.length,
            emailImported: !!(importData.settings && importData.settings.emailAddress),
            webhookImported: !!(importData.settings && importData.settings.webhookUrl)
          });
        } catch (error) {
          reject(new Error('Fehler beim Lesen der Backup-Datei: ' + error.message));
        }
      };
      
      reader.onerror = () => reject(new Error('Fehler beim Lesen der Datei'));
      reader.readAsText(file);
    });
  }

  async moveExercise(exerciseId, direction, planId = 'default') {
    const exercises = await this.getAllExercises(planId);
    const currentIndex = exercises.findIndex(ex => ex.id === exerciseId);
    
    if (currentIndex === -1) return false;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= exercises.length) return false;
    
    const currentExercise = exercises[currentIndex];
    const targetExercise = exercises[newIndex];
    
    // Robuste Order-Behandlung mit Fallback
    const currentOrder = currentExercise.order !== undefined ? currentExercise.order : currentIndex;
    const targetOrder = targetExercise.order !== undefined ? targetExercise.order : newIndex;
    
    currentExercise.order = targetOrder;
    targetExercise.order = currentOrder;
    
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

  // Cardio zur aktuellen Training-Session hinzufügen
  async addCardioToSession(name, calories) {
    const training = await this.getCurrentTraining();
    if (!training) return null;

    // cardioEntries initialisieren falls nicht vorhanden (Migration)
    if (!training.cardioEntries) {
      training.cardioEntries = [];
    }

    const newEntry = {
      id: Date.now(),
      name: name.trim(),
      calories: parseInt(calories) || 0
    };

    training.cardioEntries.push(newEntry);

    const transaction = this.db.transaction(['training'], 'readwrite');
    const store = transaction.objectStore('training');

    return new Promise((resolve, reject) => {
      const request = store.put(training);
      request.onsuccess = () => resolve(newEntry);
      request.onerror = () => reject(request.error);
    });
  }

  // Cardio aus der aktuellen Training-Session entfernen
  async removeCardioFromSession(cardioId) {
    const training = await this.getCurrentTraining();
    if (!training || !training.cardioEntries) return null;

    training.cardioEntries = training.cardioEntries.filter(entry => entry.id !== cardioId);

    const transaction = this.db.transaction(['training'], 'readwrite');
    const store = transaction.objectStore('training');

    return new Promise((resolve, reject) => {
      const request = store.put(training);
      request.onsuccess = () => resolve(training);
      request.onerror = () => reject(request.error);
    });
  }

  // E-Mail-Adresse speichern
  saveEmailAddress(email) {
    localStorage.setItem('krafttraining_email', email.trim());
  }

  // E-Mail-Adresse laden
  getEmailAddress() {
    return localStorage.getItem('krafttraining_email') || '';
  }

  // Webhook-URL speichern
  saveWebhookUrl(url) {
    localStorage.setItem('krafttraining_webhook_url', url.trim());
  }

  // Webhook-URL laden
  getWebhookUrl() {
    return localStorage.getItem('krafttraining_webhook_url') || '';
  }

  // Kalorien-Zusammenfassung der aktuellen Session berechnen
  async getSessionCaloriesSummary() {
    const training = await this.getCurrentTraining();
    if (!training) {
      return {
        exerciseCalories: 0,
        cardioCalories: 0,
        totalCalories: 0,
        completedExercises: [],
        cardioEntries: []
      };
    }

    // Kalorien aus abgeschlossenen Übungen
    const completedExercises = training.exercises.filter(
      ex => ex.type !== 'header' && ex.completed === true
    );
    const exerciseCalories = completedExercises.reduce(
      (sum, ex) => sum + (ex.calories || 0), 0
    );

    // Kalorien aus Cardio
    const cardioEntries = training.cardioEntries || [];
    const cardioCalories = cardioEntries.reduce(
      (sum, entry) => sum + (entry.calories || 0), 0
    );

    return {
      exerciseCalories,
      cardioCalories,
      totalCalories: exerciseCalories + cardioCalories,
      completedExercises,
      cardioEntries
    };
  }
}

const storage = new Storage();
