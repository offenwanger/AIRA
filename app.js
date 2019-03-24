'use strict';
const express = require('express');
const app = express();
const formidable = require('formidable')
const http = require('http');
const database = require("./server/database.js");
const recommender = require("./server/recommender.js");

const port = 3333;

app.use(require('morgan')('dev'));
app.engine('html', require('ejs').renderFile);

app.get('/', function (req, res) {
  res.render(__dirname + '/local/main.html');

  // At a later date this will distinguish between source sets. 
  let project = 0;
  let question = 0;
  let numRecommendations = 10;

  recommender.getRecommendations(question, database).then((recommendations)=>{
    console.log(recommendations.splice(0, numRecommendations));
  });
});

app.get('/pdflist', function (req, res) {
  database.getAllPdfs().then((pdfs)=>{
    res.end(JSON.stringify(pdfs));
  }).catch((error) => {
    console.log(error);
    res.status(500).send('Failed to get PDFs: '+error);
  });
});

app.use('/', express.static(__dirname + '/local'));

app.use('/pdf', express.static(__dirname + '/server/PDFs'));

app.post('/upload', function(req, res) {
  new formidable.IncomingForm().parse(req)
    .on('fileBegin', (name, file) => {
      // This directly stores the file which is bad, but does the trick for now.
      file.path = __dirname + '/server/PDFs/' + file.name;
    })
    .on('file', (name, file) => {
      console.log('File Uploaded');
      database.storePDF(file.name)
        .then(()=>{
          // Answer the post request with the name of the uploaded file. 
          // This will tell the client how to request and display it.
          res.end(file.name);
        }).catch((error)=>{
          console.log(error);
          res.status(500).send('Upload Failed: '+error);
        });
    })
});

app.listen(port);
