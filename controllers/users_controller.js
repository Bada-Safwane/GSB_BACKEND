const User = require('../models/user_model');

/**
 * SB - Méthode pour récupérer tous les utilisateurs
 * @param {Object} req - Requête HTTP
 * @param {Object} res - Réponse HTTP
 * @returns {Array} Liste de tous les utilisateurs au format JSON
 */
const getUsers = async (req, res) => {
  try{
    // SB - Récupération de tous les utilisateurs depuis MongoDB
    const users = await User.find({});
    res.json(users);
  }
  catch(error){
    res.status(500).json({ message: "creation error" });
  }
};

/**
 * SB - Méthode pour récupérer un utilisateur par son email
 * @param {Object} req - Requête HTTP contenant l'email dans les paramètres
 * @param {Object} res - Réponse HTTP
 * @returns {Object} Utilisateur trouvé au format JSON ou erreur 404
 */
const getUsersByEmail = async (req, res) => {
  try{
    // SB - Recherche d'un utilisateur unique par email
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
    } else {
      res.json(user);
    }
  }
  catch(error){
    if (error['cause'] === 404) {
      res.status(404).json({ message: 'User not found' });
    }
    else{
      res.status(500).json({ message: 'getUserByEmail error' });
    }
  }
};

/**
 * SB - Méthode pour créer un nouvel utilisateur
 * Le hook pre-save du modèle gère le hashage du mot de passe
 * @param {Object} req - Requête HTTP contenant les données utilisateur dans le body
 * @param {Object} res - Réponse HTTP
 * @returns {Object} Utilisateur créé au format JSON
 */
const createUser = async (req, res) => {
  const newUser = req.body;
  try {
    // SB - Création de l'utilisateur (le mot de passe sera hashé automatiquement)
    const user = await User.create(newUser);
    res.status(201).json(user);
  } catch (error) {
    if (error['cause'] === 400)
      {
        res.status(400).json({ message: error.message });
    }
    else{
      res.status(500).json({ message: "creation error" });
    }
  }
};

/**
 * SB - Méthode pour mettre à jour un utilisateur par son email
 * Si le mot de passe est modifié, il est re-hashé avec SHA256
 * @param {Object} req - Requête HTTP contenant l'email et les données à modifier
 * @param {Object} res - Réponse HTTP
 * @returns {Object} Utilisateur mis à jour ou erreur 404
 */
const updateUserByEmail = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // SB - Vérification et hashage du mot de passe si présent
    // Check if a password field is present (assuming it's called 'motDePasse')
    if (updateData.motDePasse) {
      const sha256Hash = crypto.createHash('sha256').update(updateData.motDePasse).digest('hex');
      updateData.motDePasse = sha256Hash;
    }

    // SB - Mise à jour de l'utilisateur avec validation
    const updatedUser = await User.findOneAndUpdate(
      { email: req.params.email },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    if (error['cause'] === 400) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Update error' });
    }
  }
};

/**
 * SB - Méthode pour supprimer un utilisateur par son email
 * @param {Object} req - Requête HTTP contenant l'email de l'utilisateur à supprimer
 * @param {Object} res - Réponse HTTP
 * @returns {Object} Message de confirmation de suppression
 */
const deleteUserByEmail = async (req, res) => {
  try {
    // SB - Suppression définitive de l'utilisateur
    await User.findOneAndDelete({ email: req.params.email });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




module.exports = {getUsers,  getUsersByEmail,  createUser,  updateUserByEmail,  deleteUserByEmail,};




