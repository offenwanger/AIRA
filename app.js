'use strict';
const express = require('express');
const fs = require('fs');
const app = express();
const formidable = require('formidable')
const http = require('http');
const PDFParser = require("pdf2json");

const port = 3333;

app.use(require('morgan')('dev'));

app.engine('html', require('ejs').renderFile);

app.get('/', function (req, res) {
  res.render(__dirname + '/local/main.html');
});
app.use('/', express.static(__dirname + '/local'));

app.use('/pdf', express.static(__dirname + '/server/PDFs'));

app.post('/upload', function(req, res) {
  new formidable.IncomingForm().parse(req)
    .on('fileBegin', (name, file) => {
      file.path = __dirname + '/server/PDFs/' + file.name;
    })
    .on('file', (name, file) => {
      console.log('Uploaded file');
      res.end(file.name);
      parsePDF(file.name);

    })
});

function parsePDF(filename) {
  let pdfParser = new PDFParser();

  pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
  pdfParser.on("pdfParser_dataReady", pdfData => {
    pdfData.formImage.Pages.forEach((page)=>{
      page.Texts.forEach((text)=>{
        text.R.forEach((textRun)=>{
          console.log(decodeURIComponent(textRun.T));
        });
      })
      console.log("--------PageBreak--------")
    });
    fs.writeFile(__dirname + '/server/PDFs/test.json', JSON.stringify(pdfData), function(err, result) {
      if(err) {
         console.log('error', err);
      } else {
        console.log("JSON written");
      }
    });
  });

  pdfParser.loadPDF(__dirname + '/server/PDFs/' + filename);
}

app.listen(port);
