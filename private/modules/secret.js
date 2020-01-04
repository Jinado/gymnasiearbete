// Returns a random integer between 0 and max (excluding max).
// Therefore, random(3) returns either 0, 1, or 2 
// and random(1) would always return 0
function random(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

module.exports = {
    jwtSecret: "whuf&whaufjwjh$$FSFSAGHG!!fi18792sdgsd$1!13fhujhahihGDSGS%!GHhds41!GASgedg!&&291kdajwflk485wS",
    genereateCompanySecret: () => {
        // Generates a secret to be associated with a specific company
        // when that company is added to the database by an admin
        // account for the first time.
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
    }
};
