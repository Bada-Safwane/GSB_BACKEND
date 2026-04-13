const nodemailer = require('nodemailer');

// SB - Configuration du transporteur d'emails avec Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


/**
 * SB - Méthode pour envoyer un email de réinitialisation de mot de passe
 * @param {String} email - Email du destinataire
 * @param {String} firstName - Prénom de l'utilisateur
 * @param {String} resetUrl - URL de réinitialisation
 */
const envoyerMailResetPassword = async (email, firstName, resetUrl) => {
  return transporter.sendMail({
    from: `"Gestion Notes de Frais" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Réinitialisation de votre mot de passe",
    text: `Bonjour ${firstName},\n\nVous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur le lien suivant pour définir un nouveau mot de passe :\n${resetUrl}\n\nCe lien est valable 1 heure.\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\nCordialement,\nL'équipe GSB`,
  });
};


module.exports = { envoyerMailResetPassword };
