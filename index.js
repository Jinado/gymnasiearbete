const express = require("express");
const app = express();
const path = require("path");

// Middleware that serves everything in public as a static file (due to this, the "/" route isn't necessary)
app.use(express.static(path.join(__dirname, '/public')));

// View Engine middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/public/ejs'));

app.get("/", (req, res) => {
    res.render("pages/index", {title: "Homepage"});
});


// 404 - Error
app.get("*", (req, res) => {
    const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    res.render("errors/error404", {url: url, title: "404 - Page not found"});
});

app.listen(5000, () => console.log("Server listening on port 5000!"));

/*
    Use "lt -p 5000 -s ga-jinado" to run the localtunnel,
    then write the command "node index.js" in a separate terminal to
    start the server.
*/