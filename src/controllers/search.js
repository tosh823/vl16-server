const express = require('express');
const axios = require('axios');
var cheerio = require('cheerio');
var cors = require('cors');
var router = express.Router();

const koha = 'https://koha.outikirjastot.fi';
const search = '/cgi-bin/koha/opac-search.pl?idx=&q=';
const ouluLocation = '&branch_group_limit=branch%3AOUPK';

router.get('/', cors(), function(req, res) {
    if (req.query.title != null) {
        var query = req.query.title.replace(/ /g, '+');
        var url = koha + search + query + ouluLocation;
        console.log(url);
        var config = {
            headers: {
                host: 'koha.outikirjastot.fi'
            }
        };
        axios.get(url, config)
            .then(function(response) {
                var $ = cheerio.load(response.data);
            })
            .catch(function(error) {
                console.log('Error: ' + JSON.stringify(error));
                res.status(404).send(error);
            });
    }
    else {
        res.status(404).send('Not found');
    }
});

module.exports = router;