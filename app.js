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

    const initApp = async () => {
        try {
            const resVehicule = await fetch('vehicules.json');
            if (!resVehicule.ok) throw new Error('Échec du fetch véhicule');
            const vehicule = await resVehicule.json();

            let materiaux;
            const localData = localStorage.getItem('materiauxData');
            
            if (localData) {
                materiaux = JSON.parse(localData);
            } else {
                const resMateriaux = await fetch('materiaux.json');
                if (!resMateriaux.ok) throw new Error('Échec du fetch materiaux');
                materiaux = await resMateriaux.json();
            }

            // Infos véhicule
            vehiculeInfo.innerHTML = `
                <h1>${escapeHtml(vehicule.id)}</h1>
                <p>Responsable : <strong>${escapeHtml(vehicule.responsable_actuel)}</strong></p>
            `;

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
        let isGlobalCritical = false;
        
        const items = Array.isArray(materiaux) ? materiaux : [materiaux];
        const saveItems = () => {
            localStorage.setItem('materiauxData', JSON.stringify(items));
        };
        
        if (!localData) {
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
                // Filtrage selon le nom du matériel, l'emplacement et activeFilter
                const filtered = items.filter(m => {
                    if (m.emplacement !== zone) return false;
                    
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
                                <button class="btn-conforme" data-id="${m.id_produit}">✅ Conforme</button>
                                <button class="btn-anomalie" data-id="${m.id_produit}">❌ Anomalie</button>
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
                    
                    // Correction du bug : réinitialiser l'état contrôlé de tous les items
                    items.forEach(m => m.controlled = false);
                    renderMateriaux(searchInput ? searchInput.value : '');
                }
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

        // --- Système d'Images (Plan et Photos) ---
        const btnViewPlan = document.getElementById('btn-view-plan');
        const planModal = document.getElementById('plan-modal');
        const photoModal = document.getElementById('photo-modal');
        const photoModalContainer = document.getElementById('photo-modal-container');

        if (btnViewPlan) {
            btnViewPlan.addEventListener('click', () => {
                if (!currentUser) return; // Sécurité optionnelle
                planModal.classList.remove('hidden');
            });
        }

        const btnResetJson = document.getElementById('btn-reset-json');
        if (btnResetJson) {
            btnResetJson.addEventListener('click', () => {
                if (confirm("Attention : Vous allez écraser vos vérifications locales et recharger les données brutes du fichier JSON. Continuer ?")) {
                    localStorage.removeItem('materiauxData');
                    window.location.reload();
                }
            });
        }

        // Fusion des écouteurs d'événements (Event Delegation)
        document.body.addEventListener('click', (e) => {
            // Fermeture via la croix
            if (e.target.classList.contains('btn-close-modal')) {
                e.target.closest('.modal-overlay').classList.add('hidden');
                return;
            }
            // Fermeture via le clic sur le fond (overlay) uniquement, pas sur le contenu
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.add('hidden');
                return;
            }
            // Ouverture de la photo du matériel ou du plan
            if (e.target.classList.contains('btn-photo') || e.target.classList.contains('plan-img')) {
                const imgUrl = e.target.getAttribute('data-image');
                if (imgUrl) {
                    if (e.target.classList.contains('plan-img')) {
                        planModal.classList.add('hidden');
                    }
                    const jpgUrl = imgUrl.replace(/\.avif$/i, '.jpg');
                    const altText = escapeHtml(e.target.getAttribute('alt') || 'Photo équipement');
                    
                    photoModalContainer.innerHTML = `
                        <picture>
                            <source srcset="${escapeHtml(imgUrl)}" type="image/avif">
                            <img src="${escapeHtml(jpgUrl)}" alt="${altText}" style="max-width: 100%; max-height: 80vh; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                        </picture>
                    `;
                    photoModal.classList.remove('hidden');
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
            // Bouton "Anomalie"
            if (e.target.classList.contains('btn-anomalie')) {
                const id = e.target.getAttribute('data-id');
                const item = items.find(m => m.id_produit === id);
                if (item) {
                    item.etat = "Non opérationnel";
                    item.controlled = true;
                    const dateStr = new Date().toLocaleString('fr-FR', { 
                        day: '2-digit', month: '2-digit', year: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                    });
                    item.last_verified = dateStr;
                    isGlobalCritical = true;
                    alertBanner.classList.remove('hidden');
                    addLog("Anomalie", item.nom);
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
                    editStatutInput.value = ["Opérationnel", "Non opérationnel", "Abîmé", "Manquant"].includes(item.etat) ? item.etat : 'Non opérationnel';
                    
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