const LOG_LEVEL = 0;
const VERBOSE = 1;

const axios = require('axios');

let checkWords = require('check-word')('en');

let natural = require('natural');
let TfIdf = natural.TfIdf;
let tokenizer = new natural.WordTokenizer();

let Word2VecUtils = require('./word2vec/word2vecutils.js').Word2VecUtils;
const WORD2VEC_COUNT = 10;

const KEYWORD_COUNT = 10;

const CONTEXT_RANGE = 1;


/**
 * vars
 * question: the id for the question that we want recommendations for
 * database: The database object
 * 
 * returns: Promise that resolves with the recommendations.
 */
exports.getRecommendations = function(question, database) {
  let sources = database.getSources(question);

  // Split the sources into words
  let words = tokenizer.tokenize(sources.join(" "));
  // Eliminate duplicates.
  words = [...new Set(words)];
  words = words.filter((word) => checkWords.check(word));

  if(LOG_LEVEL == VERBOSE) {
    console.log("Words from source:");
    console.log(words);
  }

  let rows;

  return database.getAllText().then(r => {
    rows = r;
    // Get the top KEYWORD_COUNT words for frequency
    let frequentWords = rankWordsByFrequencyInSubset(
        words, sources, rows.map(row => row.line_text))
      .splice(0, KEYWORD_COUNT)
      .map(result => result.word)

    if(LOG_LEVEL == VERBOSE) {
      console.log("top 10 most frequent words:");
      console.log(frequentWords);
    }

    return getSimilairWords(frequentWords);
  }).then((words) => {
    if(LOG_LEVEL == VERBOSE) {
      console.log("words like top 10 frequent words");
      console.log(words);
    }

    rows = rows.sort((a,b) => {
      if(a.pdf == b.pdf) {
        if (a.line_number < b.line_number) return -1;
        if (b.line_number < a.line_number) return 1;
        return 0;
      } else {
        if (a.pdf < b.pdf) return -1;
        if (b.pdf < a.pdf) return 1;
      }
    });

    let results = recommendTexts(words, rows.map(row => row.line_text), CONTEXT_RANGE);
    results.forEach((result) => {
      result.row = rows[result.i];      
    })

    results = clearOverlappingResults(results, CONTEXT_RANGE);

    return results;
  });
}

/**
 * Note: results must be sorted in order of precidence. The elimination is greedy.
 */
function clearOverlappingResults(results, contextRange) {
  let keep = [];
  let isBlocked = [];
  results.forEach((result, i) => {
    let pdf = result.row.pdf;
    let lineNumber = result.i;
    if(!isBlocked[pdf]){
      isBlocked[pdf] = [];
    }

    // If there's already a line here, filter this one. 
    for(let line = lineNumber-contextRange; line <= lineNumber + contextRange; line++ ) {
      if(line < 0) continue;
      if(isBlocked[pdf][line]) {
        keep[i] = false;
        return;
      }
    }

    for(let line = lineNumber-contextRange; line <= lineNumber + contextRange; line++ ) {
      if(line < 0) continue;
      isBlocked[pdf][line] = true;
    }

    keep[i] = true;
  })

  return results.filter((el, i) => keep[i]);
}

function getSimilairWords(words) {
  let allWords = [];

  let promise = Promise.resolve();

  words.forEach((word) => {
    // Get the top WORD2VEC_COUNT similair words
    var similairWords = Word2VecUtils.findSimilarWords(WORD2VEC_COUNT, word);
    // Check if this word is in our local set. If not, go to the online system. 
    // If it is, add the similair words.
    if(similairWords[0] === false) {
      promise.then(axios.get('https://api.datamuse.com/words?ml='+encodeURI(word)))
        .then(response => {
          console.log("Additional word data:");
          console.log(response);
        })
        .catch(error => {
          console.log("Error when getting similair words for "+word+", recommendations may be incomplete.")
          console.log(error);
        });
    } else {
      // Add the words without the similairity value. 
      //TODO: Similairity value might be userful.
      allWords = allWords.concat(similairWords.map((word) => word[0]));
    }
  });

  
  // Return a promise which resolves with all words, without duplicates.
  return promise.then(() => [...new Set(allWords.concat(words))]);
}

function rankWordsByFrequencyInSubset(words, subset, texts) {
  let model = new TfIdf();

  // TODO: Filter subset out of all texts.
  subset.forEach(text => {
    model.addDocument(text);
  });
  
  texts.forEach(text => {
    model.addDocument(text);
  });

  let results = [];

  words.forEach((word) => {
    measureTotal = 0;
    model.tfidfs(word, function(i, measure) {
      if(i<subset.length) {
        measureTotal += measure
      }
    });
    results.push({word, measureTotal});
  })

  results.sort((a,b) => {
    if (a.measureTotal > b.measureTotal) return -1;
    if (b.measureTotal > a.measureTotal) return 1;
    return 0;
  });

  return results;
}

/**
 * @param {*} words An array of string with the words. 
 * @param {*} texts An array of strings with the text items. 
 *  These must be sorted in order.
 * @param {int} contextRange An int for how many surrounding sentences 
 *  should be added to the current sentence.
 * @return A sorted array of results with the text, 
 *  the resulting measure, and the original array index.
 */
function recommendTexts(words, texts, contextRange) {
  let model = new TfIdf();

  let finalTexts = [];
  
  texts.forEach((text, i) => {
    if(contextRange) {
      for(let dist = 1; dist <= contextRange; dist++) {   
        if(i - dist >= 0) {
          text = texts[i - dist] + text;
        }
        if(i + dist < texts.length) {
          text += texts[i + dist];
        }
      }
    }
    finalTexts[i] = text;
    model.addDocument(text);
  });

  let results = [];

  model.tfidfs(words, function(i, measure) {
    results[i] = {i, text:finalTexts[i], measure};
  });

  results.filter((result) => {
    if(result.measure == 0) 
    return result.measure > 0;
  })

  // There may be some bias in that longer sentences 
  // will have a higher rating simply because it's got more
  // keywords in it. Mildly bias towards shorter sentences.
  results.forEach((result) => {
    result.measure = result.measure / 
        Math.sqrt(result.text.split(" ").length);
  });

  results.sort((a,b) => {
    if (a.measure > b.measure) return -1;
    if (b.measure > a.measure) return 1;
    return 0;
  });

  return results;
}