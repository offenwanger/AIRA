const PDFParser = require("pdf2json");
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
let db;

exports.storePDF = function(filename) {
  let db = getDB();

  let insertQuery = `
    INSERT INTO Pdfs (filename)
    VALUES (` + filename + `);
    `;

  db.run(insertQuery);

  const sqlite3 = require('sqlite3').verbose();
  
  let sql = `SELECT * FROM Pdfs WHERE filename LIKE '%` + filename + `%'`;
  
  db.all(sql, [], (err, rows) => {
    console.log("got something");
    if (err) {
      throw err;
    }

    rows.forEach((row) => {
      console.log(row.filename)
      console.log(row.id);
    });
  });
  
  // close the database connection
  db.close();

  fileToSentences(filename).then((pdfData) => {
    console.log("Got the data");
  }, (error) => {
    console.log("PDF parsing error");
    console.error(error);
  });
}

function fileToSentences(filename) {
  return new Promise(function(resolve, reject) {
    let pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", errData => {
      reject(errData.parserError);
    });

    let db = getDB();
    let pageNumber = 1;
    let lineText = "";
    let PDF
  
    pdfParser.on("pdfParser_dataReady", pdfData => {
      let lines = [];
      pdfData.formImage.Pages.forEach((page)=>{
        page.Texts.forEach((text)=>{
          text.R.forEach((textRun)=>{
            lines.push(decodeURIComponent(textRun.T));
          });
        })
      });
  
      console.log(lines.join(" "));
  
      resolve(lines);
      
      fs.writeFile(__dirname + '/PDFs/test.json', JSON.stringify(pdfData), 
        function(err, result) {
          if(err) {
            console.log('error', err);
          } else {
            console.log("JSON written");
          }
        });
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

    let tablesetup = `
      CREATE TABLE IF NOT EXISTS Pdfs (
        id INTEGER PRIMARY KEY, 
        filename TEXT
      );

      CREATE TABLE IF NOT EXISTS Sentences (
        id INTEGER PRIMARY KEY, 
        pdf INTEGER,
        line_number INTEGER,
        start_page INTEGER,
        end_page INTEGER,
        line_text TEXT,
        FOREIGN KEY(pdf) REFERENCES Pdfs(id)
      );
    `
    db.run(tablesetup);

  });

  return db;
}