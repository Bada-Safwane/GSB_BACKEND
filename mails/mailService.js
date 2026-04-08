const User = require('../models/user_model');
const Bill = require('../models/bills_model');
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
 * SB - Méthode pour envoyer un rappel aux utilisateurs inactifs
 * Vérifie les utilisateurs qui n'ont pas soumis de notes le mois précédent
 * et leur envoie un email de rappel
 * @returns {void}
 */
async function envoyerRappelUtilisateursInactifs() {
  const now = new Date();
  // SB - Calcul du début et fin du mois précédent
  const debutMoisPrecedent = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finMoisPrecedent = new Date(now.getFullYear(), now.getMonth(), 0);

  // SB - Récupération de tous les utilisateurs
  const users = await User.find();

  for (const user of users) {
    // SB - Vérification si l'utilisateur a soumis des notes le mois dernier
    const notes = await Bill.find({
      userEmail: user.email,
      date: { $gte: debutMoisPrecedent, $lte: finMoisPrecedent },
    });

    // SB - Envoi d'un email si aucune note n'a été trouvée
    if (notes.length === 0) {
      await transporter.sendMail({
        from: `"Gestion Notes de Frais" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `Rappel : Aucune note de frais soumise pour le mois précédent`,
        text: `Bonjour ${user.firstName},\n\nNous avons remarqué que vous n'avez soumis aucune note de frais le mois dernier. Pensez à les enregistrer dès que possible.\n\nMerci.`,
      });

      console.log(`📬 Email de rappel envoyé à ${user.email}`);
    }
  }
}

/**
 * SB - Méthode pour envoyer un email d'erreur de saisie
 * Notifie l'utilisateur qu'il y a un problème avec sa note de frais
 * @param {String} email - Email du destinataire
 * @param {String} message - Message d'erreur à envoyer
 * @returns {Promise} Promesse d'envoi d'email
 */
const envoyerMailErreurSaisie = async (email, message) => {
  return transporter.sendMail({
    from: `"App Notes Frais" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Erreur lors de la saisie de votre note de frais",
    text: message,
  });
};


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


module.exports = { envoyerRappelUtilisateursInactifs, envoyerMailErreurSaisie, envoyerMailResetPassword };
