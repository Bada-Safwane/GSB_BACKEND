const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// SB - Configuration du client AWS S3 avec les identifiants
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

/**
 * SB - Méthode pour uploader un fichier sur AWS S3
 * Génère un nom de fichier unique avec UUID et upload sur le bucket S3
 * @param {Object} file - Fichier à uploader (buffer et nom original)
 * @returns {String} URL publique du fichier uploadé sur S3
 */
const uploadToS3 = async (file) => {
    try {
        // SB - Extraction de l'extension du fichier original
        const fileExtension = file.originalname.split('.').pop()
        // SB - Génération d'un nom unique avec UUID
        const key = `${uuidv4()}.${fileExtension}`

        // SB - Configuration des paramètres d'upload S3
        const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: key,
            Body: file.buffer
        };

        // SB - Upload du fichier et récupération de l'URL
        const uploadData = await s3.upload(params).promise();
        console.log(`File uploaded successfully. ${uploadData.Location}`)
        return uploadData.Location;

    } catch (error) {
        console.error('Error uploading to S3:', error)
        throw new Error('Failed to upload file to S3')
    }
};

module.exports = { uploadToS3 }