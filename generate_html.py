import json

vpi_images = [
    'arrière vpi', 'Bac commandes VPI', 'Bac Cordages VPI', 'Bac hydraulique', 'bac tronçonneuse',
    'cabine arrière gauche', 'cabine avant droit', 'cabine avant gauche', 'cabine coffre banquette',
    'cabine arrière gauche3', 'Coffre bas arrière gauche', 'coffre bas avant gauche',
    'Coffre latérale arrière droit', 'Coffre latérale avant droit', 'coffre toit VPI',
    'latéral arrière gauche', 'latéral avant gauche', 'Sac PS poche avant VPI', 'Sac PS Poche latérale SAT',
    'Sac PS VPI éclaté', 'Sac PS VPI Poche latérale hémorragie', 'Sac PS2', 'Sacoche jaune PS',
    'Sacoche rouge PS', 'Sacoche verte PS', 'VPI arrière', 'VPI coffre bas arrière droit',
    'VPI coffre bas avant droit'
]

vtule_images = [
    'bac d\'urgence', 'Bac EPI VTULE', 'DSA dans Sac PS', 'Gants dans PS', 'Masque dans PS',
    'Sac aspi mucosités', 'Sac Bilan dans PS', 'sac oxygénation éclaté', 'Sac oxygénation',
    'sac oxygénation1', 'sac oxygénation2', 'Sac PS VTULE poche avant', 'Sac PS VTULE poche avant2',
    'Sac PS VTULE', 'Sac PS1 VTULE', 'Sac tensiomètre', 'Sacs DASRI dans PS', 'VTULE coffre antiere',
    'VTULE coffre'
]

rotated = ['cabine avant gauche', 'cabine avant droit', 'cabine arrière gauche', 'cabinet arrière gauche3', 'cabine arrière gauche3', 'Sac PS VTULE', 'Sac PS1 VTULE']

def gen_cards(images):
    html = ''
    for img in images:
        rot = ' rotate-right' if img in rotated else ''
        html += f'''
                <div class="plan-card">
                    <div class="img-container">
                        <picture>
                            <source srcset="images/{img}.avif" type="image/avif">
                            <img src="images/{img}.jpg" alt="{img}" class="plan-img{rot}" data-image="images/{img}.avif">
                        </picture>
                    </div>
                    <p>{img}</p>
                </div>'''
    return html

html = f'''
        <div class="plan-zone" data-vehicule="VPI">
            <h4 class="plan-zone-title" data-zone="vpi">🚒 Plan de rangement VPI ▾</h4>
            <div class="plan-grid plan-zone-content" data-zone-content="vpi">
{gen_cards(vpi_images)}
            </div>
        </div>

        <div class="plan-zone" data-vehicule="VTULE">
            <h4 class="plan-zone-title" data-zone="vtule">🚑 Plan de rangement VTULE ▾</h4>
            <div class="plan-grid plan-zone-content" data-zone-content="vtule">
{gen_cards(vtule_images)}
            </div>
        </div>
'''
with open('generated_plan.html', 'w', encoding='utf-8') as f:
    f.write(html)
