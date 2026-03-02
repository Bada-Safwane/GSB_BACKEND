require('dotenv').config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const userRoute = require('./routes/user_routes');
const billsRoute = require('./routes/bills_routes');
const authentificationRoute = require('./routes/authentification_routes');
const mongoose = require('mongoose');
const cors = require('cors');
require('./mails/cron'); // SB - Chargement du cron pour les rappels automatiques

// SB - Configuration de CORS pour autoriser les requêtes cross-origin
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// SB - Connexion à MongoDB avec gestion d'erreur améliorée
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// SB - Middleware pour parser le JSON dans les requêtes
app.use(express.json());

// SB - Déclaration des routes principales de l'API
app.use('/auth', authentificationRoute);
app.use('/users', userRoute);
app.use('/bills', billsRoute);

// SB - Gestion des erreurs 404 pour les routes inexistantes
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});

// SB - Gestion globale des erreurs serveur
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// SB - Démarrage du serveur Express
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
