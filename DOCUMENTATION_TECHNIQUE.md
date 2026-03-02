# Documentation Technique - GSB Backend

## Table des matières

1. [Architecture du projet](#1-architecture-du-projet)
2. [Modèles de données](#2-modèles-de-données)
3. [Authentification et sécurité](#3-authentification-et-sécurité)
4. [Contrôleurs](#4-contrôleurs)
5. [Routes](#5-routes)
6. [Middlewares](#6-middlewares)
7. [Services (Upload S3)](#7-services-upload-s3)
8. [Système de mailing](#8-système-de-mailing)
9. [Tâches planifiées (Cron)](#9-tâches-planifiées-cron)
10. [Variables d'environnement](#10-variables-denvironnement)
11. [Gestion des erreurs](#11-gestion-des-erreurs)
12. [Diagrammes](#12-diagrammes)

---

## 1. Architecture du projet

```
GSB_BACKEND/
├── index.js                  # Point d'entrée de l'application
├── package.json              # Dépendances et scripts
├── .env                      # Variables d'environnement (non versionné)
├── controllers/              # Logique métier
│   ├── authentification_controller.js
│   ├── bills_controller.js
│   └── users_controller.js
├── models/                   # Schémas Mongoose (MongoDB)
│   ├── bills_model.js
│   └── user_model.js
├── routes/                   # Définition des routes Express
│   ├── authentification_routes.js
│   ├── bills_routes.js
│   └── user_routes.js
├── middlewares/               # Middlewares personnalisés
│   └── upload.js
├── mails/                    # Services d'envoi d'emails
│   ├── mailService.js
│   └── cron.js
└── utils/                    # Utilitaires
    └── utils.js
```

### Pattern architectural : MVC (Model-View-Controller)

L'application suit le pattern MVC sans la couche View (API REST pure) :

- **Model** : Schémas Mongoose définissant la structure des données et les hooks de validation
- **Controller** : Fonctions asynchrones gérant la logique métier
- **Routes** : Définition des endpoints HTTP et association aux contrôleurs

---

## 2. Modèles de données

### 2.1 User (`models/user_model.js`)

Représente un utilisateur de l'application (visiteur médical ou administrateur).

#### Schéma

| Champ       | Type     | Requis | Unique | Défaut       | Description                      |
|-------------|----------|:------:|:------:|--------------|----------------------------------|
| `name`      | String   | ✅     | ❌     | —            | Nom complet de l'utilisateur     |
| `email`     | String   | ✅     | ✅     | —            | Adresse email (identifiant)      |
| `password`  | String   | ✅     | ❌     | —            | Mot de passe hashé (SHA-256)     |
| `role`      | String   | ✅     | ❌     | —            | Rôle : `admin` ou `visiteur`     |
| `createdAt` | String   | ❌     | ❌     | `Date.now`   | Date de création du compte       |

#### Hooks (Middlewares Mongoose)

**`pre('save')`** :
- Vérifie si un utilisateur avec le même email existe déjà
- Si doublon → lance une erreur avec `cause: 400`
- Hash le mot de passe avec SHA-256 + salt : `sha256(password + process.env.salt)`

**`pre('findOneAndUpdate')`** :
- Vérifie l'unicité de l'email avant la mise à jour

#### Exemple de document

```json
{
  "_id": "64a1b2c3d4e5f6a7b8c9d0e1",
  "name": "Jean Dupont",
  "email": "jean.dupont@gsb.fr",
  "password": "a3f5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3",
  "role": "visiteur",
  "createdAt": "1700000000000"
}
```

---

### 2.2 Bill (`models/bills_model.js`)

Représente une note de frais soumise par un utilisateur.

#### Schéma

| Champ         | Type     | Requis | Défaut         | Description                               |
|---------------|----------|:------:|----------------|-------------------------------------------|
| `date`        | String   | ✅     | —              | Date de la dépense                        |
| `amount`      | Number   | ✅     | —              | Montant de la dépense (en €)              |
| `proof`       | String   | ✅     | —              | URL du justificatif stocké sur AWS S3     |
| `description` | String   | ✅     | —              | Description de la dépense                 |
| `userEmail`   | String   | ✅     | —              | Email de l'utilisateur ayant soumis       |
| `status`      | String   | ✅     | —              | Statut : `En attente`, `Validé`, `Refusé` |
| `type`        | String   | ✅     | —              | Type de frais (transport, repas, etc.)    |
| `createdAt`   | String   | ❌     | `Date.now()`   | Date de création de la note               |

#### Hook `pre('save')`

Avant chaque sauvegarde, le hook vérifie la validité de la note :
- Description non vide
- Montant > 0
- Justificatif présent
- Statut = "En attente"

En cas d'erreur de saisie, un **email d'alerte** est envoyé à l'utilisateur via `envoyerMailErreurSaisie()`, avec un mécanisme anti-spam (max 1 email par 10 minutes par utilisateur).

#### Exemple de document

```json
{
  "_id": "64b2c3d4e5f6a7b8c9d0e1f2",
  "date": "2026-02-15",
  "amount": 45.50,
  "proof": "https://gsb-backend.s3.amazonaws.com/abc123.jpg",
  "description": "Repas client - Restaurant Le Gourmet",
  "userEmail": "jean.dupont@gsb.fr",
  "status": "En attente",
  "type": "Repas",
  "createdAt": "1700000000000"
}
```

---

## 3. Authentification et sécurité

### 3.1 Processus de connexion

```
Client                          Serveur
  |                                |
  |  POST /auth/login              |
  |  { email, password }           |
  |------------------------------->|
  |                                |  1. Recherche user par email
  |                                |  2. Hash password + salt
  |                                |  3. Compare avec le hash stocké
  |                                |  4. Génère un token JWT (24h)
  |  { token: "eyJhbG..." }       |
  |<-------------------------------|
  |                                |
  |  GET /bills                    |
  |  Authorization: Bearer <token> |
  |------------------------------->|
  |                                |  5. verifyToken middleware
  |                                |  6. Décode le JWT
  |                                |  7. Ajoute req.user
  |  { data: [...] }              |
  |<-------------------------------|
```

### 3.2 Token JWT

**Payload du token** :
```json
{
  "id": "64a1b2c3d4e5f6a7b8c9d0e1",
  "role": "visiteur",
  "email": "jean.dupont@gsb.fr",
  "name": "Jean Dupont",
  "iat": 1700000000,
  "exp": 1700086400
}
```

- **Durée de validité** : 24 heures
- **Algorithme** : HS256 (par défaut)
- **Secret** : défini via `process.env.JWT_SECRET`

### 3.3 Hashage des mots de passe

- **Algorithme** : SHA-256
- **Salage** : Le mot de passe est concaténé avec `process.env.salt` avant le hash
- **Formule** : `sha256(password + salt)`
- Le hashage est effectué automatiquement dans le hook `pre('save')` du modèle User

### 3.4 Middleware `verifyToken`

Fonction middleware qui protège les routes nécessitant une authentification :

1. Extrait le token du header `Authorization: Bearer <token>`
2. Vérifie la validité du token avec `jwt.verify()`
3. Ajoute les données décodées dans `req.user`
4. Retourne `401` si le token est absent, invalide ou expiré

---

## 4. Contrôleurs

### 4.1 Authentification (`authentification_controller.js`)

| Fonction      | Description                                           |
|---------------|-------------------------------------------------------|
| `login`       | Authentifie un utilisateur et retourne un token JWT   |
| `verifyToken` | Middleware de vérification du token JWT               |

#### `login(req, res)`
- **Entrée** : `{ email, password }` dans `req.body`
- **Traitement** : Recherche l'utilisateur, compare le hash du mot de passe
- **Sortie** : `{ token }` (200) ou erreur (401)

### 4.2 Utilisateurs (`users_controller.js`)

| Fonction             | Méthode | Description                              |
|----------------------|---------|------------------------------------------|
| `getUsers`           | GET     | Retourne tous les utilisateurs           |
| `getUsersByEmail`    | GET     | Retourne un utilisateur par son email    |
| `createUser`         | POST    | Crée un nouvel utilisateur               |
| `updateUserByEmail`  | PUT     | Met à jour un utilisateur par email      |
| `deleteUserByEmail`  | DELETE  | Supprime un utilisateur par email        |

#### Détail `createUser(req, res)`
- **Entrée** : `{ name, email, password, role }` dans `req.body`
- **Traitement** : Appelle `User.create()` → le hook `pre('save')` hash le mot de passe
- **Sortie** : L'utilisateur créé (201) ou erreur (400/500)

#### Détail `updateUserByEmail(req, res)`
- **Entrée** : Email dans `req.params.email`, champs à modifier dans `req.body`
- **Traitement** : `findOneAndUpdate` avec `runValidators: true`
- **Sortie** : L'utilisateur mis à jour ou erreur 404

### 4.3 Notes de frais (`bills_controller.js`)

| Fonction          | Méthode | Description                                  |
|-------------------|---------|----------------------------------------------|
| `getBills`        | GET     | Retourne les notes (filtrées par rôle)       |
| `getBillById`     | GET     | Retourne une note par ID                     |
| `createBill`      | POST    | Crée une note avec upload de justificatif    |
| `updateBillById`  | PUT     | Met à jour une note par ID                   |
| `deleteBillById`  | DELETE  | Supprime une note par ID                     |

#### Détail `getBills(req, res)` — Logique par rôle

```
Si req.user.role === 'admin'  → Bill.find({})           // Toutes les notes
Si req.user.role === 'visiteur' → Bill.find({ userEmail })  // Ses propres notes
```

#### Détail `createBill(req, res)`

1. Parse les métadonnées depuis `req.body.metadata` (JSON)
2. Récupère `userEmail` depuis `req.user` (token JWT décodé)
3. Upload le fichier justificatif sur AWS S3 via `uploadToS3()`
4. Construit l'objet bill et le sauvegarde dans MongoDB
5. Retourne la note créée (201)

**Format d'envoi (multipart/form-data)** :
- Champ `metadata` : JSON stringifié contenant `{ date, amount, description, status, type }`
- Champ `proof` : Fichier image (justificatif)

---

## 5. Routes

### 5.1 Authentification (`/auth`)

```
POST /auth/login
```

### 5.2 Utilisateurs (`/users`)

```
GET    /users              → getUsers
POST   /users              → createUser
GET    /users/:email       → getUsersByEmail
PUT    /users/:email       → updateUserByEmail
DELETE /users/:email       → deleteUserByEmail
```

> **Note** : Les routes utilisateurs ne sont pas protégées par `verifyToken`.

### 5.3 Notes de frais (`/bills`)

```
GET    /bills              → verifyToken → getBills
POST   /bills              → verifyToken → upload.single('proof') → createBill
GET    /bills/:id          → verifyToken → getBillById
PUT    /bills/:id          → verifyToken → updateBillById
DELETE /bills/:id          → verifyToken → deleteBillById
```

> **Note** : Toutes les routes bills sont protégées par le middleware `verifyToken`. La route POST utilise en plus le middleware Multer pour l'upload du fichier.

---

## 6. Middlewares

### 6.1 Upload (`middlewares/upload.js`)

Middleware basé sur **Multer** pour la gestion de l'upload de fichiers.

| Paramètre       | Valeur                 | Description                              |
|------------------|------------------------|------------------------------------------|
| `storage`        | `memoryStorage()`      | Stockage en mémoire (buffer)             |
| `fileFilter`     | `image/*`              | Accepte uniquement les fichiers image    |
| `limits.fileSize`| ~5 Mo                  | Taille maximale du fichier               |

**Fonctionnement** :
1. Le fichier est stocké temporairement en mémoire (RAM)
2. Seuls les fichiers de type `image/*` sont acceptés
3. Le buffer est ensuite envoyé à S3 via `uploadToS3()`

### 6.2 verifyToken (dans `authentification_controller.js`)

Voir [section 3.4](#34-middleware-verifytoken).

---

## 7. Services (Upload S3)

### `utils/utils.js` — `uploadToS3(file)`

Gère l'upload des justificatifs sur **AWS S3**.

**Processus** :
1. Extrait l'extension du fichier original
2. Génère un nom unique avec `uuid v4` : `{uuid}.{extension}`
3. Configure les paramètres d'upload (bucket, clé, body)
4. Upload le fichier via le SDK AWS
5. Retourne l'URL publique du fichier

**Paramètres AWS** :
| Paramètre      | Source                      |
|----------------|-----------------------------|
| `Bucket`       | `process.env.BUCKET_NAME`   |
| `Key`          | UUID v4 + extension         |
| `Body`         | `file.buffer` (depuis Multer)|

**Retour** : URL du fichier sur S3 (ex: `https://gsb-backend.s3.amazonaws.com/abc-123.jpg`)

---

## 8. Système de mailing

### `mails/mailService.js`

Service d'envoi d'emails utilisant **Nodemailer** avec le service Gmail.

#### Fonctions disponibles

| Fonction                           | Description                                              |
|------------------------------------|----------------------------------------------------------|
| `envoyerRappelUtilisateursInactifs`| Envoie un rappel aux users sans notes le mois précédent  |
| `envoyerMailErreurSaisie`          | Envoie une alerte en cas d'erreur de saisie              |

#### `envoyerRappelUtilisateursInactifs()`

**Algorithme** :
1. Calcule les dates de début et fin du mois précédent
2. Parcourt tous les utilisateurs
3. Pour chaque utilisateur, cherche ses notes du mois précédent
4. Si aucune note → envoie un email de rappel

**Email envoyé** :
```
De : "Gestion Notes de Frais" <email>
Objet : Rappel : Aucune note de frais soumise pour le mois précédent
Corps : Bonjour {nom}, Nous avons remarqué que vous n'avez soumis aucune note de frais le mois dernier...
```

#### `envoyerMailErreurSaisie(email, message)`

Envoie un email d'erreur de saisie à l'utilisateur concerné.
- **Appelé depuis** : le hook `pre('save')` du modèle Bill
- **Anti-spam** : max 1 email par 10 minutes par utilisateur (via `lastEmailMap`)

---

## 9. Tâches planifiées (Cron)

### `mails/cron.js`

Utilise **node-cron** pour planifier l'envoi automatique de rappels.

| Configuration actuelle | Fréquence         | Description                                |
|------------------------|-------------------|--------------------------------------------|
| `*/1 * * * *`         | Toutes les minutes| **Mode test** — vérification des inactifs  |

> **Production** : Modifier l'expression cron en `0 8 1 * *` pour exécuter le rappel le **1er de chaque mois à 8h00**.

**Syntaxe cron** :
```
┌──────────── minute (0-59)
│ ┌────────── heure (0-23)
│ │ ┌──────── jour du mois (1-31)
│ │ │ ┌────── mois (1-12)
│ │ │ │ ┌──── jour de la semaine (0-7)
│ │ │ │ │
* * * * *
```

---

## 10. Variables d'environnement

| Variable        | Description                              | Exemple                                    |
|-----------------|------------------------------------------|--------------------------------------------|
| `PORT`          | Port du serveur Express                  | `3000`                                     |
| `MONGODB_URI`   | URI de connexion MongoDB                 | `mongodb+srv://user:pass@cluster/db`       |
| `JWT_SECRET`    | Clé secrète pour signer les tokens JWT   | `mon_secret_jwt_123`                       |
| `salt`          | Salt pour le hashage SHA-256             | `mon_salt_secret`                          |
| `BUCKET_NAME`   | Nom du bucket AWS S3                     | `gsb-backend`                              |
| `EMAIL_USER`    | Adresse email expéditeur (Gmail)         | `monapp@gmail.com`                         |
| `EMAIL_PASS`    | Mot de passe d'application Gmail         | `xxxx xxxx xxxx xxxx`                      |
| `CORS_ORIGIN`   | Origine autorisée pour CORS              | `http://localhost:5173`                    |

---

## 11. Gestion des erreurs

### Codes HTTP utilisés

| Code | Signification              | Contexte d'utilisation                                |
|------|----------------------------|-------------------------------------------------------|
| 200  | OK                         | Requête traitée avec succès                           |
| 201  | Created                    | Ressource créée (utilisateur, note de frais)          |
| 400  | Bad Request                | Données invalides, email en doublon                   |
| 401  | Unauthorized               | Token absent, invalide ou expiré                      |
| 404  | Not Found                  | Ressource non trouvée (utilisateur, note, route)      |
| 500  | Internal Server Error      | Erreur serveur non gérée                              |

### Middlewares d'erreurs globaux (`index.js`)

1. **404 Handler** : Intercepte les routes inexistantes et retourne `{ message: 'Route not found' }`
2. **Error Handler** : Intercepte les erreurs non gérées et retourne `{ message: 'Something went wrong!' }` avec un log de la stack trace

### Gestion des erreurs dans les hooks Mongoose

Les hooks `pre('save')` et `pre('findOneAndUpdate')` utilisent le pattern `throw new Error(message, { cause: statusCode })` pour propager les codes d'erreur HTTP vers les contrôleurs.

---

## 12. Diagrammes

### 12.1 Diagramme de flux — Création d'une note de frais

```
┌─────────┐     POST /bills      ┌──────────────┐
│  Client  │ ──────────────────> │  verifyToken  │
└─────────┘   (multipart/form)   └──────┬───────┘
                                        │ token valide
                                        ▼
                                 ┌──────────────┐
                                 │    Multer     │
                                 │ (upload.js)   │
                                 └──────┬───────┘
                                        │ fichier en mémoire
                                        ▼
                                 ┌──────────────┐
                                 │  createBill   │
                                 │ (controller)  │
                                 └──────┬───────┘
                                        │
                           ┌────────────┼────────────┐
                           ▼                         ▼
                    ┌─────────────┐          ┌──────────────┐
                    │  Upload S3  │          │  Save Bill   │
                    │ (utils.js)  │          │  (MongoDB)   │
                    └─────────────┘          └──────┬───────┘
                                                    │
                                                    ▼
                                             ┌─────────────┐
                                             │  pre('save') │
                                             │  → Vérif.   │
                                             │  → Email ?  │
                                             └─────────────┘
```

### 12.2 Diagramme de flux — Authentification

```
┌─────────┐  POST /auth/login   ┌─────────────────┐
│  Client  │ ─────────────────> │  login()         │
└─────────┘  {email, password}  └────────┬────────┘
                                         │
                                         ▼
                                 ┌───────────────┐
                                 │ User.findOne() │
                                 │  par email     │
                                 └───────┬───────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                         User trouvé          User non trouvé
                              │                     │
                              ▼                     ▼
                     ┌────────────────┐     ┌──────────┐
                     │ Comparer hash  │     │  401     │
                     │ sha256(pwd+salt)│     │  Error   │
                     └───────┬────────┘     └──────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
              Hash match        Hash différent
                    │                 │
                    ▼                 ▼
            ┌─────────────┐   ┌──────────┐
            │ jwt.sign()  │   │  401     │
            │ → token     │   │  Error   │
            └──────┬──────┘   └──────────┘
                   │
                   ▼
            ┌─────────────┐
            │  200 OK     │
            │  { token }  │
            └─────────────┘
```

### 12.3 Relations entre les modules

```
                         ┌──────────┐
                         │ index.js │
                         └────┬─────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  /auth   │   │  /users  │   │  /bills  │
        │ routes   │   │ routes   │   │ routes   │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │              │              │
             ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  auth    │  │  users   │  │  bills   │
        │ ctrl     │  │ ctrl     │  │ ctrl     │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐  ┌──────────┐
        │  User    │   │  User    │  │  Bill    │
        │  Model   │   │  Model   │  │  Model   │
        └──────────┘   └──────────┘  └────┬─────┘
                                          │
                              ┌───────────┼──────────┐
                              ▼           ▼          ▼
                        ┌──────────┐ ┌────────┐ ┌────────┐
                        │ upload.js│ │utils.js│ │ mail   │
                        │ (Multer) │ │ (S3)   │ │Service │
                        └──────────┘ └────────┘ └───┬────┘
                                                    │
                                                    ▼
                                               ┌────────┐
                                               │cron.js │
                                               └────────┘
```

---

*Documentation générée le 02/03/2026 — GSB Backend v1.0.0*
