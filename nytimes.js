const express = require("express");
const axios = require("axios");
const router = express.Router();
const validateDatePackage = require("validate-date");

const baseurl = "https://api.nytimes.com/svc/archive/v1/";
const apiKey = "A3yHsAA1pxBrJksFKDpSADGpRKQq2HFG";

/**
 * Use the nytimes api to retreive articles on a given year or month.
 * Defaults to current date if not specified.
 *
 * @param {Object} date - object that contains date
 * @param {string} date.year - year of the date to search
 * @param {string} date.month - month of the date to search
 * @returns {Array} list of article objects
 */
function get_articles({ year, month } = {}) {
	if (!year && !month) {
		var today = new Date();
		year = today.getFullYear();
		month = today.getMonth() + 1;
		console.log(year, month);
	}
	var url = baseurl + year + "/" + month + ".json?api-key=" + apiKey;
	return axios
		.get(url)
		.then((response) => {
			var articles = response.data.response.docs;
			return articles;
		})
		.catch((error) => {
			console.log(error);
			return error;
		});
}

/**
 * Process the articles by trimming down to 10 articles if there are more than 10.
 * Leave a selected list of keys and remove the rest.
 *
 * @param {Array} articles - list of the articles retreived from the nytimes api
 * @returns {Array} - list of articles that are trimmed down and selected
 */

function process_articles(articles) {
	if (articles.length > 10) {
		articles = articles.splice(0, 10);
	}
	if (articles)
		return articles.map((item) => {
			return {
				abstract: item.abstract,
				web_url: item.web_url,
				headline: item.headline,
				date: item.pub_date,
				section_name: item.section_name,
				byline: item.byline,
				id: item.uri,
			};
		});
}

/**
 * Helper function for checkValidDate.
 *
 * @param {string} year - year to format
 * @param {string} month - month to format
 * @param {string} day - date to format
 * @returns {Array} an formatted array with no empty spaces
 */
function formatDate(year, month, day) {
	var numDay = parseInt(day);
	var numMonth = parseInt(month);
	if (0 < numDay && numDay < 10) {
		day = "0" + day;
	}
	if (0 < numMonth && numMonth < 10) {
		month = "0" + month;
	}
	return [year, month, day];
}

/**
 * Format date and use external valid-date package to check whether
 * input date is valid.
 *
 * @param {string} year - year to check
 * @param {string} month - month to check
 * @param {string} day - date to check
 * @returns {boolean} - whether or not input date is valid
 */
function checkValidDate(year, month, day) {
	var [year, month, day] = formatDate(year, month, day);

	return validateDatePackage(
		month + "/" + day + "/" + year,
		(responseType = "boolean")
	);
}

/**
 * Check if request query object has received valid input.
 *
 * @param {Object} req - request object
 * @returns {boolean} - returns false if input date is not valid
 * @returns {Object} - returns a date object
 */
function validate_date(req) {
	var year, month, date, hrs;
	year = req.query.year;
	month = req.query.month;
	var currYear = new Date().getFullYear();
	var currMonth = new Date().getMonth() + 1;
	var currDate = new Date().getDate();

	// year or month cannot be empty
	if (!year || !month) {
		return false;
	}
	// nytimes archive api starts at 1851
	if (year < 1851 || year > currYear) {
		return false;
	}
	// cannot look for articles ahead of this month
	if (year == currYear && month > currMonth) {
		return false;
	}
	// check if month is valid
	if (month < 1 || month > 12) {
		return false;
	}
	if ("date" in req.query) {
		if (checkValidDate(year, month, req.query.date)) {
			date = req.query.date;
			// cannot look for articles ahead of this date
			if (year == currYear && month == currMonth && date > currDate) {
				return false;
			}
		} else {
			return false;
		}
		// if date is not specified, default to false
	} else {
		date = false;
	}
	if ("hrs" in req.query) {
		hrs = req.query.hrs;
		if (hrs > 24 || hrs < 0) {
			return false;
		}
		// if time of the day is present but not the date
		if (hrs && !date) {
			return false;
		}
		// if hrs is not specified, default to false
	} else {
		hrs = false;
	}
	return { year, month, date, hrs };
}

