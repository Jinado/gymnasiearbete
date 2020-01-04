const bcrypt = require("bcryptjs");

module.exports = {
    hashPass: async password =>{
        const salt = await bcrypt.genSalt(15);
        const hashedPass = await bcrypt.hash(password, salt);
        return hashedPass;
    },
    hashAnswer: async answer =>{
        const salt = await bcrypt.genSalt();
        const hashedAnswer = await bcrypt.hash(answer, salt);
        return hashedAnswer;
    },
    compare: async (string, hashedString) =>{
        return await bcrypt.compare(string, hashedString);
    }
}