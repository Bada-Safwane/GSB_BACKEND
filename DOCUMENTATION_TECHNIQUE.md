# Documentation Technique - GSB Backend

## Table des matières

1. [Architecture du projet](#1-architecture-du-projet)
2. [Modèles de données](#2-modèles-de-données)
3. [Authentification et sécurité](#3-authentification-et-sécurité)
4. [Contrôleurs](#4-contrôleurs)
5. [Routes](#5-routes)
6. [Middlewares](#6-middlewares)
7. [Services (Upload S3)](#7-services-upload-s3)
8. [Variables d'environnement](#8-variables-denvironnement)
9. [Gestion des erreurs](#9-gestion-des-erreurs)
10. [Diagrammes](#10-diagrammes)

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

Représente un utilisateur de l'application (visiteur médical, administrateur ou super administrateur).

#### Schéma

| Champ              | Type     | Requis | Unique | Défaut       | Description                                          |
|--------------------|----------|:------:|:------:|--------------|------------------------------------------------------|
| `firstName`        | String   | ✅     | ❌     | —            | Prénom de l'utilisateur                              |
| `lastName`         | String   | ✅     | ❌     | —            | Nom de famille de l'utilisateur                      |
| `service`          | String   | ✅     | ❌     | —            | Service de l'utilisateur (ex : Comptabilité, RH…)    |
| `email`            | String   | ✅     | ✅     | —            | Adresse email (identifiant unique)                   |
| `password`         | String   | ✅     | ❌     | —            | Mot de passe hashé (SHA-256)                         |
| `role`             | String   | ✅     | ❌     | —            | Rôle : `superadmin`, `admin` ou `visiteur`           |
| `createdAt`        | String   | ❌     | ❌     | `Date.now`   | Date de création du compte                           |

#### Rôles utilisateurs

| Rôle          | Description                                                                 |
|---------------|-----------------------------------------------------------------------------|
| `visiteur`    | Visiteur médical — peut créer, modifier et supprimer ses propres notes      |
| `admin`       | Administrateur (comptable) — peut consulter toutes les notes et changer les statuts |
| `superadmin`  | Super administrateur — peut tout modifier/supprimer, gérer les utilisateurs |

#### Services disponibles

Comptabilité, Commercial, Direction, Informatique, Juridique, Marketing, Ressources Humaines, Logistique.

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
  "firstName": "Jean",
  "lastName": "Dupont",
  "service": "Commercial",
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

| Champ             | Type     | Requis | Défaut         | Description                                         |
|-------------------|----------|:------:|----------------|-----------------------------------------------------|
| `date`            | String   | ✅     | —              | Date de la dépense                                  |
| `amount`          | Number   | ✅     | —              | Montant de la dépense (en €)                        |
| `proof`           | String   | ✅     | —              | URL du justificatif stocké sur AWS S3               |
| `description`     | String   | ✅     | —              | Description de la dépense                           |
| `userEmail`       | String   | ✅     | —              | Email de l'utilisateur ayant soumis                 |
| `status`          | String   | ✅     | —              | Statut : `Soumise`, `Validée`, `Refusée`, `Remboursée` |
| `type`            | String   | ✅     | —              | Type de frais (voir liste ci-dessous)               |
| `createdAt`       | String   | ❌     | `Date.now()`   | Date de création de la note                         |
| `rejectionReason` | String   | ❌     | `null`         | Motif du refus (renseigné par l'admin)              |

#### Workflow des statuts

```
Soumise  →  Validée  →  Remboursée
               ↓
            Refusée  →  Soumise (remise en circulation)
```

| Statut        | Description                                          | Couleur |
|---------------|------------------------------------------------------|---------|
| `Soumise`     | Note déposée par l'employé, en attente de traitement | Bleu    |
| `Validée`     | Approuvée par un administrateur                      | Vert    |
| `Refusée`     | Rejetée par un administrateur (avec motif)           | Rouge   |
| `Remboursée`  | Paiement effectué — état terminal                    | Émeraude |

#### Types de frais

Transport, Hébergement, Restauration, Fournitures, Téléphone, Déplacement, Formation, Représentation, ou texte libre via l'option "Autre" (max 30 caractères).

#### Exemple de document

```json
{
  "_id": "64b2c3d4e5f6a7b8c9d0e1f2",
  "date": "2026-02-15",
  "amount": 45.50,
  "proof": "https://gsb-backend.s3.amazonaws.com/abc123.jpg",
  "description": "Repas client - Restaurant Le Gourmet",
  "userEmail": "jean.dupont@gsb.fr",
  "status": "Soumise",
  "type": "Restauration",
  "createdAt": "1700000000000",
  "rejectionReason": null
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
  "firstName": "Jean",
  "lastName": "Dupont",
  "service": "Commercial",
  "iat": 1700000000,
  "exp": 1700086400
}
```

- **Durée de validité** : 24 heures
- **Algorithme** : HS256 (par défaut)
- **Secret** : défini via `process.env.JWT_SECRET`

### 3.3 Réinitialisation de mot de passe

Deux mécanismes de réinitialisation sont disponibles :

#### Via la page de profil (utilisateur connecté)

- `POST /auth/change-password` avec `{ currentPassword, newPassword }` (route protégée par `verifyToken`)
- L'utilisateur doit fournir son mot de passe actuel pour confirmation
- Le nouveau mot de passe doit contenir au moins 6 caractères

#### Via le super administrateur

- `POST /auth/admin-reset-password` avec `{ email, newPassword }` (route protégée par `verifyToken`)
- Réservé au rôle `superadmin`
- Définit directement un nouveau mot de passe pour l'utilisateur ciblé

### 3.4 Hashage des mots de passe

- **Algorithme** : SHA-256
- **Salage** : Le mot de passe est concaténé avec `process.env.salt` avant le hash
- **Formule** : `sha256(password + salt)`
- Le hashage est effectué automatiquement dans le hook `pre('save')` du modèle User

### 3.5 Middleware `verifyToken`

Fonction middleware qui protège les routes nécessitant une authentification :

1. Extrait le token du header `Authorization: Bearer <token>`
2. Vérifie la validité du token avec `jwt.verify()`
3. Ajoute les données décodées dans `req.user`
4. Retourne `401` si le token est absent, invalide ou expiré

---

## 4. Contrôleurs

### 4.1 Authentification (`authentification_controller.js`)

| Fonction             | Description                                                    |
|----------------------|----------------------------------------------------------------|
| `login`              | Authentifie un utilisateur et retourne un token JWT            |
| `verifyToken`        | Middleware de vérification du token JWT                        |
| `adminResetPassword` | Réinitialise directement le mot de passe d'un utilisateur (superadmin) |
| `changePassword`     | Permet à l'utilisateur connecté de changer son mot de passe   |

#### `login(req, res)`
- **Entrée** : `{ email, password }` dans `req.body`
- **Traitement** : Recherche l'utilisateur, compare le hash du mot de passe
- **Sortie** : `{ token }` (200) ou erreur (401)

### 4.2 Utilisateurs (`users_controller.js`)

| Fonction             | Méthode | Description                                     |
|----------------------|---------|-------------------------------------------------|
| `getUsers`           | GET     | Retourne tous les utilisateurs (protégé)        |
| `getUsersByEmail`    | GET     | Retourne un utilisateur par son email           |
| `createUser`         | POST    | Crée un nouvel utilisateur                      |
| `updateUserByEmail`  | PUT     | Met à jour un utilisateur par email (protégé)   |
| `deleteUserByEmail`  | DELETE  | Supprime un utilisateur par email (protégé)     |

#### Détail `createUser(req, res)`
- **Entrée** : `{ firstName, lastName, service, email, password, role }` dans `req.body`
- **Traitement** : Appelle `User.create()` → le hook `pre('save')` hash le mot de passe
- **Sortie** : L'utilisateur créé (201) ou erreur (400/500)

#### Détail `updateUserByEmail(req, res)`
- **Entrée** : Email dans `req.params.email`, champs à modifier dans `req.body`
- **Traitement** : Si un mot de passe est fourni, il est hashé avant la mise à jour. `findOneAndUpdate` avec `runValidators: true`
- **Sortie** : L'utilisateur mis à jour ou erreur 404

#### Détail `deleteUserByEmail(req, res)`
- **Restriction** : Réservé au rôle `superadmin`
- Retourne `403` si l'utilisateur connecté n'est pas super administrateur

### 4.3 Notes de frais (`bills_controller.js`)

| Fonction           | Méthode | Description                                          |
|--------------------|---------|------------------------------------------------------|
| `getBills`         | GET     | Retourne les notes (filtrées par rôle)               |
| `getBillById`      | GET     | Retourne une note par ID                             |
| `createBill`       | POST    | Crée une note avec upload de justificatif            |
| `updateBillById`   | PUT     | Met à jour une note par ID (restrictions par rôle)   |
| `deleteBillById`   | DELETE  | Supprime une note par ID (restrictions par rôle)     |
| `bulkUpdateStatus` | PUT     | Change le statut de plusieurs notes en masse         |

#### Détail `getBills(req, res)` — Logique par rôle

```
Si req.user.role === 'admin' ou 'superadmin'  → Bill.find({})  + enrichi avec userName
Si req.user.role === 'visiteur'               → Bill.find({ userEmail })
```

Quand un admin/superadmin récupère les factures, le contrôleur construit un `nameMap` en récupérant les noms (`firstName`, `lastName`) de chaque utilisateur depuis la collection User, et ajoute un champ `userName` à chaque note.

#### Détail `updateBillById(req, res)` — Restrictions par rôle

| Rôle         | Permissions                                                  |
|--------------|--------------------------------------------------------------|
| `visiteur`   | Peut modifier ses propres notes au statut `Soumise` uniquement |
| `admin`      | Peut uniquement changer le `status` et la `rejectionReason`  |
| `superadmin` | Peut modifier tous les champs de toutes les notes            |

#### Détail `deleteBillById(req, res)` — Restrictions par rôle

| Rôle         | Permissions                                                  |
|--------------|--------------------------------------------------------------|
| `visiteur`   | Peut supprimer ses propres notes au statut `Soumise` uniquement |
| `admin`      | Pas de droit de suppression                                  |
| `superadmin` | Peut supprimer toutes les notes                              |

#### Détail `bulkUpdateStatus(req, res)`
- **Entrée** : `{ ids: [...], status, rejectionReason? }` dans `req.body`
- **Restriction** : Réservé aux rôles `admin` et `superadmin`
- **Statuts autorisés** : `Soumise`, `Validée`, `Refusée`, `Remboursée`
- **Traitement** : Met à jour le statut (et éventuellement le motif de refus) de toutes les notes correspondant aux IDs fournis

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
POST /auth/login                → login
POST /auth/admin-reset-password → verifyToken → adminResetPassword
POST /auth/change-password      → verifyToken → changePassword
```

### 5.2 Utilisateurs (`/users`)

```
GET    /users              → verifyToken → getUsers
POST   /users              → createUser
GET    /users/:email       → getUsersByEmail
PUT    /users/:email       → verifyToken → updateUserByEmail
DELETE /users/:email       → verifyToken → deleteUserByEmail
```

> **Note** : Les routes GET (liste), PUT et DELETE sont protégées par `verifyToken`. La route POST (création de compte) et GET par email sont publiques.

### 5.3 Notes de frais (`/bills`)

```
GET    /bills              → verifyToken → getBills
POST   /bills              → verifyToken → upload.single('proof') → createBill
PUT    /bills/bulk-status   → verifyToken → bulkUpdateStatus
GET    /bills/:id          → verifyToken → getBillById
PUT    /bills/:id          → verifyToken → updateBillById
DELETE /bills/:id          → verifyToken → deleteBillById
```

> **Note** : Toutes les routes bills sont protégées par le middleware `verifyToken`. La route `PUT /bills/bulk-status` doit être déclarée avant `PUT /bills/:id` pour éviter les conflits de matching.

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

Voir [section 3.5](#35-middleware-verifytoken).

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

## 8. Variables d'environnement

| Variable        | Description                              | Exemple                                    |
|-----------------|------------------------------------------|--------------------------------------------|
| `PORT`          | Port du serveur Express                  | `3000`                                     |
| `MONGODB_URI`   | URI de connexion MongoDB                 | `mongodb+srv://user:pass@cluster/db`       |
| `JWT_SECRET`    | Clé secrète pour signer les tokens JWT   | `mon_secret_jwt_123`                       |
| `salt`          | Salt pour le hashage SHA-256             | `mon_salt_secret`                          |
| `BUCKET_NAME`   | Nom du bucket AWS S3                     | `gsb-backend`                              |\n| `CORS_ORIGIN`   | Origine autorisée pour CORS              | `http://localhost:5173`                    |", "oldString": "| `CORS_ORIGIN`   | Origine autoris\u00e9e pour CORS              | `http://localhost:5173`                    |

---

## 9. Gestion des erreurs

### Codes HTTP utilisés

| Code | Signification              | Contexte d'utilisation                                |
|------|----------------------------|-------------------------------------------------------|
| 200  | OK                         | Requête traitée avec succès                           |
| 201  | Created                    | Ressource créée (utilisateur, note de frais)          |
| 400  | Bad Request                | Données invalides, email en doublon                   |
| 401  | Unauthorized               | Token absent, invalide ou expiré                      |
| 403  | Forbidden                  | Rôle insuffisant (ex : admin tente une action superadmin) |
| 404  | Not Found                  | Ressource non trouvée (utilisateur, note, route)      |
| 500  | Internal Server Error      | Erreur serveur non gérée                              |

### Middlewares d'erreurs globaux (`index.js`)

1. **404 Handler** : Intercepte les routes inexistantes et retourne `{ message: 'Route not found' }`
2. **Error Handler** : Intercepte les erreurs non gérées et retourne `{ message: 'Something went wrong!' }` avec un log de la stack trace

### Gestion des erreurs dans les hooks Mongoose

Les hooks `pre('save')` et `pre('findOneAndUpdate')` utilisent le pattern `throw new Error(message, { cause: statusCode })` pour propager les codes d'erreur HTTP vers les contrôleurs.

---

## 10. Diagrammes

### 11.1 Diagramme de flux — Création d'une note de frais

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
                    └─────────────┘          └──────────────┘
```

### 11.2 Diagramme de flux — Authentification

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

### 10.3 Diagramme de flux — Réinitialisation de mot de passe

#### Via le profil utilisateur

```
┌─────────┐  POST /auth/change-password   ┌──────────────────┐
│  Client  │ ───────────────────────────> │  verifyToken()    │
└─────────┘  { currentPassword,           └────────┬─────────┘
               newPassword }                       │
                                                   ▼
                                          ┌───────────────────┐
                                          │  changePassword()  │
                                          └────────┬──────────┘
                                                   │
                                          ┌────────┴────────┐
                                          │ Vérifier mot de  │
                                          │ passe actuel     │
                                          └────────┬────────┘
                                                   │
                                    ┌──────────────┴──────────────┐
                                    ▼                             ▼
                            Hash correspond            Hash différent
                                    │                             │
                                    ▼                             ▼
                           ┌────────────────┐            ┌──────────┐
                           │ Sauver nouveau │            │   401    │
                           │ hash en DB     │            │  Error   │
                           └────────────────┘            └──────────┘
```

#### Via le super administrateur

```
┌─────────┐  POST /auth/admin-reset-password  ┌──────────────────┐
│  Client  │ ────────────────────────────────> │  verifyToken()    │
└─────────┘  { email, newPassword }            └────────┬─────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────────┐
                                              │ adminResetPassword() │
                                              └────────┬────────────┘
                                                       │
                                              ┌────────┴────────┐
                                              │ Vérifier rôle   │
                                              │ = superadmin    │
                                              └────────┬────────┘
                                                       │
                                              ┌────────────────┐
                                              │ Hash + sauver  │
                                              │ nouveau mdp    │
                                              └────────────────┘
```

### 11.4 Diagramme de flux — Changement de statut en masse

```
┌─────────┐  PUT /bills/bulk-status  ┌──────────────┐
│  Client  │ ─────────────────────> │  verifyToken  │
└─────────┘  { ids, status,         └──────┬───────┘
               rejectionReason? }          │
                                           ▼
                                   ┌────────────────┐
                                   │ Vérifier rôle  │
                                   │ admin/superadmin│
                                   └───────┬────────┘
                                           │
                                           ▼
                                   ┌────────────────┐
                                   │ Bill.updateMany │
                                   │ ({ _id: ids })  │
                                   └───────┬────────┘
                                           │
                                           ▼
                                    ┌─────────────┐
                                    │  200 OK     │
                                    │  { count }  │
                                    └─────────────┘
```

### 11.5 Relations entre les modules

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
                        └──────────┘ └────────┘ └────────┘
```

---

*Documentation mise à jour le 13/04/2026 — GSB Backend v2.0.0*
