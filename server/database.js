const PDFParser = require("pdf2json");
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
let db;

exports.storePDF = function(filename) {
  let db;
  return getDB()
  .then((database) => {
    db = database;
    return Promise.all([insertPDF(db, filename), fileToSentences(filename)])
  })
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
  return getDB().then((db) => new Promise((resolve, reject) => {
    db.all(`
      SELECT s.*, p.filename FROM Sentences AS s
      INNER JOIN Pdfs AS p ON s.pdf = p.id;
    `, function(err, allRows) {
      if (err) {
        reject("Error while fetching sentences: "+err);
        return;
      }
      resolve(allRows);
    });
  }));
}

exports.getAllPdfs = function() {
  return getDB().then((db) => new Promise((resolve, reject) => {
    db.all("SELECT * FROM Pdfs", function(err, allRows) {
      if (err) {
        reject("Error while fetching pdfs: "+err);
        return;
      }
      resolve(allRows);
    });
  })); 
}

exports.getSources = function() {
  return getDB().then((db) => new Promise((resolve, reject) => {
    db.all(`SELECT s.*, p.filename, a.answer FROM Sources AS s
            INNER JOIN Pdfs AS p ON s.pdf = p.id
            LEFT JOIN Answers AS a ON a.source = s.id`, function(err, allRows) {
      if (err) {
        reject("Error while fetching sources: "+err);
        return;
      }
      resolve(allRows);
    });
  }));
}

exports.insertSource = function(source_text, source_page, source_pdf) {
  return getDB().then((db) => new Promise((resolve, reject) => {
    sql = `INSERT INTO 'Sources'(source_text, start_page, pdf) VALUES (?, ?, ?);`;
    db.run(sql, [source_text, source_page, source_pdf], function(err) {
      if(err) {
        reject("Database error while storing "+source_text+": "+err);
        return;
      }
      
      resolve(this.lastID);
    });
  }));
}

exports.updateAnswer = function(source_id, answer_text) {
  //Note: This will replace the entire answer row.
  return getDB().then((db) => new Promise((resolve, reject) => {
    let sql = `REPLACE INTO Answers (source, answer) VALUES (?, ?);`;
    db.run(sql, [source_id, answer_text], function(err) {
      if(err) {
        reject("Database error while updating answer with: "+answer_text+": "+err);
        return;
      }
      resolve();
    });
  }));
}

exports.deleteSource = function(source_id) {
  return getDB().then((db) => new Promise((resolve, reject) => {
    let sql = `DELETE FROM Sources WHERE id = ?;`;
    db.run(sql, [source_id], function(err) {
      if(err) {
        reject("Database error while deleting source: "+answer_text+": "+err);
        return;
      }
      resolve();
    });
  }));
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

function getDB() {
  return new Promise((resolve, reject) => {
    if(db) {
      resolve(db);
      return;
    }

    db = new sqlite3.Database(__dirname + '/db/database.db', (err) => {
      if (err) {
        console.log('Database error while getting database');
        console.error(err.message);
        reject(err);
        return;
      }

      console.log('Database connection established.');
      Promise.resolve().then(new Promise((res) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS Pdfs (
            id INTEGER PRIMARY KEY, 
            filename TEXT
          );
        `, function(err) {
            if(err) console.error("Error while creating table Pdfs: "+err);
            res();
          });
      })).then(new Promise((res) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS Sentences (
            id INTEGER PRIMARY KEY, 
            pdf INTEGER,
            line_number INTEGER,
            start_page INTEGER,
            end_page INTEGER,
            line_text TEXT,
            FOREIGN KEY(pdf) REFERENCES Pdfs(id) ON DELETE CASCADE
          );
        `, function(err) {
            if(err) console.error("Error while creating table Sentences: "+err);
            res();
          });
      })).then(new Promise((res) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS Sources (
            id INTEGER PRIMARY KEY, 
            source_text TEXT,
            start_page INTEGER,
            pdf INTEGER,
            FOREIGN KEY(pdf) REFERENCES Pdfs(id) ON DELETE CASCADE
          );
        `, function(err) {
            if(err) console.error("Error while creating table Sources: "+err);
            res();
          });
      })).then(new Promise((res) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS Answers (
            id INTEGER PRIMARY KEY, 
            answer TEXT,
            source INTEGER UNIQUE,
            FOREIGN KEY(source) REFERENCES Sources(id) ON DELETE CASCADE
          );
        `, function(err) {
            if(err) console.error("Error while creating table Answers: "+err);
            res();
          });
      })).then(()=>{
        resolve(db);
      });
    });
  });
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
