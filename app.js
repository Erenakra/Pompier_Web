document.addEventListener('DOMContentLoaded', async () => {
    const vehiculeInfo = document.getElementById('vehicule-info');
    const alertBanner = document.getElementById('alert-banner');
    const containers = {
        "Sac prompt secours": document.getElementById('liste-prompt-secours'),
        "Sac oxygénation": document.getElementById('liste-oxygenation'),
        "Général": document.getElementById('liste-general')
    };

    try {
        const [resVehicule, resMateriaux] = await Promise.all([
            fetch('vehicules.json'),
            fetch('materiaux.json')
        ]);

        if (!resVehicule.ok || !resMateriaux.ok) throw new Error('Échec du fetch');

        const vehicule = await resVehicule.json();
        const materiaux = await resMateriaux.json();

        // Infos véhicule
        vehiculeInfo.innerHTML = `
            <h1>${vehicule.id}</h1>
            <p>Responsable : <strong>${vehicule.responsable_actuel}</strong></p>
        `;

        const searchInput = document.getElementById('search-input');

        const now = new Date();
        let isGlobalCritical = false;
        const items = Array.isArray(materiaux) ? materiaux : [materiaux];

        // Vérification globale des éléments critiques pour la bannière d'alerte
        items.forEach(m => {
            const isExpired = m.perimable && new Date(m.date_peremption) < now;
            if (m.etat === "Abîmé" || m.etat === "Manquant" || isExpired) {
                isGlobalCritical = true;
            }
        });

        if (isGlobalCritical) alertBanner.classList.remove('hidden');

        // Fonction de rendu dynamique selon la recherche
        const renderMateriaux = (query = '') => {
            const normalizedQuery = query.trim().toLowerCase();

            Object.entries(containers).forEach(([zone, container]) => {
                // Filtrage selon le nom du matériel ou l'emplacement
                const filtered = items.filter(m => {
                    if (m.emplacement !== zone) return false;
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
                        const today = new Date();
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
                                <div class="materiel-nom">${m.nom}</div>
                                <div class="localisation-badge">📍 ${m.localisation_precise}</div>
                                <div class="badges-container">
                                    <span class="badge">📦 ${m.quantite}</span>
                                    <span class="badge">${m.etat === 'Opérationnel' ? '✅' : '❌'} ${m.etat}</span>
                                    ${m.perimable ? `<span class="badge ${expirationBadgeClass}">⏳ ${expirationText}</span>` : ''}
                                    ${m.pression_bars ? `<span class="badge">💨 ${m.pression_bars} bars</span>` : ''}
                                </div>
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
        };

        // Rendu initial
        renderMateriaux('');

        // Filtrage en temps réel lors de la saisie
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderMateriaux(e.target.value);
            });
        }

        // --- Mode Inventaire ---
        const btnToggleInventory = document.getElementById('btn-toggle-inventory');
        if (btnToggleInventory) {
            btnToggleInventory.addEventListener('click', () => {
                document.body.classList.toggle('inventory-mode-active');
                if (document.body.classList.contains('inventory-mode-active')) {
                    btnToggleInventory.classList.add('active');
                    btnToggleInventory.innerText = '❌ Désactiver le Mode Inventaire';
                } else {
                    btnToggleInventory.classList.remove('active');
                    btnToggleInventory.innerText = '📋 Activer le Mode Inventaire';
                    
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
                        const expired = m.perimable && m.date_peremption && new Date(m.date_peremption) < now;
                        return m.etat === "Abîmé" || m.etat === "Manquant" || m.etat === "Non opérationnel" || expired;
                    });
                    
                    if (isGlobalCritical) {
                        alertBanner.classList.remove('hidden');
                    } else {
                        alertBanner.classList.add('hidden');
                    }
                    
                    renderMateriaux(searchInput ? searchInput.value : '');
                    closeEditModal();
                }
            });
        }

        // Gestion des clics sur les boutons d'actions (délégation d'événements)
        document.body.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-conforme')) {
                const id = e.target.getAttribute('data-id');
                const item = items.find(m => m.id_produit === id);
                if (item) {
                    item.controlled = true;
                    renderMateriaux(searchInput ? searchInput.value : '');
                }
            } else if (e.target.classList.contains('btn-anomalie')) {
                const id = e.target.getAttribute('data-id');
                const item = items.find(m => m.id_produit === id);
                if (item) {
                    item.etat = "Non opérationnel";
                    isGlobalCritical = true;
                    alertBanner.classList.remove('hidden');
                    renderMateriaux(searchInput ? searchInput.value : '');
                }
            } else if (e.target.classList.contains('btn-action')) {
                // TODO: Vérifier le rôle de l'utilisateur avant d'autoriser l'édition
                const id = e.target.getAttribute('data-id');
                const item = items.find(m => m.id_produit === id);
                if (item) {
                    editIdInput.value = item.id_produit;
                    editNomInput.value = item.nom;
                    editQuantiteInput.value = item.quantite;
                    editDateInput.value = item.date_peremption || '';
                    editStatutInput.value = item.etat === 'Opérationnel' ? 'Opérationnel' : 'Non opérationnel';
                    
                    editModal.classList.remove('hidden');
                }
            }
        });

    } catch (err) {
        console.error("Erreur app.js:", err);
        vehiculeInfo.innerHTML = "<h1>Erreur de chargement des données</h1>";
    }
});