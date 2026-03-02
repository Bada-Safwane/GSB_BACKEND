# GSB Backend - API de Gestion des Notes de Frais

## Description

API REST backend pour la gestion des notes de frais du laboratoire pharmaceutique **Galaxy Swiss Bourdin (GSB)**. Cette application permet aux visiteurs médicaux de soumettre leurs notes de frais et aux administrateurs de les gérer.

Développée avec **Node.js**, **Express** et **MongoDB**, elle intègre l'upload de justificatifs sur **AWS S3**, l'authentification par **JWT** et un système de **notifications par email** automatisé.

---

## Fonctionnalités

- **Authentification** : Connexion sécurisée par email/mot de passe avec token JWT
- **Gestion des utilisateurs** : CRUD complet (création, lecture, mise à jour, suppression)
- **Gestion des notes de frais** : CRUD complet avec filtrage par rôle (admin/visiteur)
- **Upload de justificatifs** : Upload d'images sur AWS S3 via Multer
- **Notifications email** :
  - Rappel automatique aux utilisateurs inactifs (cron job)
  - Alerte en cas d'erreur de saisie sur une note de frais
- **Sécurité** : Hashage SHA-256 des mots de passe, protection des routes par JWT

---

## Prérequis

- **Node.js** >= 14.0.0
- **npm** (inclus avec Node.js)
- **MongoDB** (instance MongoDB Atlas ou locale)
- **Compte AWS** avec un bucket S3 configuré
- **Compte Gmail** pour l'envoi d'emails (ou autre service SMTP)

---

## Installation

1. **Cloner le dépôt**
   ```bash
   git clone <url-du-depot>
   cd GSB_BACKEND
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**

   Créer un fichier `.env` à la racine du projet :
   ```env
   PORT=3000
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<database>
   JWT_SECRET=votre_secret_jwt
   salt=votre_salt_pour_hashage

   # AWS S3
   BUCKET_NAME=nom-de-votre-bucket

   # Email
   EMAIL_USER=votre-email@gmail.com
   EMAIL_PASS=votre-mot-de-passe-application

   # CORS
   CORS_ORIGIN=http://localhost:5173
   ```

4. **Lancer le serveur**
   ```bash
   # Mode développement (avec rechargement automatique)
   npm run dev

   # Mode production
   npm start
   ```

   Le serveur démarre par défaut sur le port **3000**.

---

## Endpoints de l'API

### Authentification (`/auth`)

| Méthode | Route          | Description                  | Auth requise |
|---------|----------------|------------------------------|:------------:|
| POST    | `/auth/login`  | Connexion utilisateur        | Non          |

### Utilisateurs (`/users`)

| Méthode | Route            | Description                        | Auth requise |
|---------|------------------|------------------------------------|:------------:|
| GET     | `/users`         | Récupérer tous les utilisateurs    | Non          |
| POST    | `/users`         | Créer un utilisateur               | Non          |
| GET     | `/users/:email`  | Récupérer un utilisateur par email | Non          |
| PUT     | `/users/:email`  | Mettre à jour un utilisateur       | Non          |
| DELETE  | `/users/:email`  | Supprimer un utilisateur           | Non          |

### Notes de frais (`/bills`)

| Méthode | Route         | Description                        | Auth requise |
|---------|---------------|------------------------------------|:------------:|
| GET     | `/bills`      | Récupérer les notes de frais       | Oui (JWT)    |
| POST    | `/bills`      | Créer une note de frais            | Oui (JWT)    |
| GET     | `/bills/:id`  | Récupérer une note par ID          | Oui (JWT)    |
| PUT     | `/bills/:id`  | Mettre à jour une note             | Oui (JWT)    |
| DELETE  | `/bills/:id`  | Supprimer une note                 | Oui (JWT)    |

---

## Scripts disponibles

| Commande       | Description                                      |
|----------------|--------------------------------------------------|
| `npm run dev`  | Lance le serveur avec Nodemon (hot reload)       |
| `npm start`    | Lance le serveur en mode production              |

---

## Stack technique

| Technologie    | Utilisation                          |
|----------------|--------------------------------------|
| Node.js        | Runtime JavaScript                   |
| Express        | Framework web                        |
| MongoDB        | Base de données NoSQL                |
| Mongoose       | ODM pour MongoDB                     |
| JWT            | Authentification par token           |
| SHA-256        | Hashage des mots de passe            |
| AWS S3         | Stockage des justificatifs           |
| Multer         | Upload de fichiers                   |
| Nodemailer     | Envoi d'emails                       |
| node-cron      | Tâches planifiées                    |
| dotenv         | Gestion des variables d'environnement|

---

## Auteur

**SB** - Développeur Backend

---

## Licence

ISC
