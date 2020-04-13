import nltk
import re
import string
import numpy as np

from fileManagement import openWordEmbeddingsFile

def error(text, text2 = "", text3 = ""):
    print("ERROR: ", text, text2, text3)

def info(text, text2 = "", text3 = ""):
    print("INFO: ", text, text2, text3)

def tokenize(text):
    text = text.lower()
    text = text.translate(string.punctuation)
    text = re.sub(r"\d", "9", text)
    return nltk.tokenize.RegexpTokenizer(r'\w+').tokenize(text)

def getListOfSignificantWords(text):
    words = tokenize(text)
    
    # removeing duplicates
    words = list(dict.fromkeys(words))

    # removeing stopwords
    stop_words = set(nltk.corpus.stopwords.words('english')) 
    words = [w for w in words if not w in stop_words] 

    return words

wordCache = {}
def preprocessText(text):
    # Takes a long time to run, best to run it once if possible
    words = getListOfSignificantWords(text)

    # remove already cached words
    cachedWords = list(wordCache.keys())
    words = [w for w in words if w not in cachedWords]

    word2vecDoc = openWordEmbeddingsFile()

    for line in word2vecDoc:
        # if we've got all the words already, we can stop
        if(len(words) == 0):
            break
        line = line.split()
        if line[0] in words:
            # get all the numbers
            vec = np.array(line[1:-1])
            vec = vec.astype(np.float)
            # add the vector to the cache
            wordCache[line[0]] = vec
            # remove it from the set of words
            words.remove(line[0])
    word2vecDoc.close()

    if(len(words) > 0):
        info("No vectors for these words: ", words)

def embedSentence(sentence):
    # Set encoding default here
    return embedSentenceAverage(sentence)

def embedSentenceAverage(sentence):
    # Requires all vectors to be cached already!
    global wordCache    
    words = getListOfSignificantWords(sentence)

    vectors = []
    foundWords = []
    # First check the cache
    for word in words:
        if(word in wordCache):
            vectors.append(wordCache[word])
            foundWords.append(word)
    
    # remove all found words
    words = [w for w in words if w not in foundWords]

    if(len(vectors) == 0):
        return []

    vecSum = vectors.pop()
    for vector in vectors:
        vecSum = np.add(vecSum, vector)

    return np.divide(vecSum, len(vectors) + 1)

