const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const nytimes = require("./nytimes");

app.get("/", (req, res) => {
	res.redirect("/nytimes");
});

app.use("/nytimes", nytimes.router);

app.listen(port, () => {
	console.log("Listening...");
});
