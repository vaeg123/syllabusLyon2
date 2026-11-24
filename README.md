# Méthode du syllabus – TD Accompagnement L1 AES (2026-2027)

Site statique (HTML, CSS, JavaScript sans dépendance) pour apprendre la méthode OR3 :
Observer, Repérer, Relier, Reformuler.

## Contenu
- `index.html` : point d'entrée
- `assets/style.css` : mise en page
- `assets/plan3d.js` : plan en 3D (passage du plan vertical au plan horizontal)
- `assets/app.js` : pages, exercices, progression
- `assets/data-gqc.js` : parcours « Grandes questions contemporaines » (contenu issu de la fiche et du corrigé)

Pour ajouter une matière : créer `assets/data-<id>.js` sur le modèle de `data-gqc.js`,
l'inclure dans `index.html`, puis l'activer dans la liste des matières (`AUTRES` dans `app.js`).

## Confidentialité
Aucune donnée n'est collectée. Les réponses des étudiants sont enregistrées dans leur
navigateur (localStorage), sur leur appareil uniquement.

## Mise en ligne sur GitHub Pages
1. Créer un dépôt public sur GitHub (par exemple `methode-syllabus`).
2. Y déposer le contenu de ce dossier `site/` (à la racine du dépôt), fichier `.nojekyll` compris.
3. Dans le dépôt : Settings → Pages → Source « Deploy from a branch » → branche `main`, dossier `/ (root)`.
4. Le site est disponible après une ou deux minutes à l'adresse
   `https://<votre-identifiant>.github.io/methode-syllabus/`.

## Tester en local
Ouvrir `index.html` dans un navigateur (double-clic) : aucun serveur n'est nécessaire.
