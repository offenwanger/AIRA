'use strict';
const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const formidable = require('formidable')
const database = require("./server/database.js");
const recommender = require("./server/recommender.js");

const port = 3333;

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
  recommender.getRecommendations(database).then((recommendations)=>{
    if(req.query.num) {
      recommendations = recommendations.splice(0, req.query.num);
    } else {
      recommendations = recommendations.splice(0, 10)
    }
    res.json(recommendations);
  });
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

app.use('/', express.static(__dirname + '/local'));

app.use('/pdf', express.static(__dirname + '/server/PDFs'));

app.post('/upload', function(req, res) {
  let fileNames = Object.keys(req.files['uploadedFiles']);
  if (fileNames.length == 0) {
    return res.status(400).send('No files were uploaded.');
  }

  // If one file was uploaded then turn it into an array so the code can roll on.
  if(req.files['uploadedFiles'].name) {
    req.files['uploadedFiles'] = [req.files['uploadedFiles']];
  }

  let promises = [];
  for(let i = 0; i < req.files['uploadedFiles'].length; i++) {
    let file = req.files['uploadedFiles'][i];
    promises[i] = new Promise(function(resolve, reject) {
      let path = __dirname + '/server/PDFs/' + file.name;

      file.mv(path, function(err) {
        if (err) {
          console.log("Error while placing file in storage folder file "+file.name);
          resolve({name:file.name, uploaded:false, error:err});
          return;
        }
        
        database.storePDF(file.name).then(()=>{
          console.log(file.name+' successfully stored');
          resolve({name:file.name, uploaded:true});
        }).catch((err)=>{
          console.log(file.name+' failed to store in database: '+err);
          resolve({name:file.name, uploaded:false, error:err});
        });
      });
    });
  }

  Promise.all(promises).then((results) => {
    res.send(results);
  });
});

app.listen(port);
