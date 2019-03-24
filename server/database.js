const PDFParser = require("pdf2json");
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
let db;

exports.storePDF = function(filename) {
  let db = getDB();

  return Promise.all([insertPDF(db, filename), fileToSentences(filename)])
    .catch((err)=>{
      throw Error("Error inserting PDF: " + err);
    })
    .then((results) => {
      let pdfID = results[0];
      let fileValues = results[1];
      console.log("Starting to store PDF");
      for(let i = 0; i<fileValues.length; i++) {
        insertLineRow(db, pdfID, i, fileValues[i].startPage, fileValues[i].endPage, 
          fileValues[i].lineText).catch((err)=>{
            console.log("Insert Failed: "+ err);
          });
      }
      console.log("Finished storing PDF");
    });
}

exports.getAllText = function() {
  let db = getDB();

  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM Sentences", function(err, allRows) {
      if (err) {
        reject("Error while fetching sentences: "+err);
        return;
      }
      resolve(allRows);
    });
  });
}

//TODO: get actual sources.
exports.getSources = function(question) {
  return [
    `We invited 24 participants (ages 20-43, M=29, 13 female) to participate in our VR scenarios and used a semistructured interview to explore the experience of exiting VR`,
    `We recruited 12 participants (6 female, age M=23.5, SD=4.62).`,
    `We recruited 16 participants from our organization (9 female, 7 male, age 28.8 ± 3.1 years), forming four groups.`
  ];
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
            lineText += " " + textRun.T;
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
    });
  
    pdfParser.loadPDF(__dirname + '/PDFs/' + filename);

  });
}

// Should return promise here;
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

    sql = `
      CREATE TABLE IF NOT EXISTS Sources (
        id INTEGER PRIMARY KEY, 
        source_text TEXT
      );
    `;
    db.run(sql, function(err) {
      if(err) console.log(err);
    });
  });

  return db;
}

function insertPDF(db, filename) {
  return new Promise((resolve, reject) => {
    // TODO(offenwanger): If there is a duplicate filename or duplicate upload,
    // then this will duplicate the entry
    let sql = `SELECT * FROM 'Pdfs' WHERE filename LIKE ?`;
    db.get(sql, [filename], (err, row) => {
      if (err) {
        reject("Error while checking for duplicates: "+err);
        return;
      }

      if(row) {
        reject("Error "+filename+" already stored!");
        return;
      }

      sql = `INSERT INTO 'Pdfs' (filename) VALUES (?);`;
      db.run(sql, [filename], function(err) {
        if(err) {
          reject("Database error while storing "+filename+": "+err);
          return;
        }
        resolve(this.lastID);
      });
    });
  });
}


function insertLineRow(db, pdfID, lineNumber, startPage, endPage, lineText) {
  return new Promise((resolve, reject) => {
    let sql = `INSERT INTO 'Sentences' (pdf, line_number, start_page, end_page, line_text) 
               VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [pdfID, lineNumber, startPage, endPage, lineText], (err)=>err?reject(err):resolve());
  });
};
