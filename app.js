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
  // At a later date this will distinguish between source sets. 
  let project = 0;
  let question = 0;
  let numRecommendations = 10;

  recommender.getRecommendations(question, database).then((recommendations)=>{
    console.log(req.query);
    if(req.query.num) {
      recommendations = recommendations.splice(0, req.query.num);
    } else {
      recommendations = recommendations.splice(0, 10)
    }
    res.json(recommendations);
  });
});

app.use('/', express.static(__dirname + '/local'));

app.use('/pdf', express.static(__dirname + '/server/PDFs'));

app.post('/upload', function(req, res) {
  let fileNames = Object.keys(req.files['uploadedFiles']);
  if (fileNames.length == 0) {
    return res.status(400).send('No files were uploaded.');
  }

  console.log(req.files['uploadedFiles']);

  let promises = [];
  for(let i = 0; i < req.files['uploadedFiles'].length; i++) {
    let file = req.files['uploadedFiles'][i];
    promises[i] = new Promise(function(resolve, reject) {
      let path = __dirname + '/server/PDFs/' + file.name;

      file.mv(path, function(err) {
        if (err) {
          console.log("Error storing file "+file.name);
          resolve({name:file.name, uploaded:false, error:err});
          return;
        }
        
        database.storePDF(file.name).then(()=>{
          resolve({name:file.name, uploaded:true});
          console.log(file.name+' stored');
        }).catch((err)=>{
          console.log(file.name+' failed to store: '+err);
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
