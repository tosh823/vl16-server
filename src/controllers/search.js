const express = require('express');
const axios = require('axios');
var cheerio = require('cheerio');
var cors = require('cors');
var router = express.Router();

const koha = 'https://koha.outikirjastot.fi';
const search = '/cgi-bin/koha/opac-search.pl?idx=&q=';
const details = '/cgi-bin/koha/opac-detail.pl?biblionumber=';
const ouluLocation = '&branch_group_limit=branch%3AOUPK';

router.get('/', cors(), function (req, res) {
    if (req.query.title != null) {
        var query = req.query.title.replace(/ /g, '+');
        var url = koha + search + query + ouluLocation;
        var config = {
            headers: {
                host: 'koha.outikirjastot.fi'
            }
        };
        axios.get(url, config)
            .then(function (response) {
                var $ = cheerio.load(response.data);
                var bookInfoPage = $('#catalogue_detail_biblio');
                var results = [];
                if (bookInfoPage.length > 0) {
                    console.log('Parsing one book');
                    var book = parseBookDetailsPage(response.data);
                    results.push(book);
                    console.log(JSON.stringify(results));
                }
                else {
                    console.log('Parsing books');
                    results = parseSearchResultsPage(response.data);
                }
                res.send(results);
            })
            .catch(function (error) {
                console.log('Error occured: ' + JSON.stringify(error));
                res.status(404).send(error);
            });
    }
    else {
        res.status(404).send('Not found');
    }
});

router.get('/book', cors(), function (req, res) {
    if (req.query.id != null) {
        var url = koha + details + req.query.id;
        var config = {
            headers: {
                host: 'koha.outikirjastot.fi'
            }
        };
        axios.get(url, config)
            .then(function (response) {
                var book = parseBookDetailsPage(response.data);
                res.send(book);
            })
            .catch(function (error) {
                console.log('Error occured: ' + JSON.stringify(error));
                res.status(404).send(error);
            });
    }
    else {
        res.status(404).send('Not found');
    }
});

function parseBookDetailsPage(page) {
    var book = {};
    var $ = cheerio.load(page);
    var bookInfo = $('#catalogue_detail_biblio').children('.tietue');
    var holdsInfo = $('.holdingst');
    book['title'] = $(bookInfo).find('.title').text();
    book['cover'] = $(bookInfo).find('.jokunen_image_container').children('img').attr('src');
    book['authors'] = [];
    $(bookInfo).find('.author').find('span').each(function (index, element) {
        if ($(element).attr('property') == 'name') {
            book['authors'].push($(element).text());
        }
    });
    book['type'] = $(bookInfo).find('.results_summary.type').text();
    book['language'] = $(bookInfo).find('.results_summary.language').children('img').attr('alt');
    book['publisher'] = [];
    $(bookInfo).find('.results_summary.publisher').find('span').each(function (index, element) {
        var property = $(element).attr('property');
        var location = (property == 'location');
        var name = (property == 'name');
        var datePublished = (property == 'datePublished');
        if (location || name || datePublished) {
            book['publisher'].push($(element).text());
        }
    });
    $(bookInfo).find('.results_summary.description > *').each(function (index, element) {
        if ($(element).attr('property') == 'description') {
            book['description'] = $(element).text().trim();
        }
    });
    $(bookInfo).find('.results_summary.isbn > *').each(function (index, element) {
        if ($(element).attr('property') == 'isbn') {
            book['isbn'] = $(element).text().trim();
        }
    });
    // Holds data
    book['locations'] = [];
    $(holdsInfo).find('tbody').children().each(function (index, element) {
        var library = $(element).find('.location').children('div');
        var libraryName = $(library).text().trim();
        console.log(libraryName);
        if (libraryName == 'Oulun kaupungin pääkirjasto') {
            // Location fetching
            var locationModel = {};
            var locationCallNumber = $(element).find('.call_no');
            locationModel['callNumber'] = $(locationCallNumber).text().trim();
            // Collection fetching
            var collection = $(element).find('.collection');
            if (collection != null && collection.text().trim() != '') locationModel['collection'] = collection.text().trim();
            book['locations'].push(locationModel);
        }
    });
    book['locations'] = removeDuplicates(book);
    return book;
};

function parseSearchResultsPage(page) {
    var $ = cheerio.load(page);
    var searchResultsTable = $('.table-striped');
    var searchResults = [];
    $(searchResultsTable).children('tr').each(function (index, element) {
        var info = $(element).find('.bibliocol');
        var titleA = $(info, 'p').find('.nimeke');
        var authorSpan = $(info, 'p').find('.author');
        var materialSpan = $(info, 'span').find('.results_summary');
        var languageSpan = $(info, 'span').find('.results_summary.language');
        var publisherSpan = $(info, 'span').find('.results_summary.publisher');
        var title = $(titleA).text();
        var href = $(titleA).attr('href');
        var author = $(authorSpan).text();
        var materialType = $(materialSpan).children('img').attr('alt');
        if (materialType !== 'kirja') return true;
        var language = $(languageSpan).children('img').attr('alt');
        var publisher = $(publisherSpan).text();
        searchResults.push({
            title: title,
            author: author,
            href: href,
            type: materialType,
            language: language,
            publisher: publisher
        });
    });
    return searchResults;
};

function removeDuplicates(book) {
    var locations = book.locations;
    // Removing duplicates
    var duplicates = [];
    for (var index = 0; (index < locations.length) && (!duplicates.includes(index)); index++) {
        var currentLocation = locations[index];
        for (var other = 0; (other < locations.length) && (other != index); other++) {
            var otherLocation = locations[other];
            var callNumbersEqual = (currentLocation.callNumber === otherLocation.callNumber);
            var collExist = (currentLocation.collection != null) && (otherLocation.collection != null);
            var collEqual = (currentLocation.collection === otherLocation.collection);
            if (callNumbersEqual && (!collExist || (collExist && collEqual))) duplicates.push(other);
        }
    }
    duplicates.forEach(function (value) {
        locations.splice(value, 1);
    });
    return locations;
};

module.exports = router;