const fs = require('fs');
const PDFParser = require("pdf2json");
const { spawn } = require('child_process');

var checkWord = require('check-word'), engWords = checkWord('en');

exports.getRecommendations = (filename) => {

    return fileToText(filename).then((filename) => new Promise((resolve, reject) => {
        console.log(filename);

        let recommendationResults = [];
        // spawn new child process to call the python script
        const python = spawn('py', ['runModule.py', filename], { cwd: __dirname });
        console.log(__dirname)

        // collect data from script
        python.stdout.on('data', function (data) {
            text = data.toString();
            lines = text.split(/\r?\n/)
            lines.forEach(line => {
                if(line.includes("RESULT: ")) {
                    line = line.replace("RESULT: ", "");
                    num = line.slice(0, 5)
                    sentence = line.slice(6)
                    // Check if there is at least one english word in this thing
                    // remove all non letters because they mess with the check-words
                    if(sentence.replace(/[^A-Za-z0-9\s]/g,'').split(" ").some(word => engWords.check(word))) {
                        recommendationResults.push({"measure": parseFloat(num), "text": sentence});
                    }
                }
            })
        });

        python.stderr.on('data', function(data) {
            console.log(data.toString());
        })

        // in close event we are sure that stream from child process is closed
        python.on('close', (code) => {
            console.log(`child process close all stdio with code ${code}`);
            // send data to browser
            resolve(recommendationResults);
        });
    }));
}

function fileToText(filename) {
    return new Promise(function (resolve, reject) {
        let pdfParser = new PDFParser();

        pdfParser.on("pdfParser_dataError", errData => {
            reject("Error while extracting PDF text: " + errData.parserError);
        });

        let pageNumber = 1;
        let pdfText = "";
        let extractedData = [];

        pdfParser.on("pdfParser_dataReady", pdfData => {
            let data = { startPage: pageNumber };
            pdfData.formImage.Pages.forEach((page) => {
                page.Texts.forEach((text) => {
                    text.R.forEach((textRun) => {
                        pdfText += " " + textRun.T;
                    });
                });
                pageNumber++;
            });

            newFile = filename.split(".")[0] + ".txt"

            if (!fs.existsSync(__dirname + '/text_files/')){
                fs.mkdirSync(__dirname + '/text_files/');
            }

            // Decode URI makes python go haywire. Don't know why. Highly annoying. 
            pdfText = pdfText.replace(/%20/g, " ").replace(/%2C/g, ",").replace(/%2E/g, ".").replace(/%3F/g, "?");

            fs.writeFile(__dirname + "/text_files/" + newFile, pdfText, "utf8", function (err) {
                if (err) {
                    return console.log("ERROR: " + err);
                }
                console.log("The file was saved!");
                resolve(newFile);
            });
        });

        pdfParser.loadPDF(__dirname + '/PDFs/' + filename);

    });
}
