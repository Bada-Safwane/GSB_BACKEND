const cron = require('node-cron');
const { envoyerRappelUtilisateursInactifs } = require('../mails/mailService'); // fonction personnalisée

/**
 * SB - Tâche planifiée (cron job) pour vérifier les utilisateurs inactifs
 * S'exécute toutes les minutes pour tester (à ajuster en production)
 * En production: '0 8 1 * *' pour s'exécuter le 1er de chaque mois à 8h00
 */
// Planifie l'exécution le 1er de chaque mois à 8h00
cron.schedule('0 8 1 * *', async () => {
  console.log("⏰ Script cron : vérification des utilisateurs inactifs...");
  try {
    // SB - Appel de la fonction pour envoyer les rappels
    await envoyerRappelUtilisateursInactifs();
    console.log("📬 Rappels envoyés avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi des rappels :", error.message);
  }
});

