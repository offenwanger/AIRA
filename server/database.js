const PDFParser = require("pdf2json");
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
let db;

exports.storePDF = function(filename) {
  let db = getDB();

  Promise.all([insertPDF(db, filename), fileToSentences(filename)]).then((results) => {
    let pdfID = results[0];
    let fileValues = results[1];
    console.log("all promises resolved");
    console.log(fileValues);
  })
}

function fileToSentences(filename) {
  return new Promise(function(resolve, reject) {
    let pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", errData => {
      reject("Error while extracting PDF text: " + errData.parserError);
    });

    let pageNumber = 1;
    let lineText = "";
    let extractedData = [];
  
    pdfParser.on("pdfParser_dataReady", pdfData => {
      let data = {startPage:pageNumber};
      pdfData.formImage.Pages.forEach((page)=>{
        page.Texts.forEach((text)=>{
          text.R.forEach((textRun)=>{
            lineText += textRun.T;
            // TODO: fix the issue with this breaking up decimal numbers etc.
            var sentenceTest = lineText.match(/([^\.!\?]+[\.!\?]+)|([^\.!\?]+$)/g);
            // Check if the line splits into sentences. 
            // There may be multiple sentences in a single line
            while(sentenceTest.length > 1) {
              data.endPage = pageNumber;
              data.lineText = decodeURIComponent(sentenceTest.shift());
              extractedData.push(data);
              // This is logically sound because only the first complete 
              // sentence could have been on the previous page
              data = {startPage:pageNumber};
            }
            lineText = sentenceTest.shift();
          });
        });
        pageNumber++;
      });

      resolve(extractedData);
      
      // fs.writeFile(__dirname + '/PDFs/test.json', JSON.stringify(pdfData), 
      //   function(err, result) {
      //     if(err) {
      //       console.log('error', err);
      //     } else {
      //       console.log("JSON written");
      //     }
      //   });
    });
  
    pdfParser.loadPDF(__dirname + '/PDFs/' + filename);

  });
}

function getDB() {
  if(db) return db;

  db = new sqlite3.Database(__dirname + '/db/database.db', (err) => {
    if (err) {
      console.log('Database error');
      console.error(err.message);
    }
    console.log('Database connection established.');

    let sql = `
      CREATE TABLE IF NOT EXISTS Pdfs (
        id INTEGER PRIMARY KEY, 
        filename TEXT
      );
    `;
    db.run(sql);

    sql = `
      CREATE TABLE IF NOT EXISTS Sentences (
        id INTEGER PRIMARY KEY, 
        pdf INTEGER,
        line_number INTEGER,
        start_page INTEGER,
        end_page INTEGER,
        line_text TEXT,
        FOREIGN KEY(pdf) REFERENCES Pdfs(id)
      );
    `;
    db.run(sql);
  });

  return db;
}

function insertPDF(db, filename) {
  return new Promise((resolve, reject) => {
    // TODO(offenwanger): If there is a duplicate filename or duplicate upload,
    // then this will duplicate the entry
    let sql = `INSERT INTO 'Pdfs' (filename) VALUES ('` + filename + `');`;
    db.run(sql);
    sql = `SELECT * FROM 'Pdfs' WHERE filename LIKE '%` + filename + `%'`;
    db.get(sql, [], (err, row) => {
      if (err) {
        reject(error);
        return;
      }

      if(!row || !row.id) {
        reject("Error while retriving PDF id for "+filename+"!");
        return;
      }

      resolve(row.id);
    });
  });
}