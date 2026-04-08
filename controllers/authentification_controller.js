const jwt = require('jsonwebtoken');
const User = require('../models/user_model');
const sha256 = require('js-sha256');
const crypto = require('crypto');
const { envoyerMailResetPassword } = require('../mails/mailService');

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
 * SB - Demande de réinitialisation de mot de passe
 * Génère un token unique et envoie un email avec le lien de réinitialisation
 */
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        // Ne pas révéler si l'email existe ou non
        return res.status(200).json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
    }

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 heure

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save({ validateBeforeSave: false });

    try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
        await envoyerMailResetPassword(email, user.firstName, resetUrl);
        res.status(200).json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' });
    } catch (err) {
        user.resetToken = null;
        user.resetTokenExpiry = null;
        await user.save({ validateBeforeSave: false });
        console.error('Error sending reset email:', err);
        res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email' });
    }
};

/**
 * SB - Réinitialisation du mot de passe avec token
 */
const resetPassword = async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
        return res.status(400).json({ message: 'Email, token et nouveau mot de passe requis' });
    }

    const user = await User.findOne({
        email,
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
        return res.status(400).json({ message: 'Token invalide ou expiré' });
    }

    user.password = sha256(newPassword + process.env.salt);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
};

/**
 * SB - Envoi d'un email de réinitialisation par un admin/superadmin pour un utilisateur
 */
const adminResetPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000);

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save({ validateBeforeSave: false });

    try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
        await envoyerMailResetPassword(email, user.firstName, resetUrl);
        res.status(200).json({ message: 'Email de réinitialisation envoyé' });
    } catch (err) {
        console.error('Error sending reset email:', err);
        res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email' });
    }
};



module.exports = { login, verifyToken, forgotPassword, resetPassword, adminResetPassword };
