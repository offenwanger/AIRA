'use strict';
const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const formidable = require('formidable')
const database = require("./server/database.js");
// const recommender = require("./server/recommender.js");
const recommender = require("./server/logRecommender.js");
const fs = require('fs');

const port = 3333;

let recommendations;

console.log("************* Starting the AIRA server *************")

app.use(require('morgan')('dev'));
app.use(fileUpload());

app.engine('html', require('ejs').renderFile);

app.get('/', function (req, res) {
  res.render(__dirname + '/local/main.html');
});

app.get('/pdflist', function (req, res) {
  database.getAllPdfs().then((pdfs)=>{
    res.json(pdfs);
  }).catch((error) => {
    console.log(error);
    res.status(500).send('Failed to get PDFs: '+error);
  });
});

app.get('/recommendations', function(req, res){
  if(recommendations) {
    recommendations.then((result)=>{
      res.json(result);
    });
  } else {
    res.status(400).send("No recommendations in progress");
  }
});

app.get('/sources', function(req, res){
  database.getSources().then((sources)=>{
    res.json(sources);
  });
});

app.get('/insertsource', function(req, res) {
  let text = req.query.text;
  let page_num = req.query.page_num;
  let pdf_id = req.query.pdf_id;
  database.insertSource(text, page_num, pdf_id)
    .then((id) => res.send({sourceId: id}))
    .catch((err) => {
      console.log("Database error: "+err);
      res.status(400).send("Database error: "+err);
    });
});

app.get('/updateanswer', function(req, res) {
  let sourceId = req.query.source_id;
  let text = req.query.text;
  database.updateAnswer(sourceId, text)
    .then(() => res.send())
    .catch((err) => {
      console.log("Database error: "+err);
      res.status(400).send("Database error: "+err);
    });
});

app.get('/deletesource', function(req, res) {
  let sourceId = req.query.source_id;
  database.deleteSource(sourceId)
    .then(() => res.send())
    .catch((err) => {
      console.log("Database error: "+err);
      res.status(400).send("Database error: "+err);
    });
});

app.use('/', express.static(__dirname + '/local'));

app.use('/pdf', express.static(__dirname + '/server/PDFs'));

app.post('/upload', function(req, res) {
  let fileNames = Object.keys(req.files['uploadedFiles']);
  if (fileNames.length == 0) {
    return res.status(400).send('No files were uploaded.');
  }

  if(!req.files['uploadedFiles'].name) {
    return res.status(400).send('Too many files uploaded.');
  } 

  
  let file = req.files['uploadedFiles'];
  let path = __dirname + '/server/PDFs/' + file.name;

  if (!fs.existsSync(__dirname + '/server/PDFs/')){
    fs.mkdirSync(__dirname + '/server/PDFs/');
  }

  console.log("Storing file")
  file.mv(path, function(err) {
    console.log("done storing")
    if (err) {
      console.log("Error while placing file in storage folder file "+file.name);
      resolve({name:file.name, uploaded:false, error:err});
      return;
    }
    
    recommendations = recommender.getRecommendations(file.name);

    res.send({name:file.name, uploaded:true});
    
  });
});

app.listen(port);
