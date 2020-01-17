/* ============================== DOCUMENTATION FOR BELOW CODE =====================================
FUNCTION - RANDOM: Returns a random integer between 0 and max (excluding max).

STRING - JWTSECRET: A secret used when signing JSON Web Tokens.

METHOD - GENERATECOMPANYSECRET: Generates a secret to be associated with a specific company, when
that company is added to the database by and admin account for the first time.

METHOD - MAKEREADABLE: Takes the secret code of a company as its argument and returns the same code,
although with dashes every four characters to make it easier to read.

METHOD - ISUNIQUE: Takes the secret code of a company to check if it is unique. This is done when
generating a code.

METHOD - PREPAREFORDB: Takes the secret code of a company and removes all dashes inside the string.
==================================================================================================== */

function random(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

const database = require("./connect");

module.exports = {
    jwtSecret: "whuf&whaufjwjh$$FSFSAGHG!!fi18792sdgsd$1!13fhujhahihGDSGS%!GHhds41!GASgedg!&&291kdajwflk485wS",
    genereateCompanySecret: () => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let secret = "";
        for(let i = 0; i < 16; i++){
            secret += alphabet[random(alphabet.length)];
        }

        return secret;
    },
    makeReadable: secret => {
        let readable = "";
        for(let i = 0; i < secret.length; i++){
            if((((i + 1) % 4) === 0) && ((i + 1) !== secret.length)){
                readable += `${secret[i]}-`;
            } else {
                readable += secret[i];
            }
        }

        return readable;
    },
    isUnique: async secret => {
        const [rows, fields] = await database.runStatement("SELECT secret FROM companies;", null);
        rows.forEach(row => {
            if(secret === row){
                return false;
            }
        });

        return true;
    },
    prepareForDB: secret => {
        let splitSecret = secret.split("-"); // Make sure to remove any dashes before using the secret in a SQL query
        let formattedSecret = "";
        splitSecret.forEach(part => {
            formattedSecret += part;
        });

        return formattedSecret;
    }
};
