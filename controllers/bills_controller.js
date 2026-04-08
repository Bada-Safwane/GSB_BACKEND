const Bill = require('../models/bills_model');
const User = require('../models/user_model');
const { uploadToS3 } = require('../utils/utils');
const Tesseract = require('tesseract.js');

/**
 * SB - Méthode pour récupérer toutes les notes de frais
 * Si l'utilisateur est admin: récupère toutes les notes
 * Si l'utilisateur est visiteur: récupère uniquement ses propres notes
 * @param {Object} req - Requête HTTP contenant les infos utilisateur (email, role)
 * @param {Object} res - Réponse HTTP
 * @returns {Array} Liste des notes de frais au format JSON
 */
const getBills = async (req, res) => {
    try {
        const { email, role } = req.user;
        let bills;

        // SB - Admin/superadmin peut voir toutes les notes, visiteur uniquement les siennes
        if (role === 'admin' || role === 'superadmin') {
            bills = await Bill.find({});

            // Enrichir chaque facture avec le nom de l'utilisateur
            const emails = [...new Set(bills.map(b => b.userEmail))];
            const users = await User.find({ email: { $in: emails } }, 'email firstName lastName');
            const nameMap = Object.fromEntries(users.map(u => [u.email, `${u.firstName} ${u.lastName}`]));
            bills = bills.map(b => {
                const obj = b.toObject();
                obj.userName = nameMap[b.userEmail] || b.userEmail;
                return obj;
            });
        } else {
            bills = await Bill.find({ userEmail: email });
        }

        res.status(200).json(bills);
    } catch (error) {
        console.error('Error fetching bills:', error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * SB - Méthode pour récupérer une note de frais par son ID
 * @param {Object} req - Requête HTTP contenant l'ID de la note dans les paramètres
 * @param {Object} res - Réponse HTTP
 * @returns {Object} Note de frais au format JSON ou erreur 404 si non trouvée
 */
const getBillById = async (req, res) => {
    try {
        // SB - Recherche de la note par ID MongoDB
        const bill = await Bill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }
        res.json(bill);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * SB - Méthode pour mettre à jour une note de frais par son ID
 * Admin ne peut que changer le statut et la raison de refus
 * Superadmin peut tout modifier
 */
const updateBillById = async (req, res) => {
    try {
        const { role } = req.user;

        // Admin ne peut modifier que le statut et la raison de refus
        if (role === 'admin') {
            const allowedFields = ['status', 'rejectionReason'];
            const updateData = {};
            for (const key of allowedFields) {
                if (req.body[key] !== undefined) {
                    updateData[key] = req.body[key];
                }
            }
            const updatedBill = await Bill.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            );
            if (!updatedBill) {
                return res.status(404).json({ message: 'Bill not found' });
            }
            return res.json(updatedBill);
        }

        // Superadmin peut tout modifier
        const updatedBill = await Bill.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedBill) {
            return res.status(404).json({ message: 'Bill not found' });
        }
        res.json(updatedBill);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * SB - Méthode pour supprimer une note de frais par son ID
 * Réservée au superadmin uniquement
 */
const deleteBillById = async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Seul le super administrateur peut supprimer des notes' });
        }
        await Bill.findByIdAndDelete(req.params.id);
        res.json({ message: 'Bill deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * SB - Méthode pour créer une nouvelle note de frais
 * Récupère les données du formulaire, upload le justificatif sur S3
 * et enregistre la note en base de données
 * @param {Object} req - Requête HTTP contenant les métadonnées et le fichier justificatif
 * @param {Object} res - Réponse HTTP
 * @returns {Object} Note de frais créée au format JSON
 */
const createBill = async (req, res) => {
    try {
        // SB - Extraction des métadonnées de la note de frais
        const { date, amount, description, status, type } = JSON.parse(req.body.metadata);
        console.log(date, amount, description, status, type);

        // SB - Récupération de l'email utilisateur depuis le token JWT
        let userEmail;
        if (req.user && typeof req.user === 'object') {
            userEmail = req.user.email;
        }

        if (!userEmail || typeof userEmail !== 'string') {
            return res.status(400).json({ message: "User email is missing or invalid" });
        }

        console.log('Extracted userEmail:', userEmail);

        // SB - Upload du justificatif (image) sur AWS S3
        let proofUrl;
        if (req.file) {
            proofUrl = await uploadToS3(req.file);
        } else {
            throw new Error('Proof image is required', { cause: 400 });
        }

        // SB - Construction de l'objet note de frais avec toutes les données
        const billData = { 
            date,
            amount: Number(amount),
            proof: proofUrl,
            description: String(description),
            status: String(status),
            type: String(type),
            userEmail
        };

        console.log('Bill data:', billData);

        // SB - Sauvegarde de la note dans MongoDB
        const bill = new Bill(billData);
        await bill.save();
        console.log('Bill saved successfully');

        res.status(201).json(bill);

    } catch (error) {
        if (error['cause'] === 400) {
            res.status(400).json({ message: error.message });
        } else {
            console.error('Error creating bill:', error);
            res.status(500).json({ message: "Server error" });
        }
    }
};

/**
 * SB - Méthode pour mettre à jour le statut de plusieurs notes en masse
 * Réservée aux administrateurs
 * @param {Object} req - Requête HTTP contenant ids (array) et status (string)
 * @param {Object} res - Réponse HTTP
 */
const bulkUpdateStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'IDs array is required' });
        }

        if (!status || typeof status !== 'string') {
            return res.status(400).json({ message: 'Status is required' });
        }

        const allowedStatuses = ['Soumise', 'Validée', 'Refusée', 'Remboursée'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        await Bill.updateMany(
            { _id: { $in: ids } },
            { $set: { status } }
        );

        const updatedBills = await Bill.find({ _id: { $in: ids } });
        res.json(updatedBills);
    } catch (error) {
        console.error('Error bulk updating bills:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * SB - Endpoint OCR pour extraire des données d'un justificatif
 * Utilise Tesseract.js pour la reconnaissance de texte
 */
const ocrExtract = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Image requise' });
        }

        console.log('OCR: début de l\'analyse, taille:', req.file.size, 'octets');

        const { data: { text } } = await Tesseract.recognize(
            req.file.buffer,
            'fra+eng',
            {}
        );

        console.log('OCR: texte extrait:', text.substring(0, 200));

        // Extraire le montant — patterns du plus spécifique au plus générique
        const amountPatterns = [
            // Libellés français courants suivis d'un montant
            /total\s*(?:ttc|ht|tva)?[:\s€]*(\d+[.,]\d{2})/i,
            /montant\s*(?:ttc|ht|tva)?[:\s€]*(\d+[.,]\d{2})/i,
            /net\s*[àa]\s*payer[:\s€]*(\d+[.,]\d{2})/i,
            /somme\s*(?:due)?[:\s€]*(\d+[.,]\d{2})/i,
            /à\s*payer[:\s€]*(\d+[.,]\d{2})/i,
            // Libellés anglais
            /amount[:\s$]*(\d+[.,]\d{2})/i,
            /total[:\s$]*(\d+[.,]\d{2})/i,
            // Montants avec symbole monétaire
            /(\d+[.,]\d{2})\s*€/,
            /€\s*(\d+[.,]\d{2})/,
            /(\d+[.,]\d{2})\s*eur(?:os?)?/i,
            /(\d+[.,]\d{2})\s*\$/,
            /\$\s*(\d+[.,]\d{2})/,
            // Fallback: n'importe quel nombre décimal (prend le plus grand)
        ];

        let amount = null;
        for (const pattern of amountPatterns) {
            const match = text.match(pattern);
            if (match) {
                amount = parseFloat(match[1].replace(',', '.'));
                break;
            }
        }

        // Fallback: si aucun pattern nommé, chercher le plus grand nombre décimal
        if (!amount) {
            const allAmounts = [...text.matchAll(/(\d+)[.,](\d{2})\b/g)];
            if (allAmounts.length > 0) {
                const values = allAmounts.map(m => parseFloat(`${m[1]}.${m[2]}`));
                amount = Math.max(...values);
            }
        }

        // Extraire la date (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd)
        const datePatterns = [
            { re: /(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/, format: 'dmy' },
            { re: /(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})/, format: 'ymd' },
            { re: /(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})/, format: 'dmy2' },
        ];

        let date = null;
        for (const { re, format } of datePatterns) {
            const match = text.match(re);
            if (match) {
                if (format === 'ymd') {
                    date = `${match[3]}/${match[2]}/${match[1]}`;
                } else {
                    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
                    date = `${match[1]}/${match[2]}/${year}`;
                }
                break;
            }
        }

        console.log('OCR: montant extrait:', amount, 'date extraite:', date);

        res.json({
            rawText: text.substring(0, 500),
            extractedAmount: amount,
            extractedDate: date,
        });
    } catch (error) {
        console.error('OCR error:', error);
        res.status(500).json({ message: 'Erreur lors de l\'analyse OCR: ' + error.message });
    }
};

module.exports = {
    getBills,
    getBillById,
    updateBillById,
    deleteBillById,
    createBill,
    bulkUpdateStatus,
    ocrExtract
};
