import time
import re
import nltk
import string
import unicodedata
import xml.etree.ElementTree as ET

from fileManagement import getAllXMLsPaths
from fileManagement import getGenderWords
from fileManagement import getGenderPhrases
from fileManagement import writeToCSV

def error(text, text2 = "", text3 = ""):
    print("ERROR: ", text, text2, text3)

def info(text, text2 = "", text3 = ""):
    print("INFO: ", text, text2, text3)

def tokenize(text):
    text = text.lower()
    text = text.translate(string.punctuation)
    text = re.sub(r"\d", "9", text)
    return nltk.tokenize.RegexpTokenizer(r'\w+').tokenize(text)

def cleanText(text):
    text = unicodedata.normalize('NFKD', text)
    text = text.replace('\xad', '-')
    text = text.replace('\u00ad', '-')
    text = text.replace('\N{SOFT HYPHEN}', '-')
    text = "".join(text.splitlines())
    return text

def find_rec(node, element, result):
     for item in node.findall(element):
         result.append(item)
     for item in node:
         find_rec(item, element, result)
     return result

def rfindAny(arr, text):
    for item in arr:
        loc = text.rfind(item)
        if loc != -1:
            return loc
    return -1

def getYear(xml):
    yearPattern = re.compile(r"CHI(..)")
    years = yearPattern.findall(str(xml))
    if(len(years) != 2):
        error("Unexpected xml filemane format")
    return years[0]

def getPapers(xml):
    tree = ET.parse(xml)
    root = tree.getroot()
    articles = find_rec(root, 'article_rec', [])
    return articles

def getDOI(paper):
    doi = find_rec(paper, 'doi_number', [])
    if len(doi) > 1:
        error("Multiple DOIs")
    doi = doi[0].text
    return doi

def getText(paper):
    text = find_rec(paper, 'ft_body', [])
    if len(text) > 1:
        error("Multiple texts")
    if len(text) == 0:
        text = ""
    else:
        text = text[0].text
    return cleanText(text)

def isCorrupt(text):
    # Seems checking for the word references is a good heuristic for corrupt files. 
    # TODO: The better option would be to tokenize the file and check for english
    referenceWords = ["REFERENCES", "BIBLIOGRAPHY", "REFERENCE", "REFERINCES", "Bibliography", "References", "Reference"]
    if not text.strip():
        return True
    else:
        referenceLocation = rfindAny(referenceWords, text)
        if referenceLocation == -1:
            return True
    return False

def removeFalsePositives(text):
    wordsToRemove = [
        # If we're unlucky, this might remove valid instances. 
        # But I have a feeling that if there's enough transwoman etc for one to be hyphenated, it won't be the only gender word in there. 
        r"trans-",
        r"trans\.",
        r"\(trans\)"
        r"trans Computer",
        r"IEEE Trans",
        r"IEICE Trans",
        r"ACM Trans",
        r"Philos Trans",
        r"@cis",
        r"\.cis",
        r"/cis",
        r"pr.cis"
    ]
    # This is case sensitive
    # This might also eliminate valid data, but I think there's no help for it. Corrupted files turn out too many of these things. 
    text = text.replace("Trans", "")
    text = text.replace("ciS", "")
    text = text.replace("cIs", "")
    text = text.replace("Cis", "") # caused by subscripting
    text = text.replace("CiS", "")
    text = text.replace("CIs", "") # is a thing
    text = text.replace("CIS", "") # Computer information systems
    for word in wordsToRemove:
        src_str  = re.compile(word, re.IGNORECASE)
        text  = src_str.sub("", text)
    
    return text

def findWords(text):
    text = removeFalsePositives(text)
    foundWords = []
    genderWords = getGenderWords()
    genderPhrases = getGenderPhrases()
    for phrase in genderPhrases:
            if phrase in text:
                foundWords.append(phrase)

    textWords = tokenize(text)
    for word in genderWords:
        if word in textWords:
            foundWords.append(word)
    return foundWords

def main():
    info("start")
    t0 = time.time()

    results = []

    xmls = getAllXMLsPaths()
    for xml in xmls:
        year = getYear(xml)
        # conver to a 4 digit years
        year = "19" + year if year[0] == '8' or year[0] == '9' else "20" + year
        papers = getPapers(xml)
        info(len(papers), "papers for CHI", year)
        corruptCount = 0
        for paper in papers:
            doi = getDOI(paper)
            text = getText(paper)
            corrupt = isCorrupt(text)
            words = findWords(text)
            for word in words: 
                results.append({
                    "year" : year,
                    "doi"  : doi,
                    "word" : word,
                    "corrupt" : corrupt
                })
            corruptCount = corruptCount + 1 if corrupt else corruptCount
        info(corruptCount, "corrupt papers for CHI", year)

    writeToCSV(results, "genderdata")

    t1 = time.time()
    time_for_set = t1-t0
    info('Total set: ', time_for_set)

if __name__== "__main__":
  main()