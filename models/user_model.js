const mongoose = require('mongoose');
const sha256 = require('js-sha256')

//sb
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
        required: true,
    },
    service: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
    },
    createdAt: {
        type: String,
        default: Date.now,
    },
});


// exemple de hook pour gérer les erreur directement dans le model
userSchema.pre('save',async function(next){
    if (this.isNew) {
        const existingUser = await User.findOne({ email: this.email})
        if (existingUser) {
            throw new Error('User already exists', {cause: 400})
        }
        this.password = sha256(this.password + process.env.salt)
    }
    next()

})


userSchema.pre('findOneAndUpdate', async function(next) {
    const existingUser = await User.findOne({ email: this.email})
    if (existingUser) {
        throw new Error('User already exists', {cause: 400})
    }
    next()
});




const User = mongoose.model('User', userSchema);

module.exports = User;
