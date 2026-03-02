const mongoose = require('mongoose');
 const { envoyerMailErreurSaisie } = require('../mails/mailService'); // fonction personnalisée

const billsSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    proof: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    userEmail: {  // utilisé à la place de user ObjectId
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    createdAt: {
        type: String,
        default: Date.now(),
    },
});


billsSchema.pre("save", async function (next) {
  const bill = this;

  // Vérification d'erreurs de saisie (exemples à adapter à ton app)
  const hasError =
    !bill.description || bill.amount <= 0 || !bill.proof || bill.status !== "En attente";

  if (hasError) {
    const now = new Date();
    const lastSent = lastEmailMap.get(bill.userEmail);

    // Si aucun email ou dernier email envoyé il y a plus de 10 minutes
    if (!lastSent || now - lastSent > 10 * 60 * 1000) {
      try {
        await envoyerMailErreurSaisie(
          bill.userEmail,
          `Bonjour,\n\nVotre note de frais semble invalide ou incomplète.\n\nMerci de la vérifier :\n- Montant : ${bill.amount}\n- Description : ${bill.description}\n- Statut : ${bill.status}`
        );

        console.log(`📬 Email d'erreur envoyé à ${bill.userEmail}`);
        lastEmailMap.set(bill.userEmail, now);
      } catch (err) {
        console.error("❌ Erreur lors de l’envoi du mail :", err.message);
      }
    } else {
      console.log(`⏱️ Email déjà envoyé récemment à ${bill.userEmail}, pas de renvoi.`);
    }
  }

  next();
});



const Bill = mongoose.model('Bills', billsSchema);

module.exports = Bill;
