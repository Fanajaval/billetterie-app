# Billetterie

Application mobile de création et de contrôle de billets pour des événements. Elle permet de générer des billets personnalisés au format PDF, chacun avec un QR code chiffré et signé, puis de les contrôler depuis un téléphone.

## Fonctions principales

- Importer un modèle de billet (PNG, JPG ou WEBP).
- Positionner le QR code et le numéro de billet sur le modèle.
- Générer plusieurs billets numérotés dans un PDF partageable.
- Scanner les QR codes avec la caméra du téléphone.
- Vérifier la validité et la signature d’un billet.
- Signaler les billets déjà scannés.
- Conserver un historique des générations et des scans, localement et dans Firebase lorsque la connexion est disponible.
- Utiliser le mode clair, sombre ou celui du téléphone.

## Prérequis

Avant de démarrer, installez :

- [Node.js LTS](https://nodejs.org/) (version 20 ou plus récente recommandée) ;
- l’application **Expo Go** sur votre téléphone Android ou iPhone, pour les essais rapides ;
- un téléphone connecté au même réseau Wi-Fi que l’ordinateur, pour tester avec Expo Go.

Pour créer une version Android ou iOS installable, un compte Expo est également nécessaire.

## Installation

Depuis le dossier du projet, installez les dépendances :

```bash
npm install
```

Puis démarrez l’application :

```bash
npm start
```

Un QR code s’affiche dans le terminal.

- **Android / iPhone :** ouvrez Expo Go et scannez ce QR code.
- **Navigateur :** appuyez sur `w` dans le terminal, ou utilisez :

  ```bash
  npm run web
  ```

> Le scanner de billets fonctionne uniquement sur mobile. La version web sert surtout à préparer et générer les billets.

## Commandes utiles

| Commande | Utilité |
| --- | --- |
| `npm start` | Démarre Expo avec le menu interactif. |
| `npm run android` | Ouvre l’application sur Android (émulateur ou téléphone configuré). |
| `npm run ios` | Ouvre l’application sur iOS (macOS requis pour un simulateur). |
| `npm run web` | Lance la version navigateur. |

## Utilisation

### 1. Générer des billets

1. Ouvrez l’onglet **Générer**.
2. Importez l’image vierge du billet.
3. Placez les zones du QR code et du numéro sur l’aperçu. Vous pouvez ajouter plusieurs zones si une même information doit apparaître à plusieurs endroits.
4. Choisissez le format, le nombre de pages, le préfixe et le premier numéro de billet.
5. Lancez la génération puis partagez ou imprimez le PDF créé.

Les numéros sont construits à partir du préfixe, du numéro de départ et du nombre de zéros choisi. Par exemple, avec `TKT-`, départ `1` et remplissage `4`, le premier billet est `TKT-0001`.

### 2. Contrôler l’entrée

1. Ouvrez l’onglet **Scanner** sur un téléphone.
2. Autorisez l’accès à la caméra lorsque l’application le demande.
3. Cadrez le QR code du billet.
4. L’application indique si le billet est valide, invalide ou déjà utilisé.

L’historique des scans peut être effacé depuis cet écran. Faites-le uniquement au début d’un nouvel événement : cette action permettrait à nouveau le passage de billets déjà scannés.

## Autorisations demandées

- **Caméra :** indispensable pour scanner et valider les QR codes.
- **Photos / fichiers :** utilisée pour sélectionner l’image qui sert de modèle de billet.

Refuser la caméra n’empêche pas la génération de billets, mais bloque le contrôle à l’entrée.

## Firebase et fonctionnement hors ligne

L’application utilise Firebase Firestore pour synchroniser :

- l’historique de génération ;
- la liste des billets déjà scannés.

Si Firebase ou Internet est indisponible, l’application s’appuie sur les données stockées sur le téléphone. Cette solution est pratique en dépannage, mais elle ne garantit pas la détection d’un même billet scanné sur **deux téléphones différents hors connexion**.

Pour un événement avec plusieurs contrôleurs, vérifiez la connexion de tous les appareils avant l’ouverture des portes.

## Créer une version installable

La configuration de construction est déjà présente dans `eas.json`. Installez l’outil Expo Application Services, connectez-vous à Expo, puis lancez une construction :

```bash
npm install --global eas-cli
eas login
eas build --platform android --profile preview
```

Pour une version destinée à la publication, utilisez le profil `production` :

```bash
eas build --platform android --profile production
```

La même commande accepte `ios` à la place de `android` pour une construction iPhone.

## Points importants avant une mise en production

- Configurez des règles Firestore strictes : les collections d’historique et de scans ne doivent pas être librement lisibles ou modifiables par n’importe qui.
- Les secrets de signature sont actuellement présents dans `src/lib/ticketAuth.ts`. Ils doivent être déplacés vers une infrastructure serveur sécurisée avant toute diffusion publique de l’application ; une clé intégrée à une application peut être extraite.
- Ne réutilisez pas le même identifiant d’événement pour des événements différents. Adaptez `DEFAULT_EVENT_ID` dans `src/lib/ticketAuth.ts` ou prévoyez une sélection d’événement dans l’application.
- Testez un cycle complet avant chaque événement : génération, impression ou partage, scan valide, deuxième scan du même billet et scan d’un QR code non conforme.
- Sauvegardez vos modèles de billets et vos PDF générés dans un emplacement sûr.

## Structure du projet

```text
App.tsx                    Point d’entrée de l’application
src/components/            Écrans de génération, scan, historique et réglages
src/lib/pdf.ts             Création et partage des PDF
src/lib/ticketAuth.ts      Création et validation des QR codes sécurisés
src/lib/history.ts         Historique des générations
src/lib/scannedTickets.ts  Gestion des billets déjà contrôlés
src/lib/firebase.ts        Connexion à Firebase Firestore
app.json                   Configuration Expo (nom, icônes, permissions)
eas.json                   Profils de construction Android/iOS
```

## Dépannage rapide

- **Le téléphone ne trouve pas le projet :** vérifiez que le téléphone et l’ordinateur sont sur le même Wi-Fi, puis relancez `npm start`.
- **La caméra ne s’ouvre pas :** autorisez la caméra dans les réglages du téléphone et redémarrez l’application.
- **Les billets ne se synchronisent pas :** vérifiez la connexion Internet et les règles Firestore ; les données locales restent disponibles sur le téléphone.
- **Le QR code est refusé :** assurez-vous qu’il a été généré par cette application et qu’il n’a pas été endommagé à l’impression.

## Technologies

- Expo et React Native
- TypeScript
- Firebase Firestore
- QR codes, chiffrement AES et signatures Ed25519
