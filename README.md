# Multicompte

Petite appli Android pour suivre chaque jour les tâches d'un jeu mobile sur plusieurs comptes.
Les comptes et les tâches se créent dans l'appli, et tout reste stocké sur le téléphone.
La remise à zéro suit celle du jeu : minuit UTC, soit 1h du matin l'hiver et 2h l'été en France.

## Télécharger l'appli

Le dernier APK est toujours disponible ici (remplacer `UTILISATEUR` par le nom du compte GitHub) :

https://github.com/UTILISATEUR/multicompte/releases/latest/download/multicompte.apk

Sur le téléphone : ouvrir le lien, télécharger, puis ouvrir le fichier. Android demande d'autoriser
l'installation depuis le navigateur la première fois. Pour une mise à jour, installer le nouvel APK
par-dessus : les données sont conservées.

## Comment l'APK est fabriqué

À chaque modification envoyée sur la branche `main`, GitHub compile l'APK tout seul
(onglet **Actions**, environ 5 minutes) puis le publie dans **Releases**.

## Contenu du projet

- `www/` : l'appli elle-même (HTML, CSS, JavaScript)
- `assets/` : icône et écran de démarrage
- `android-res/` : icône des notifications
- `keystore/` : clé de signature (garde la même signature d'une version à l'autre, ne pas la supprimer)
- `.github/workflows/build-apk.yml` : la recette de compilation
