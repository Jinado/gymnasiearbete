/* ========================== DOCUMENTATION FOR BELOW CODE =================================
METHOD - HASHSTRING: Takes a string as its argument and returns its hashed version

METHOD - COMPARE: Compares a hashed string with a non-hashed string to see if they're equal
============================================================================================ */

const bcrypt = require("bcryptjs");

module.exports = {
    hashString: async string => {
        const salt = await bcrypt.genSalt(12);
        const hashedString = await bcrypt.hash(string, salt);
        return hashedString;
    },
    compare: async (string, hashedString) => {
        return await bcrypt.compare(string, hashedString);
    }
}