/**
 * Use input date to filter objects by publication date.
 *
 * @param {Object} date - date object
 * @param {string} date.year - year to filter by
 * @param {string} date.month - month to filter by
 * @param {string} date.date - date to filter by
 * @param {string} date.hrs - hrs to filter by
 * @param {Array} articles - articles to filter
 * @returns {Array} - a filtered list of article objects
 */
function filter_articles({ year, month, date = false, hrs = false }, articles) {
	if (date && !hrs) {
		return articles.filter((item) => {
			const fullDate = new Date(item.pub_date);
			const yearToCheck = fullDate.getFullYear().toString();
			const monthToCheck = (fullDate.getMonth() + 1).toString();
			const dateToCheck = fullDate.getDate().toString();
			return (
				date === dateToCheck &&
				month === monthToCheck &&
				year === yearToCheck
			);
		});
	} else if (date && hrs) {
		return articles.filter((item) => {
			const fullDate = new Date(item.pub_date);
			const yearToCheck = fullDate.getFullYear().toString();
			const monthToCheck = (fullDate.getMonth() + 1).toString();
			const dateToCheck = fullDate.getDate().toString();
			const timeToCheck = fullDate.getHours().toString();
			return (
				date === dateToCheck &&
				month === monthToCheck &&
				year === yearToCheck &&
				hrs === timeToCheck
			);
		});
	}
}

/**
 * Search list of articles for matching id which is also the uri.
 *
 * @param {string} id
 * @param {Array} articles
 * @returns {Array} matching article in an array. Empty array if no match found.
 */
function search_article(id, articles) {
	return articles.filter((article) => {
		return article.uri === id;
	});
}

// get articles of this year and month
// ex) http://localhost:3000/nytimes
router.get("/", (req, res) => {
	get_articles({})
		.then((articles) => {
			var processed = process_articles(articles);
			res.json(processed);
		})
		.catch((error) => {
			console.log(error);
		});
});

// get articles of year month, date and hrs (date and hours can be omitted)
// hrs is the time of the day. must be in 24 hr format
// ex) http://localhost:3000/nytimes/articles?year=1899&month=12&date=21&hrs=2
router.get("/articles", (req, res) => {
	if (!validate_date(req)) {
		res.status(400).json({ message: "Invalid Query" });
	} else {
		var { year, month, date, hrs } = validate_date(req);
		get_articles({ year, month })
			.then((articles) => {
				// filter articles if date is specified
				if (date) {
					articles = filter_articles(
						{ year, month, date, hrs },
						articles
					);
				}
				if (articles.length === 0) {
					res.json({ message: "No articles found" });
				} else {
					var procesed = process_articles(articles);
					res.json(procesed);
				}
			})
			.catch((error) => {
				console.log(error);
			});
	}
});

// get specific article from year and month using id
// ex) http://localhost:3000/nytimes/article/nyt://article/0dc0f814-bbfb-5b47-9f2c-3d1042dfe46d?year=2022&month=7
router.get("/article/*", (req, res) => {
	if (!validate_date(req)) {
		res.status(400).json({ message: "Invalid Query" });
	} else {
		var { year, month, _, _ } = validate_date(req);
		get_articles({ year, month })
			.then((articles) => {
				var result = search_article(req.params["0"], articles);
				if (result.length === 0) {
					res.json({ message: "No articles found" });
				} else {
					var processed = process_articles(result);
					res.json(processed);
				}
			})
			.catch((error) => {
				console.log(error);
			});
	}
});

router.get("*", (req, res) => {
	res.send("<h1>404</h1>");
});

module.exports = {
	router,
};
