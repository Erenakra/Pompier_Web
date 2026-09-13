document.addEventListener('DOMContentLoaded', async () => {
    const vehiculeInfo = document.getElementById('vehicule-info');
    const alertBanner = document.getElementById('alert-banner');
    const containers = {
        "Sac prompt secours": document.getElementById('liste-prompt-secours'),
        "Sac oxygénation": document.getElementById('liste-oxygenation'),
        "Matériel Général": document.getElementById('liste-general')
    };

    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
    const filterPlanByVehicule = (vehicule) => {
        document.querySelectorAll('.plan-zone').forEach(zone => {
            const zoneVehicule = zone.getAttribute('data-vehicule');
            if (zoneVehicule === 'commun' || zoneVehicule === vehicule) {
                zone.style.display = 'block';
            } else {
                zone.style.display = 'none';
            }
        });
    };

    let activeVehicule = 'VTULE';
    let vehiculesData = {};
    let items = [];
    let hotspotsData = {};
    
    // Chargement de la source de vérité des points d'intérêt
    const loadHotspotsData = async () => {
        try {
            const res = await fetch('hotspots.json');
            if (res.ok) {
                hotspotsData = await res.json();
                console.log(`[Hotspots] ${Object.keys(hotspotsData).length} photos chargées avec succès depuis hotspots.json`);
            } else {
                const resFallback = await fetch('hotspots_2026-09-12.json');
                if (resFallback.ok) {
                    hotspotsData = await resFallback.json();
                    console.log(`[Hotspots] ${Object.keys(hotspotsData).length} photos chargées depuis hotspots_2026-09-12.json`);
                }
            }
        } catch (err) {
            console.warn('[Hotspots] Erreur chargement hotspots.json (repli sur données intégrées) :', err);
        }
    };

    // Pour que saveItems ait accès à activeVehicule
    const saveItems = () => {
        localStorage.setItem('materiauxData_' + activeVehicule, JSON.stringify(items));
    };

    const initApp = async () => {
        try {
            // --- Gestion du Véhicule (URL / LocalStorage / Header) ---
            const urlParams = new URLSearchParams(window.location.search);
            let urlVehicule = urlParams.get('vehicule');
            
            if (urlVehicule && (urlVehicule === 'VTULE' || urlVehicule === 'VPI')) {
                localStorage.setItem('activeVehicule', urlVehicule);
                activeVehicule = urlVehicule;
            } else {
                activeVehicule = localStorage.getItem('activeVehicule') || 'VTULE';
            }

            const resVehicule = await fetch('vehicules.json');
            if (!resVehicule.ok) throw new Error('Échec du fetch véhicule');
            vehiculesData = await resVehicule.json();
            
            const updateVehiculeHeader = (vehiculeKey) => {
                const vehiculeObj = vehiculesData[vehiculeKey] || vehiculesData['VTULE'];
                vehiculeInfo.innerHTML = `
                    <h1>${escapeHtml(vehiculeObj.id)}</h1>
                    <p>Responsable : <strong>${escapeHtml(vehiculeObj.responsable_actuel)}</strong></p>
                `;
            };
            
            updateVehiculeHeader(activeVehicule);
            filterPlanByVehicule(activeVehicule);

            const vehiculeSelector = document.getElementById('vehicule-selector');
            if (vehiculeSelector) {
                vehiculeSelector.value = activeVehicule;
                vehiculeSelector.addEventListener('change', async (e) => {
                    const newVal = e.target.value;
                    activeVehicule = newVal;
                    localStorage.setItem('activeVehicule', newVal);
                    
                    // Mettre à jour l'URL sans recharger
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.set('vehicule', newVal);
                    window.history.replaceState({}, '', newUrl);
                    
                    updateVehiculeHeader(newVal);
                    filterPlanByVehicule(newVal);
                    
                    // Recharger la liste du matériel de ce véhicule
                    await loadMateriauxData();
                    if (typeof renderMateriaux === 'function') {
                        const searchInput = document.getElementById('search-input');
                        renderMateriaux(searchInput ? searchInput.value : '');
                    }
                });
            }
            
            const loadMateriauxData = async () => {
                const localData = localStorage.getItem('materiauxData_' + activeVehicule);
                if (localData) {
                    items = JSON.parse(localData);
                } else {
                    const resMateriaux = await fetch('materiaux.json');
                    if (!resMateriaux.ok) throw new Error('Échec du fetch materiaux');
                    items = await resMateriaux.json();
                    saveItems();
                }
            };
            
            await loadMateriauxData();
            await loadHotspotsData();

            // --- Système d'identification ---
            const loginModal = document.getElementById('login-modal');
            const loginForm = document.getElementById('login-form');
            const userInfoBanner = document.getElementById('user-info-banner');
            const connectedUserName = document.getElementById('connected-user-name');
            const btnLogout = document.getElementById('btn-logout');
            
            let currentUser = null;

            const checkAuth = () => {
                const savedUser = localStorage.getItem('currentUser');
                const loginTime = localStorage.getItem('loginTime');
                
                if (savedUser && loginTime) {
                    const nowMs = new Date().getTime();
                    const daysDiff = (nowMs - parseInt(loginTime, 10)) / (1000 * 60 * 60 * 24);
                    
                    if (daysDiff <= 15) {
                        currentUser = savedUser;
                        connectedUserName.innerText = `Connecté : ${escapeHtml(currentUser)}`;
                        userInfoBanner.classList.remove('hidden');
                        loginModal.classList.add('hidden');
                        return;
                    }
                }
                
                // Session expirée ou absente
                localStorage.removeItem('currentUser');
                localStorage.removeItem('loginTime');
                currentUser = null;
                userInfoBanner.classList.add('hidden');
                loginModal.classList.remove('hidden');
            };

            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const grade = document.getElementById('login-grade').value;
                    const nom = document.getElementById('login-nom').value.trim();
                    if (grade && nom) {
                        const fullName = `${grade} ${nom}`;
                        localStorage.setItem('currentUser', fullName);
                        localStorage.setItem('loginTime', new Date().getTime().toString());
                        checkAuth();
                    }
                });
            }

            if (btnLogout) {
                btnLogout.addEventListener('click', () => {
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('loginTime');
                    window.location.reload();
                });
            }

            // Vérification initiale
            checkAuth();

            // --- Système de Logs ---
            const addLog = (action, materielNom) => {
                if (!currentUser) return;
                let logs = JSON.parse(localStorage.getItem('inventoryLogs') || '[]');
                const dateStr = new Date().toLocaleString('fr-FR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit', second: '2-digit' 
                });
                const logEntry = `[${dateStr}] - ${escapeHtml(currentUser)} a modifié ${escapeHtml(materielNom)} : ${escapeHtml(action)}.`;
                logs.push(logEntry);
                logs = logs.slice(-500); // Limite de l'historique
                localStorage.setItem('inventoryLogs', JSON.stringify(logs));
            };

        const searchInput = document.getElementById('search-input');
        
        let activeFilter = 'Tout';
        let hideControlled = false; // Mode Inventaire : masquer les items déjà contrôlés
        let isGlobalCritical = false;
        
        items = Array.isArray(items) ? items : [items];
        
        // Initialiser si pas de données locales pour ce véhicule
        const currentLocalData = localStorage.getItem('materiauxData_' + activeVehicule);
        if (!currentLocalData) {
            saveItems();
        }

        // Vérification globale des éléments critiques pour la bannière d'alerte
        const initNow = new Date();
        items.forEach(m => {
            const isExpired = m.perimable && m.date_peremption && new Date(m.date_peremption) < initNow;
            if (m.etat === "Abîmé" || m.etat === "Manquant" || m.etat === "Non opérationnel" || isExpired) {
                isGlobalCritical = true;
            }
        });

        if (isGlobalCritical) alertBanner.classList.remove('hidden');

        // --- Barre de progression ---
        const progressContainer = document.getElementById('progress-container');
        const progressBarFill = document.getElementById('progress-bar-fill');
        const progressText = document.getElementById('progress-text');

        const updateProgressBar = () => {
            const total = items.length;
            const controlled = items.filter(m => m.controlled === true || m.last_verified).length;
            const percentage = total === 0 ? 0 : Math.round((controlled / total) * 100);
            
            progressBarFill.style.width = percentage + '%';
            progressText.innerText = `${controlled} / ${total} matériels contrôlés`;
        };

        // Fonction de rendu dynamique selon la recherche
        const renderMateriaux = (query = '') => {
            const normalizedQuery = query.trim().toLowerCase();
            const now = new Date(); // Date instanciée à chaque rendu !

            Object.entries(containers).forEach(([zone, container]) => {
                // Filtrage selon le nom du matériel, l'emplacement, le véhicule et activeFilter
                const filtered = items.filter(m => {
                    if (m.emplacement !== zone) return false;
                    
                    const itemVehicule = m.vehicule || 'commun';
                    if (itemVehicule !== 'commun' && itemVehicule !== activeVehicule) return false;
                    
                    let diffDays = 999;
                    if (m.perimable && m.date_peremption) {
                        const expDate = new Date(m.date_peremption);
                        expDate.setHours(0,0,0,0);
                        const today = new Date(now);
                        today.setHours(0,0,0,0);
                        diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
                    }

                    // Logique de filtre par statut
                    if (activeFilter === 'Critique') {
                        const isExpired = m.perimable && diffDays < 0;
                        if (m.etat === 'Opérationnel' && !isExpired) return false;
                    } else if (activeFilter === 'Surveiller') {
                        if (m.etat !== 'Opérationnel' || !m.perimable || diffDays < 0 || diffDays >= 60) return false;
                    } else if (activeFilter === 'OK') {
                        if (m.etat !== 'Opérationnel' || (m.perimable && diffDays < 60)) return false;
                    }

                    // Mode Inventaire : masquer les items déjà contrôlés si activé
                    if (hideControlled && m.controlled) return false;

                    if (!normalizedQuery) return true;

                    const matchNom = m.nom && m.nom.toLowerCase().includes(normalizedQuery);
                    const matchEmplacement = (m.emplacement && m.emplacement.toLowerCase().includes(normalizedQuery)) ||
                                             (m.localisation_precise && m.localisation_precise.toLowerCase().includes(normalizedQuery));

                    return matchNom || matchEmplacement;
                });

                if (filtered.length === 0) {
                    container.innerHTML = `<p class="empty-state" style="color: #888; font-style: italic; text-align: center;">Aucun matériel trouvé.</p>`;
                    return;
                }

                container.innerHTML = filtered.map(m => {
                    let isExpired = false;
                    let isExpiringSoon = false;
                    let expirationText = '';
                    let expirationBadgeClass = '';

                    if (m.perimable && m.date_peremption) {
                        const expirationDate = new Date(m.date_peremption);
                        expirationDate.setHours(0, 0, 0, 0);
                        const today = new Date(now);
                        today.setHours(0, 0, 0, 0);
                        
                        const diffTime = expirationDate - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays < 0) {
                            isExpired = true;
                            expirationText = `${m.date_peremption} (Périmé)`;
                            expirationBadgeClass = 'badge-expired';
                        } else if (diffDays < 60) {
                            isExpiringSoon = true;
                            expirationText = m.date_peremption;
                            expirationBadgeClass = 'badge-warning';
                        } else {
                            expirationText = m.date_peremption;
                        }
                    }

                    // Statut "Non opérationnel" ou similaire (tout ce qui n'est pas "Opérationnel")
                    const isNonOperational = m.etat !== "Opérationnel";
                    
                    const isDanger = isNonOperational || isExpired;
                    const isWarning = !isDanger && isExpiringSoon;

                    let cardClass = '';
                    if (isDanger) cardClass = 'danger';
                    else if (isWarning) cardClass = 'warning';

                    let controlledClass = m.controlled ? 'controlled' : '';

                    return `
                        <div class="materiel-card ${cardClass} ${controlledClass}">
                            <div class="materiel-info">
                                <div class="materiel-nom">
                                    ${escapeHtml(m.nom)}
                                    ${m.imageUrl ? `<button class="btn-photo" data-image="${escapeHtml(m.imageUrl)}" aria-label="Voir la photo">📷</button>` : ''}
                                </div>
                                <div class="localisation-badge">📍 ${escapeHtml(m.localisation_precise)}</div>
                                <div class="badges-container">
                                    <span class="badge">📦 ${escapeHtml(m.quantite)}</span>
                                    <span class="badge">${m.etat === 'Opérationnel' ? '✅' : '❌'} ${escapeHtml(m.etat)}</span>
                                    ${m.perimable ? `<span class="badge ${expirationBadgeClass}">⏳ ${escapeHtml(expirationText)}</span>` : ''}
                                    ${m.pression_bars ? `<span class="badge">💨 ${escapeHtml(m.pression_bars)} bars</span>` : ''}
                                </div>
                                ${m.last_verified ? `<div style="font-size: 0.8em; color: #888; font-style: italic; margin-top: 5px;">Dernière vérif. : ${m.last_verified}</div>` : ''}
                            </div>
                            <button class="btn-action" data-id="${m.id_produit}">✏️ Modifier</button>
                            <div class="inventory-actions">
                                <button class="btn-conforme" data-id="${m.id_produit}" ${m.controlled ? 'disabled' : ''}>✅ Conforme</button>
                                <button class="btn-anomalie" data-id="${m.id_produit}" ${m.controlled ? 'disabled' : ''}>❌ Anomalie</button>
                                ${m.controlled ? `<button class="btn-undo" data-id="${m.id_produit}" title="Annuler le contrôle de cet équipement">↩️ Annuler</button>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            });
            
            updateProgressBar();
        };

        // Rendu initial
        renderMateriaux('');

        // Filtrage en temps réel lors de la saisie
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderMateriaux(e.target.value);
            });
        }

        // --- Filtres rapides ---
        const filterPills = document.querySelectorAll('.filter-pill');
        filterPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                filterPills.forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                activeFilter = e.target.getAttribute('data-filter');
                renderMateriaux(searchInput ? searchInput.value : '');
            });
        });

        // --- Mode Inventaire ---
        const btnToggleInventory = document.getElementById('btn-toggle-inventory');
        if (btnToggleInventory) {
            btnToggleInventory.addEventListener('click', () => {
                document.body.classList.toggle('inventory-mode-active');
                if (document.body.classList.contains('inventory-mode-active')) {
                    btnToggleInventory.classList.add('active');
                    btnToggleInventory.innerText = '❌ Désactiver le Mode Inventaire';
                    progressContainer.classList.remove('hidden');
                } else {
                    btnToggleInventory.classList.remove('active');
                    btnToggleInventory.innerText = '📋 Activer le Mode Inventaire';
                    progressContainer.classList.add('hidden');
                    
                    // Réinitialiser l'état contrôlé de tous les items et persister
                    // (last_verified est conservé : c'est un historique utile entre les sessions)
                    items.forEach(m => {
                        m.controlled = false;
                        if (m.etat_precedent) delete m.etat_precedent; // nettoyer le snapshot d'annulation
                    });
                    saveItems(); // Persister la réinitialisation (bug corrigé : avant, les controlled revenaient au refresh)
                    // Réinitialiser aussi le filtre 'Masquer les contrôlés'
                    hideControlled = false;
                    const btnHC = document.getElementById('btn-hide-controlled');
                    if (btnHC) {
                        btnHC.classList.remove('active');
                        btnHC.innerText = '👁️ Masquer les contrôlés';
                    }
                    renderMateriaux(searchInput ? searchInput.value : '');
                }
            });
        }

        // --- Bouton 'Tout conforme' (action groupée, Mode Inventaire) ---
        const btnAllConforme = document.getElementById('btn-all-conforme');
        if (btnAllConforme) {
            btnAllConforme.addEventListener('click', () => {
                // Compter les items non contrôlés du véhicule actif (toutes zones)
                const uncontrolled = items.filter(m => {
                    const itemVehicule = m.vehicule || 'commun';
                    return itemVehicule === 'commun' || itemVehicule === activeVehicule;
                }).filter(m => !m.controlled);

                if (uncontrolled.length === 0) {
                    alert("Tous les matériels sont déjà contrôlés.");
                    return;
                }

                if (!confirm(`Marquer ${uncontrolled.length} matériel(s) comme conformes ?\n\nCette action validera tous les équipements non encore contrôlés du véhicule ${activeVehicule}.`)) {
                    return;
                }

                const dateStr = new Date().toLocaleString('fr-FR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                });
                uncontrolled.forEach(m => {
                    m.controlled = true;
                    m.last_verified = dateStr;
                });
                addLog(`Tout conforme (validation groupée de ${uncontrolled.length} matériels)`, activeVehicule);
                saveItems();
                renderMateriaux(searchInput ? searchInput.value : '');
            });
        }

        // --- Bouton 'Masquer les contrôlés' (Mode Inventaire) ---
        const btnHideControlled = document.getElementById('btn-hide-controlled');
        if (btnHideControlled) {
            btnHideControlled.addEventListener('click', () => {
                hideControlled = !hideControlled;
                btnHideControlled.classList.toggle('active', hideControlled);
                btnHideControlled.innerText = hideControlled ? '👁️ Afficher les contrôlés' : '👁️ Masquer les contrôlés';
                renderMateriaux(searchInput ? searchInput.value : '');
            });
        }

        // --- Exportation CSV du réassort ---
        const btnExportCsv = document.getElementById('btn-export-csv');
        if (btnExportCsv) {
            btnExportCsv.addEventListener('click', () => {
                // Filtrer les équipements nécessitant une action
                const itemsToOrder = items.filter(m => {
                    let isDanger = m.etat !== "Opérationnel";
                    let isExpiring = false;
                    
                    if (m.perimable && m.date_peremption) {
                        const expirationDate = new Date(m.date_peremption);
                        expirationDate.setHours(0, 0, 0, 0);
                        const todayDate = new Date();
                        todayDate.setHours(0, 0, 0, 0);
                        const diffDays = Math.ceil((expirationDate - todayDate) / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 60) {
                            isExpiring = true;
                        }
                    }
                    return isDanger || isExpiring;
                });

                if (itemsToOrder.length === 0) {
                    alert("Aucun matériel nécessitant un réassort n'a été trouvé.");
                    return;
                }

                // Génération du CSV
                let csvContent = "Nom;Emplacement;Quantité;Motif\n";
                
                itemsToOrder.forEach(m => {
                    let motif = "";
                    if (m.etat !== "Opérationnel") {
                        motif = m.etat;
                    } else if (m.perimable && m.date_peremption) {
                        const expirationDate = new Date(m.date_peremption);
                        expirationDate.setHours(0, 0, 0, 0);
                        const todayDate = new Date();
                        todayDate.setHours(0, 0, 0, 0);
                        const diffDays = Math.ceil((expirationDate - todayDate) / (1000 * 60 * 60 * 24));
                        
                        if (diffDays < 0) {
                            motif = `Périmé le ${m.date_peremption}`;
                        } else {
                            motif = `Péremption proche (${m.date_peremption})`;
                        }
                    }

                    // Échapper les guillemets et points-virgules pour le CSV si nécessaire
                    const nom = m.nom ? m.nom.replace(/;/g, ',') : "";
                    const emplacement = m.localisation_precise ? m.localisation_precise.replace(/;/g, ',') : (m.emplacement || "");
                    const quantite = m.quantite || 0;
                    
                    csvContent += `${nom};${emplacement};${quantite};${motif}\n`;
                });

                // Création et téléchargement du Blob
                const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                
                const todayFormatted = new Date().toISOString().split('T')[0];
                const filename = `reassort_blodelsheim_vtule_${todayFormatted}.csv`;

                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        // --- Modale d'édition ---
        const editModal = document.getElementById('edit-modal');
        const editForm = document.getElementById('edit-form');
        const btnCancelEdit = document.getElementById('btn-cancel-edit');
        
        const editIdInput = document.getElementById('edit-id');
        const editNomInput = document.getElementById('edit-nom');
        const editQuantiteInput = document.getElementById('edit-quantite');
        const editDateInput = document.getElementById('edit-date');
        const editStatutInput = document.getElementById('edit-statut');

        const closeEditModal = () => {
            editModal.classList.add('hidden');
            editForm.reset();
        };

        if (btnCancelEdit) {
            btnCancelEdit.addEventListener('click', closeEditModal);
        }

        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const id = editIdInput.value;
                const item = items.find(m => m.id_produit === id);
                
                if (item) {
                    item.nom = editNomInput.value;
                    item.quantite = parseInt(editQuantiteInput.value, 10);
                    item.date_peremption = editDateInput.value || null;
                    item.etat = editStatutInput.value;
                    
                    // Mettre à jour l'alerte globale
                    isGlobalCritical = items.some(m => {
                        const expired = m.perimable && m.date_peremption && new Date(m.date_peremption) < new Date();
                        return m.etat === "Abîmé" || m.etat === "Manquant" || m.etat === "Non opérationnel" || expired;
                    });
                    
                    if (isGlobalCritical) {
                        alertBanner.classList.remove('hidden');
                    } else {
                        alertBanner.classList.add('hidden');
                    }
                    
                    addLog("Mise à jour des informations", item.nom);
                    
                    saveItems();
                    renderMateriaux(searchInput ? searchInput.value : '');
                    closeEditModal();
                }
            });
        }

        // --- Modale de motif d'anomalie (Mode Inventaire) ---
        const anomalieModal = document.getElementById('anomalie-modal');
        let pendingAnomalieItemId = null; // ID de l'item en attente d'un choix de motif

        // Appliquer l'anomalie avec le motif sélectionné
        const applyAnomalieWithMotif = (motif) => {
            const item = items.find(m => m.id_produit === pendingAnomalieItemId);
            if (item) {
                item.etat_precedent = item.etat; // Snapshot pour permettre l'annulation
                item.etat = motif; // Le motif devient le statut (Manquant, Abîmé, Périmé, Non testable)
                item.controlled = true;
                item.motif_anomalie = motif; // Conservé pour l'export CSV et l'historique
                const dateStr = new Date().toLocaleString('fr-FR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                });
                item.last_verified = dateStr;
                isGlobalCritical = true;
                alertBanner.classList.remove('hidden');
                addLog(`Anomalie (${motif})`, item.nom);
                saveItems();
                renderMateriaux(searchInput ? searchInput.value : '');
            }
            pendingAnomalieItemId = null;
            anomalieModal.classList.add('hidden');
        };

        // Choix d'un motif dans la modale (délégation sur les boutons de motif)
        if (anomalieModal) {
            anomalieModal.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-anomalie-choice')) {
                    const motif = e.target.getAttribute('data-motif');
                    if (motif) applyAnomalieWithMotif(motif);
                    return;
                }
                // Fermeture via le bouton Annuler ou clic sur l'overlay
                if (e.target.id === 'btn-cancel-anomalie' || e.target === anomalieModal) {
                    pendingAnomalieItemId = null;
                    anomalieModal.classList.add('hidden');
                }
            });
        }

        // --- Historique Modal ---
        const btnViewHistory = document.getElementById('btn-view-history');
        const historyModal = document.getElementById('history-modal');
        const btnCloseHistory = document.getElementById('btn-close-history');
        const btnClearHistory = document.getElementById('btn-clear-history');
        const historyList = document.getElementById('history-list');

        const renderHistory = () => {
            const logs = JSON.parse(localStorage.getItem('inventoryLogs') || '[]');
            if (logs.length === 0) {
                historyList.innerHTML = '<p style="text-align:center; color:#888;">Aucun historique disponible.</p>';
            } else {
                historyList.innerHTML = logs.slice().reverse().map(log => {
                    // Mettre en gras le nom de l'utilisateur pour la lisibilité
                    return `<div class="history-item">${log.replace(currentUser, `<strong>${currentUser}</strong>`)}</div>`;
                }).join('');
            }
        };

        if (btnViewHistory) {
            btnViewHistory.addEventListener('click', () => {
                if (!currentUser) return;
                renderHistory();
                historyModal.classList.remove('hidden');
            });
        }

        if (btnCloseHistory) {
            btnCloseHistory.addEventListener('click', () => {
                historyModal.classList.add('hidden');
            });
        }

        if (btnClearHistory) {
            btnClearHistory.addEventListener('click', () => {
                if (confirm("Êtes-vous sûr de vouloir effacer tout l'historique ? Cette action est irréversible.")) {
                    localStorage.removeItem('inventoryLogs');
                    renderHistory();
                }
            });
        }

        // --- Verrouillage strict du défilement de l'arrière-plan (Scroll Chaining) ---
        const updateBodyScrollLock = () => {
            const hasOpenModal = document.querySelector('.modal-overlay:not(.hidden)');
            if (hasOpenModal) {
                document.body.classList.add('modal-open');
                document.body.style.overflow = 'hidden';
            } else {
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
            }
        };

        // Surveillance automatique de l'ouverture et fermeture de toutes les modales
        const modalObserver = new MutationObserver(updateBodyScrollLock);
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modalObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
        });
        updateBodyScrollLock();

        // --- Système d'Images, Plan et Points d'Intérêt (Hotspots) ---
        const btnViewPlan = document.getElementById('btn-view-plan');
        const planModal = document.getElementById('plan-modal');
        const photoModal = document.getElementById('photo-modal');
        const photoModalContainer = document.getElementById('photo-modal-container');

        // Base de données par défaut des Points d'Intérêt (Hotspots) par photo
        const DEFAULT_HOTSPOTS_DATA = {
            "VPI arrière.avif": [
                { id: "vpi-1", nom: "LDT 80 m", x: 49.1, y: 39.7 },
                { id: "vpi-2", nom: "Lance LDT", x: 72.3, y: 64.5 },
                { id: "vpi-3", nom: "Pompe incendie", x: 51.1, y: 70.5 },
                { id: "vpi-4", nom: "Vanne d'amorçage", x: 33.7, y: 54.2 },
                { id: "vpi-5", nom: "Vanne d'eau amorceur", x: 43.7, y: 52.8 },
                { id: "vpi-6", nom: "Vanne tonne-pompe", x: 51.3, y: 80.9 },
                { id: "vpi-7", nom: "Orifice d'aspiration (raccord 100)", x: 47.2, y: 83.9 },
                { id: "vpi-8", nom: "Remplissage citerne (raccord 45)", x: 30.9, y: 85.5 },
                { id: "vpi-9", nom: "Refoulement (raccord 65)", x: 63.7, y: 60.9 },
                { id: "vpi-10", nom: "Refoulement (raccord 40)", x: 52.6, y: 64.2 },
                { id: "vpi-11", nom: "Refoulement (raccord 40)", x: 42.4, y: 63.7 },
                { id: "vpi-12", nom: "Collecteur à clapets", x: 64.3, y: 86.5 },
                { id: "vpi-13", nom: "Tuyaux d'aspiration 2 m Ø 110 (x5)", x: 50.4, y: 20.5 },
                { id: "vpi-14", nom: "2 clés tricoises", x: 72.5, y: 76.9 }
            ],
            "arrière vpi.avif": [
                { id: "vpi-1", nom: "LDT 80 m", x: 49.1, y: 39.7 },
                { id: "vpi-2", nom: "Lance LDT", x: 72.3, y: 64.5 },
                { id: "vpi-3", nom: "Pompe incendie", x: 51.1, y: 70.5 },
                { id: "vpi-4", nom: "Vanne d'amorçage", x: 33.7, y: 54.2 },
                { id: "vpi-5", nom: "Vanne d'eau amorceur", x: 43.7, y: 52.8 },
                { id: "vpi-6", nom: "Vanne tonne-pompe", x: 51.3, y: 80.9 },
                { id: "vpi-7", nom: "Orifice d'aspiration (raccord 100)", x: 47.2, y: 83.9 },
                { id: "vpi-8", nom: "Remplissage citerne (raccord 45)", x: 30.9, y: 85.5 },
                { id: "vpi-9", nom: "Refoulement (raccord 65)", x: 63.7, y: 60.9 },
                { id: "vpi-10", nom: "Refoulement (raccord 40)", x: 52.6, y: 64.2 },
                { id: "vpi-11", nom: "Refoulement (raccord 40)", x: 42.4, y: 63.7 },
                { id: "vpi-12", nom: "Collecteur à clapets", x: 64.3, y: 86.5 },
                { id: "vpi-13", nom: "Tuyaux d'aspiration 2 m Ø 110 (x5)", x: 50.4, y: 20.5 },
                { id: "vpi-14", nom: "2 clés tricoises", x: 72.5, y: 76.9 }
            ],
            "Sac PS VPI éclaté.avif": [
                { id: "ps-1", nom: "Garrot tourniquet (CAT)", x: 28.5, y: 38.0 },
                { id: "ps-2", nom: "Compresses stériles & CHU", x: 52.0, y: 46.5 },
                { id: "ps-3", nom: "Colliers cervicaux (Adulte / Enfant)", x: 74.5, y: 65.0 }
            ],
            "sac oxygénation éclaté.avif": [
                { id: "o2-1", nom: "Bouteille d'Oxygène 2L & Manodétendeur", x: 42.0, y: 32.5 },
                { id: "o2-2", nom: "BAVU & Masques Haute Concentration", x: 68.0, y: 55.0 },
                { id: "o2-3", nom: "Canules de Guedel & Raccord", x: 25.0, y: 72.0 }
            ]
        };

        // Gestion de customHotspotsData dans localStorage
        const getCustomHotspots = () => {
            try {
                return JSON.parse(localStorage.getItem('customHotspotsData') || '{}');
            } catch (e) {
                return {};
            }
        };

        const saveCustomHotspots = (customData) => {
            localStorage.setItem('customHotspotsData', JSON.stringify(customData));
        };

        const normalizeImageKey = (imgUrl) => {
            if (!imgUrl) return '';
            let clean = imgUrl;
            try { clean = decodeURIComponent(imgUrl); } catch (e) {}
            return clean.split('/').pop().trim();
        };

        // Récupération dynamique : priorité absolue à customHotspotsData si modifié, puis hotspotsData (hotspots.json), puis DEFAULT_HOTSPOTS_DATA
        const getHotspotsForImage = (imgUrl) => {
            const filename = normalizeImageKey(imgUrl);
            if (!filename) return [];

            const customAll = getCustomHotspots();
            // 1. Chercher en priorité dans customHotspotsData (modifications locales)
            for (const [k, spots] of Object.entries(customAll)) {
                if (normalizeImageKey(k).toLowerCase() === filename.toLowerCase()) {
                    return spots;
                }
            }

            // 2. Chercher dans hotspotsData (source de vérité chargée depuis hotspots.json)
            for (const [k, spots] of Object.entries(hotspotsData)) {
                if (normalizeImageKey(k).toLowerCase() === filename.toLowerCase()) {
                    return spots;
                }
            }

            // 3. Sinon chercher dans DEFAULT_HOTSPOTS_DATA (secours codé en dur)
            for (const [k, spots] of Object.entries(DEFAULT_HOTSPOTS_DATA)) {
                if (normalizeImageKey(k).toLowerCase() === filename.toLowerCase()) {
                    return spots;
                }
            }

            return [];
        };

        // Ajout d'un point dans customHotspotsData
        const addHotspotPoint = (imgUrl, equipmentName, x, y) => {
            const filename = normalizeImageKey(imgUrl);
            const customAll = getCustomHotspots();

            let currentSpots = customAll[filename] ? [...customAll[filename]] : [...getHotspotsForImage(imgUrl)];

            const newSpot = {
                id: `hp-${Date.now().toString().slice(-6)}`,
                nom: equipmentName.trim(),
                x: parseFloat(x),
                y: parseFloat(y)
            };

            currentSpots.push(newSpot);
            customAll[filename] = currentSpots;
            saveCustomHotspots(customAll);
            return newSpot;
        };

        // Suppression d'un point
        const removeHotspotPoint = (imgUrl, pointId) => {
            const filename = normalizeImageKey(imgUrl);
            const customAll = getCustomHotspots();
            let currentSpots = customAll[filename] ? [...customAll[filename]] : [...getHotspotsForImage(imgUrl)];
            currentSpots = currentSpots.filter(p => (p.id || `hp-${p.x}-${p.y}`) !== pointId);
            customAll[filename] = currentSpots;
            saveCustomHotspots(customAll);
        };

        // Export global au format JSON de toutes les photos annotées
        const exportHotspotsJSON = () => {
            const customAll = getCustomHotspots();
            // Fusion : DEFAULT_HOTSPOTS_DATA + hotspotsData (source de vérité) + customAll (ajouts locaux)
            const merged = { ...DEFAULT_HOTSPOTS_DATA, ...hotspotsData };
            for (const [k, spots] of Object.entries(customAll)) {
                merged[k] = spots;
            }

            const jsonStr = JSON.stringify(merged, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `hotspots.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showCalibrationToast("Fichier hotspots.json exporté avec succès !");
        };

        // Notification toast
        const showCalibrationToast = (message) => {
            let toast = document.getElementById('calibration-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'calibration-toast';
                toast.className = 'calibration-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            toast.classList.add('show');
            clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 2500);
        };

        // État du Mode Annotation / Étalonnage
        let isAnnotationMode = false;
        let currentOpenedImageUrl = '';
        let pendingHotspotCoords = null;

        const updateAnnotationUI = () => {
            const btnToggle = document.getElementById('btn-toggle-annotation');
            const banner = document.getElementById('annotation-banner');
            const wrapper = photoModalContainer.querySelector('.photo-interactive-wrapper');

            if (btnToggle) {
                btnToggle.classList.toggle('active', isAnnotationMode);
                btnToggle.innerHTML = isAnnotationMode ? '✅ Mode Annotation (Actif)' : '⚙️ Mode Annotation';
            }
            if (banner) {
                banner.classList.toggle('hidden', !isAnnotationMode);
            }
            if (wrapper) {
                wrapper.classList.toggle('annotation-mode', isAnnotationMode);
            }
        };

        // Rendu dynamique des pastilles / hotspots sur l'image affichée
        const renderHotspots = (imgUrl) => {
            const wrapper = photoModalContainer.querySelector('.photo-interactive-wrapper');
            if (!wrapper) return;

            // Supprimer les puces existantes
            wrapper.querySelectorAll('.hotspot-pin').forEach(p => p.remove());

            const hotspots = getHotspotsForImage(imgUrl);
            if (!hotspots || hotspots.length === 0) return;

            const fragment = document.createDocumentFragment();
            hotspots.forEach(hp => {
                let posClass = '';
                if (hp.y < 18) posClass += ' tooltip-bottom';
                if (hp.x < 18) posClass += ' tooltip-left';
                else if (hp.x > 82) posClass += ' tooltip-right';

                const pin = document.createElement('div');
                pin.className = `hotspot-pin${posClass}`;
                pin.style.left = `${hp.x}%`;
                pin.style.top = `${hp.y}%`;
                pin.setAttribute('data-id', hp.id || `hp-${hp.x}-${hp.y}`);
                pin.setAttribute('role', 'button');
                pin.setAttribute('aria-label', hp.nom);
                pin.innerHTML = `<div class="hotspot-tooltip">${escapeHtml(hp.nom)}</div>`;

                fragment.appendChild(pin);
            });

            wrapper.appendChild(fragment);
        };

        // Popup de saisie du nom de l'équipement
        const openHotspotDialog = (x, y) => {
            pendingHotspotCoords = { x, y };
            const coordsDisplay = document.getElementById('hotspot-coords-display');
            const nameInput = document.getElementById('hotspot-name-input');
            const dialog = document.getElementById('hotspot-dialog');

            if (coordsDisplay) coordsDisplay.textContent = `X: ${x}%, Y: ${y}%`;
            if (nameInput) {
                nameInput.value = '';
                setTimeout(() => nameInput.focus(), 100);
            }
            if (dialog) dialog.classList.remove('hidden');
        };

        const closeHotspotDialog = () => {
            const dialog = document.getElementById('hotspot-dialog');
            if (dialog) dialog.classList.add('hidden');
            pendingHotspotCoords = null;
        };

        // Boutons de la boîte de dialogue Hotspot
        const btnCancelHotspot = document.getElementById('btn-cancel-hotspot');
        const btnConfirmHotspot = document.getElementById('btn-confirm-hotspot');
        const hotspotNameInput = document.getElementById('hotspot-name-input');

        if (btnCancelHotspot) {
            btnCancelHotspot.addEventListener('click', closeHotspotDialog);
        }

        const handleConfirmHotspot = () => {
            if (!pendingHotspotCoords || !currentOpenedImageUrl) return;
            const name = hotspotNameInput ? hotspotNameInput.value.trim() : '';
            if (!name) {
                if (hotspotNameInput) hotspotNameInput.focus();
                return;
            }

            addHotspotPoint(currentOpenedImageUrl, name, pendingHotspotCoords.x, pendingHotspotCoords.y);
            renderHotspots(currentOpenedImageUrl);
            closeHotspotDialog();
            showCalibrationToast(`Point "${name}" ajouté !`);
        };

        if (btnConfirmHotspot) {
            btnConfirmHotspot.addEventListener('click', handleConfirmHotspot);
        }

        if (hotspotNameInput) {
            hotspotNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmHotspot();
                } else if (e.key === 'Escape') {
                    closeHotspotDialog();
                }
            });
        }

        // Bouton roue crantée (discret/toggleable) pour les outils
        const btnToggleTools = document.getElementById('btn-toggle-tools');
        const toolsPanel = document.getElementById('photo-modal-tools-panel');
        if (btnToggleTools && toolsPanel) {
            btnToggleTools.addEventListener('click', (e) => {
                e.stopPropagation();
                toolsPanel.classList.toggle('hidden');
                btnToggleTools.classList.toggle('active', !toolsPanel.classList.contains('hidden'));
            });
        }

        // Bouton Toggle Mode Annotation
        const btnToggleAnnotation = document.getElementById('btn-toggle-annotation');
        if (btnToggleAnnotation) {
            btnToggleAnnotation.addEventListener('click', (e) => {
                e.stopPropagation();
                isAnnotationMode = !isAnnotationMode;
                updateAnnotationUI();
                if (isAnnotationMode) {
                    showCalibrationToast("Mode Annotation activé : cliquez sur l'image pour ajouter un équipement");
                }
            });
        }

        // Bouton Exporter JSON Hotspots (source de vérité)
        const btnExportHotspots = document.getElementById('btn-export-hotspots');
        if (btnExportHotspots) {
            btnExportHotspots.addEventListener('click', (e) => {
                e.stopPropagation();
                exportHotspotsJSON();
            });
        }

        // Bouton Réinitialiser / Recharger depuis hotspots.json
        const btnResetHotspots = document.getElementById('btn-reset-hotspots');
        if (btnResetHotspots) {
            btnResetHotspots.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm("Voulez-vous réinitialiser tous les points d'intérêt et recharger la source de vérité hotspots.json ?\n(Toutes les modifications locales non exportées seront écrasées)")) {
                    localStorage.removeItem('customHotspotsData');
                    await loadHotspotsData();
                    if (currentOpenedImageUrl) {
                        renderHotspots(currentOpenedImageUrl);
                    }
                    showCalibrationToast("Hotspots réinitialisés depuis hotspots.json !");
                }
            });
        }

        // Fonction centralisée de fermeture de la photo agrandie
        const closePhotoModal = () => {
            const photoModal = document.getElementById('photo-modal');
            if (photoModal) {
                photoModal.classList.add('hidden');
                isAnnotationMode = false;
                updateAnnotationUI();
                closeHotspotDialog();
                if (toolsPanel) toolsPanel.classList.add('hidden');
                if (btnToggleTools) btnToggleTools.classList.remove('active');
                updateBodyScrollLock();
            }
        };

        // Raccourci clavier global Échap pour une accessibilité et ergonomie parfaite
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeTooltip = document.querySelector('.hotspot-pin.active');
                if (activeTooltip) {
                    activeTooltip.classList.remove('active');
                    return;
                }
                const hotspotDialog = document.getElementById('hotspot-dialog');
                if (hotspotDialog && !hotspotDialog.classList.contains('hidden')) {
                    closeHotspotDialog();
                    return;
                }
                if (toolsPanel && !toolsPanel.classList.contains('hidden')) {
                    toolsPanel.classList.add('hidden');
                    if (btnToggleTools) btnToggleTools.classList.remove('active');
                    return;
                }
                const photoModal = document.getElementById('photo-modal');
                if (photoModal && !photoModal.classList.contains('hidden')) {
                    closePhotoModal();
                }
            }
        });

        // Outil d'aide au calibrage (Mode Développeur : Shift + Clic)
        const setupCalibrationTool = (imgElement) => {
            if (!imgElement) return;
            imgElement.addEventListener('click', (e) => {
                const rect = imgElement.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const x = parseFloat(((clickX / rect.width) * 100).toFixed(1));
                const y = parseFloat(((clickY / rect.height) * 100).toFixed(1));

                // Si le Mode Annotation visuel est actif, ouvrir la boîte de dialogue
                if (isAnnotationMode) {
                    openHotspotDialog(x, y);
                    return;
                }

                // En mode normal : Shift + Clic copie le snippet dans la console et le presse-papier
                const codeSnippet = `{ id: "hp-${Date.now().toString().slice(-4)}", nom: "A renommer", x: ${x}, y: ${y} },`;
                if (e.shiftKey) {
                    console.log("%c🎯 [CALIBRAGE HOTSPOT]", "color: #dc3545; font-weight: bold; font-size: 14px;");
                    console.log(codeSnippet);
                    showCalibrationToast(`Coordonnées : x: ${x}%, y: ${y}%`);
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(codeSnippet).catch(() => {});
                    }
                } else {
                    console.log(`[Hotspot Clavier Shift+Clic] x: ${x}%, y: ${y}% (Maintenez Shift pour copier le snippet)`);
                }
            });
        };

        if (btnViewPlan) {
            btnViewPlan.addEventListener('click', () => {
                if (!currentUser) return; // Sécurité optionnelle
                planModal.classList.remove('hidden');
                updateBodyScrollLock();
            });
        }

        // --- Plier / Déplier les sous-sections du Plan de Rangement (optionnel) ---
        const planSubTitles = document.querySelectorAll('.plan-sub-title');
        planSubTitles.forEach(title => {
            title.addEventListener('click', () => {
                title.classList.toggle('collapsed');
                const content = title.nextElementSibling;
                if (content) {
                    const isHidden = content.style.display === 'none';
                    content.style.display = isHidden ? 'block' : 'none';
                }
            });
        });

        const btnResetJson = document.getElementById('btn-reset-json');
        if (btnResetJson) {
            btnResetJson.addEventListener('click', () => {
                if (confirm(`Attention : Vous allez écraser vos vérifications locales et recharger les données brutes du fichier JSON pour le véhicule ${activeVehicule}. Continuer ?`)) {
                    localStorage.removeItem('materiauxData_' + activeVehicule);
                    window.location.reload();
                }
            });
        }

        // Fusion des écouteurs d'événements (Event Delegation)
        document.body.addEventListener('click', (e) => {
            // Fermeture du panneau d'outils si clic en dehors de la barre d'outils
            if (!e.target.closest('.photo-modal-toolbar') && toolsPanel && !toolsPanel.classList.contains('hidden')) {
                toolsPanel.classList.add('hidden');
                if (btnToggleTools) btnToggleTools.classList.remove('active');
            }

            // Fermeture via la croix (X) ou bouton "Fermer"
            if (e.target.classList.contains('btn-close-modal') || e.target.closest('.btn-close-modal')) {
                const modal = e.target.closest('.modal-overlay');
                if (modal) {
                    if (modal.id === 'photo-modal') {
                        closePhotoModal();
                    } else {
                        modal.classList.add('hidden');
                        updateBodyScrollLock();
                    }
                }
                return;
            }

            // Clic sur un point d'intérêt (Hotspot) :
            const clickedPin = e.target.closest('.hotspot-pin');
            if (clickedPin) {
                e.stopPropagation();

                // En Mode Annotation : proposer la suppression du point
                if (isAnnotationMode) {
                    const spotName = clickedPin.getAttribute('aria-label') || 'ce point';
                    if (confirm(`Mode Annotation : Voulez-vous supprimer le point "${spotName}" ?`)) {
                        removeHotspotPoint(currentOpenedImageUrl, clickedPin.getAttribute('data-id'));
                        renderHotspots(currentOpenedImageUrl);
                        showCalibrationToast(`Point "${spotName}" supprimé.`);
                    }
                    return;
                }

                // En Mode Normal : afficher ou masquer l'infobulle
                const isActive = clickedPin.classList.contains('active');
                document.querySelectorAll('.hotspot-pin.active').forEach(p => p.classList.remove('active'));
                if (!isActive) {
                    clickedPin.classList.add('active');
                }
                return;
            }

            // Clic sur l'infobulle ou la boîte de dialogue : ne rien fermer
            if (e.target.closest('.hotspot-tooltip') || e.target.closest('.hotspot-dialog-box')) {
                e.stopPropagation();
                return;
            }

            // Clic sur l'image dans le conteneur interactif :
            if (e.target.closest('.photo-interactive-wrapper')) {
                // En mode normal, referme les infobulles ouvertes
                if (!isAnnotationMode) {
                    document.querySelectorAll('.hotspot-pin.active').forEach(p => p.classList.remove('active'));
                }
                return;
            }

            // Fermeture rapide de la photo agrandie : clic en dehors de la photo (sur l'arrière-plan semi-transparent)
            if (e.target.closest('#photo-modal') && !e.target.closest('.photo-modal-toolbar') && !e.target.closest('.hotspot-dialog')) {
                closePhotoModal();
                return;
            }

            // Fermeture via le clic sur le fond (overlay) pour les autres modales
            // Verrouillage du plan de rangement contre la fermeture accidentelle : #plan-modal ne se ferme PAS au clic extérieur
            if (e.target.classList.contains('modal-overlay')) {
                if (e.target.id === 'plan-modal') {
                    // Ne rien faire lors d'un clic en dehors du contenu du plan
                    return;
                }
                e.target.classList.add('hidden');
                updateBodyScrollLock();
                return;
            }

            // Ouverture de la photo du matériel ou du plan (orientation native + Hotspots)
            if (e.target.classList.contains('btn-photo') || e.target.classList.contains('plan-img')) {
                const imgUrl = e.target.getAttribute('data-image');
                if (imgUrl) {
                    const altText = escapeHtml(e.target.getAttribute('alt') || 'Photo équipement');
                    currentOpenedImageUrl = imgUrl;

                    photoModalContainer.innerHTML = `
                        <div class="photo-interactive-wrapper">
                            <img src="${escapeHtml(imgUrl)}" alt="${altText}" class="photo-enlarged">
                        </div>
                    `;

                    // Génération dynamique des hotspots (lecture en direct de customHotspotsData ou hotspots.json)
                    renderHotspots(imgUrl);

                    const imgElement = photoModalContainer.querySelector('.photo-enlarged');
                    if (imgElement) {
                        setupCalibrationTool(imgElement);
                    }

                    // Réinitialiser le mode annotation à chaque nouvelle photo ouverte
                    isAnnotationMode = false;
                    updateAnnotationUI();
                    closeHotspotDialog();
                    if (toolsPanel) toolsPanel.classList.add('hidden');
                    if (btnToggleTools) btnToggleTools.classList.remove('active');

                    const photoModal = document.getElementById('photo-modal');
                    if (photoModal) {
                        photoModal.classList.remove('hidden');
                        updateBodyScrollLock();
                    }
                }
                return;
            }
            // Bouton "Conforme"
            if (e.target.classList.contains('btn-conforme')) {
                const id = e.target.getAttribute('data-id');
                const item = items.find(m => m.id_produit === id);
                if (item) {
                    item.controlled = true;
                    const dateStr = new Date().toLocaleString('fr-FR', { 
                        day: '2-digit', month: '2-digit', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                    });
                    item.last_verified = dateStr;
                    addLog("Conforme", item.nom);
                    saveItems();
                    renderMateriaux(searchInput ? searchInput.value : '');
                }
                return;
            }
            // Bouton "Anomalie" — ouvre la modale de choix du motif
            if (e.target.classList.contains('btn-anomalie')) {
                const id = e.target.getAttribute('data-id');
                const item = items.find(m => m.id_produit === id);
                if (item) {
                    // Stocker l'ID de l'item en attente de motif et ouvrir la modale
                    pendingAnomalieItemId = id;
                    anomalieModal.classList.remove('hidden');
                }
                return;
            }
            // Bouton "Annuler" (Mode Inventaire) — rétablit l'item avant contrôle
            if (e.target.classList.contains('btn-undo')) {
                const id = e.target.getAttribute('data-id');
                const item = items.find(m => m.id_produit === id);
                if (item) {
                    // Restaurer l'état précédent si une anomalie avait été appliquée
                    if (item.etat_precedent) {
                        item.etat = item.etat_precedent;
                        delete item.etat_precedent;
                        delete item.motif_anomalie;
                    }
                    item.controlled = false;
                    delete item.last_verified;
                    addLog("Annulation du contrôle", item.nom);
                    saveItems();
                    renderMateriaux(searchInput ? searchInput.value : '');
                }
                return;
            }
            // Bouton "Modifier" (Édition)
            if (e.target.classList.contains('btn-action')) {
                const id = e.target.getAttribute('data-id');
                const item = items.find(m => m.id_produit === id);
                if (item) {
                    editIdInput.value = item.id_produit;
                    editNomInput.value = item.nom;
                    editQuantiteInput.value = item.quantite;
                    editDateInput.value = item.date_peremption || '';
                    editStatutInput.value = ["Opérationnel", "Non opérationnel", "Abîmé", "Manquant", "Périmé", "Non testable"].includes(item.etat) ? item.etat : 'Non opérationnel';
                    
                    editModal.classList.remove('hidden');
                }
                return;
            }
        });

    } catch (err) {
            console.error("Erreur app.js:", err);
            vehiculeInfo.innerHTML = "<h1>Erreur de chargement des données</h1>";
            
            const mainContainer = document.querySelector('main');
            if (mainContainer) {
                mainContainer.innerHTML = `
                    <div style="text-align: center; margin-top: 50px;">
                        <h2 style="color: #dc3545;">Impossible de charger les données de l'inventaire</h2>
                        <p style="color: #555;">Une erreur réseau ou de fichier est survenue.</p>
                        <button id="btn-retry-init" class="btn-save" style="margin-top: 15px; padding: 10px 20px;">🔄 Réessayer</button>
                    </div>
                `;
                
                const btnRetry = document.getElementById('btn-retry-init');
                if (btnRetry) {
                    btnRetry.addEventListener('click', () => {
                        mainContainer.innerHTML = ''; // Nettoyer
                        initApp();
                    });
                }
            }
        }
    };

    initApp();
});