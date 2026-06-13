# 📖 Playbook de Recette & Test : Intégration Alcatel O2G

Ce playbook est un guide pas-à-pas pour tester le projet `alcatel-o2g-react-node` de manière rigoureuse lors de votre connexion au véritable équipement Alcatel OmniPCX Enterprise (OXE) du client.

---

## Phase 1 : Prérequis (À valider avec l'Admin Client)

Avant de lancer le moindre test, assurez-vous d'avoir rassemblé ces 4 éléments avec l'administrateur système du client :

1. **L'URL ou l'IP de l'O2G** (ex: `https://192.168.10.50` ou `https://o2g.client.local`).
2. **Le Compte Applicatif O2G** : Un *Login* et un *Mot de passe* configurés dans l'O2G (Attention, ce n'est pas le mot de passe d'un utilisateur classique, c'est un compte applicatif tiers).
3. **Le Numéro d'un Poste de Test** : L'extension d'un téléphone physique Alcatel posé sur un bureau (ex: `2001`). L'admin doit confirmer que ce poste a la licence **CSTA / O2G Call Control** active.
4. **Accessibilité Réseau** : Votre ordinateur (qui fait tourner le serveur Node.js) doit pouvoir *ping* ou joindre l'adresse IP de l'O2G. Si vous êtes à distance, assurez-vous d'être connecté au VPN du client.

---

## Phase 2 : Configuration du Projet

1. Ouvrez le dossier `alcatel-o2g-react-node/backend`.
2. Ouvrez le fichier `.env` (créez-le à partir de `.env.example` s'il n'existe pas).
3. Remplissez les valeurs exactes :
   ```env
   PORT=4000
   O2G_BASE_URL=https://<IP_ALCATEL>
   O2G_APP_NAME=<LOGIN>
   O2G_APP_PASSWORD=<MOT_DE_PASSE>
   O2G_DEVICE_ID=<POSTE_DE_TEST>  # ex: 2001
   
   # Laisser à 0 si le client utilise un certificat non reconnu (très fréquent)
   NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

---

## Phase 3 : Lancement des Serveurs

Ouvrez deux terminaux différents sur votre machine.

**Terminal 1 (Backend Node.js) :**
```bash
cd alcatel-o2g-react-node/backend
npm start
```
*Le terminal doit afficher : `🚀 Serveur Backend Alcatel O2G démarré sur http://localhost:4000`*

**Terminal 2 (Frontend React) :**
```bash
cd alcatel-o2g-react-node/frontend
npm run dev
```
*Ouvrez votre navigateur sur l'adresse indiquée (généralement `http://localhost:5173`).*

---

## Phase 4 : Scénarios de Tests Fonctionnels

Effectuez ces tests de manière séquentielle. Gardez un œil sur le **Terminal 1 (Backend)** pour voir les logs en temps réel.

### ✅ Scénario 1 : Authentification & Souscription CSTA
1. Sur l'interface Web, cliquez sur le bouton bleu **"Établir la connexion"**.
2. **Ce qu'il doit se passer :**
   - L'interface passe sur l'écran "Composeur" et le badge en haut à droite devient Vert (`En Ligne - Poste XXXX`).
   - *Côté Téléphone physique* : Rien, le téléphone reste silencieux.
   - *Côté Terminal Node.js* : Vous devez voir les messages :
     - `✅ Authentification O2G réussie`
     - `✅ Souscription CSTA créée`
     - `✅ WebSocket O2G connectée`

### ✅ Scénario 2 : Appel Sortant (Make Call / Click-to-call)
1. Prenez un second téléphone portable ou un autre poste de bureau (ex: `0612345678`).
2. Sur l'interface Web, dans la section **Composeur**, tapez le numéro du second téléphone.
3. Cliquez sur **"Appeler"**.
4. **Ce qu'il doit se passer :**
   - Le téléphone physique Alcatel de test (`2001`) va se mettre en "mains-libres" automatiquement ou sonner pour vous inviter à décrocher le combiné.
   - Une fois le combiné Alcatel décroché, le second téléphone (`0612345678`) se met à sonner.
   - Sur l'interface Web, une carte d'appel apparaît avec l'état `dialing` ou `active`.
5. Raccrochez depuis le téléphone physique, la carte d'appel doit disparaître du Web.

### ✅ Scénario 3 : Supervision d'Appel Entrant (CSTA)
1. N'utilisez pas l'interface Web. Le téléphone Alcatel de test (`2001`) est raccroché.
2. Prenez votre téléphone portable, et appelez le poste `2001`.
3. **Ce qu'il doit se passer :**
   - Le téléphone physique Alcatel sonne.
   - **Instantanément**, une carte d'appel apparaît sur l'interface Web avec l'état `ringing` et la mention `↙ Entrant`.
   - Vous devez voir le numéro de votre portable s'afficher dans "De: XXX".

### ✅ Scénario 4 : Call Control (Répondre / Raccrocher)
1. Répétez le Scénario 3 (appelez le poste de test).
2. La carte s'affiche en `ringing` sur le Web.
3. Cliquez sur le bouton vert **"Répondre"** sur l'interface Web.
   - *Résultat attendu* : Le téléphone physique Alcatel décroche tout seul en mode mains-libres (si compatible), la conversation commence. L'état sur le web passe à `active`.
4. Cliquez sur le bouton rouge **"Raccrocher"** sur l'interface Web.
   - *Résultat attendu* : La communication coupe, le téléphone physique raccroche.

---

## 🛑 Dépannage (Troubleshooting)

Si la Phase 4 bloque, voici comment interpréter les erreurs du Terminal Node.js :

- **Erreur HTTP 401 Unauthorized / HTTP 403 Forbidden** lors du clic sur "Connecter" :
  - **Cause** : Le mot de passe ou le nom d'application est faux.
  - **Action** : Demander à l'admin de réinitialiser le mot de passe de l'application O2G.

- **Erreur `getaddrinfo ENOTFOUND` ou `ECONNREFUSED`** :
  - **Cause** : L'URL de base est fausse, ou votre PC n'est pas connecté au bon réseau/VPN, ou un Firewall bloque le port.
  - **Action** : Essayez de taper l'URL de l'O2G dans votre propre navigateur pour voir si le réseau répond.

- **Erreur HTTP 404 Not Found sur `/subscriptions`** ou **Pas d'événements lors d'appels** :
  - **Cause** : Le Device ID (le poste `2001`) n'existe pas dans le PABX, ou n'a pas la licence CSTA pour être supervisé.
  - **Action** : L'admin Alcatel doit vérifier les licences CSTA ("CSTA profiles") sur ce poste spécifique.
