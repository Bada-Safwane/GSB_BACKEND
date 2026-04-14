const jwt = require('jsonwebtoken');
const User = require('../models/user_model');
const sha256 = require('js-sha256');

/**
 * SB - Méthode pour authentifier un utilisateur
 * Vérifie les identifiants (email/mot de passe) et génère un token JWT
 * @param {Object} req - Requête HTTP contenant email et password dans le body
 * @param {Object} res - Réponse HTTP
 * @returns {Object} Token JWT si authentification réussie, erreur 401 sinon
 */
const login = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // SB - Vérification de l'existence de l'utilisateur
    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    // SB - Vérification du mot de passe hashé avec salt
    if (user.password !== sha256(password + process.env.salt)) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    // SB - Génération du token JWT avec les informations utilisateur
    const token = jwt.sign(
        { id: user._id, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName, service: user.service },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.status(200).json({ token });
};

/**
 * SB - Middleware de vérification du token JWT
 * Extrait et valide le token JWT depuis l'en-tête Authorization
 * @param {Object} req - Requête HTTP avec en-tête Authorization
 * @param {Object} res - Réponse HTTP
 * @param {Function} next - Fonction middleware suivante
 * @returns {void} Passe à la fonction suivante si token valide, erreur 401 sinon
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expecting 'Bearer <token>'

    // SB - Vérification de la présence du token
    if (!token) {
        return res.status(401).json({ message: 'Access denied, no token provided' });
    }

    try {
        // SB - Décodage et vérification du token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

/**
 * SB - Réinitialisation directe du mot de passe par un superadmin
 * Permet au superadmin de définir un nouveau mot de passe pour un utilisateur
 */
const adminResetPassword = async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ message: 'Email et nouveau mot de passe requis' });
    }

    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    user.password = sha256(newPassword + process.env.salt);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
};

/**
 * SB - Changement de mot de passe par l'utilisateur connecté depuis son profil
 */
const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Mot de passe actuel et nouveau mot de passe requis' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    if (user.password !== sha256(currentPassword + process.env.salt)) {
        return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }

    user.password = sha256(newPassword + process.env.salt);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ message: 'Mot de passe modifié avec succès' });
};

module.exports = { login, verifyToken, adminResetPassword, changePassword };
