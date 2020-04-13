
import os
import sys
import pickle
import unicodedata
import numpy as np

thisDir = os.path.abspath(os.path.dirname(sys.argv[0]))

def cleanText(text):
    text = unicodedata.normalize('NFKD', text)
    text = text.replace('\xad', '-')
    text = text.replace('\u00ad', '-')
    text = text.replace('\N{SOFT HYPHEN}', '-')
    text = "".join(text.splitlines())
    return text

# This file is too large to save to memory, must be read and processed line by line
def openWordEmbeddingsFile():
    word2vecDoc = open(os.path.join(thisDir, "input", "1b-vectors300-0.8-0.8.txt"), encoding="utf8")
    return word2vecDoc

def writePaperTextFile(filename, text):
    try:
        # Create needed directories
        os.mkdir(os.path.join(thisDir, input, "paper_text"))
        print("Directory " , os.path.join(thisDir, "saved"), " Created ") 
    except FileExistsError:
        None
    with open(os.path.join(thisDir, "input", "paper_text", filename + ".txt"), "x+b") as f:
        f.write(text)

def getListOfUnfinishedPapers(outputDir = "output_scores"):
    try:
        # Create needed directories
        os.mkdir(os.path.join(thisDir, "output"))
        print("Directory " , os.path.join(thisDir, "output"), " Created ") 
    except FileExistsError:
        None

    outputPath = os.path.join(thisDir, "output", outputDir)
    try:
        # Create needed directories
        os.mkdir(outputPath)
        print("Directory " , outputPath, " Created ") 
    except FileExistsError:
        None
    
    listOfPapers = os.listdir(os.path.join(thisDir, "input", "paper_text"))
    listOfFinishedPapers = os.listdir(outputPath)

    listOfPapers = [paper for paper in listOfPapers if paper not in listOfFinishedPapers]

    return listOfPapers

def getPaperText(fileName):
    with open(os.path.join(thisDir, "input", "paper_text", fileName), 'r') as f:
        text = f.read()
    text = cleanText(text)
    return text

def saveProcessedPaperText(fileName, textArray, outputDir = "output_scores"):
    try:
        # Create needed directories
        os.mkdir(os.path.join(thisDir, "output"))
        print("Directory " , os.path.join(thisDir, "output"), " Created ") 
    except FileExistsError:
        None

    try:
        # Create needed directories
        os.mkdir(os.path.join(thisDir, "output", outputDir))
        print("Directory " , os.path.join(thisDir, "output", outputDir), " Created ") 
    except FileExistsError:
        None

    outputFile = open(os.path.join(thisDir, "output", outputDir, fileName), "w", encoding='utf-8')
    for item in textArray:
        outputFile.write(str(item[1]) + ": " + item[0] +'\n')
    outputFile.close()

def getTaggedDOIs():
    with open(os.path.join(thisDir, "input", "tagged_dois.txt"), 'r', encoding='utf-8') as f:
        return f.read().splitlines()

def getTrainingSentences():
    with open(os.path.join(thisDir, "input", "training_sentences.txt"), 'r', encoding='utf-8') as f:
        return f.read().splitlines()
        
def getSavedTrainingVectors():
    try:
        with open(os.path.join(thisDir, "saved", "training_vectors.npy"), 'rb') as f:
            return np.load(f, allow_pickle=True)
    except FileNotFoundError:
        return []

def saveTrainingVectors(vectors):
    try:
        # Create needed directories
        os.mkdir(os.path.join(thisDir, "saved"))
        print("Directory " , os.path.join(thisDir, "saved"), " Created ") 
    except FileExistsError:
        None
    with open(os.path.join(thisDir, "saved", "training_vectors.npy"), "x+b") as f:
        np.save(f, vectors)

def getSavedTextFile(fileName):
    try:
        with open(os.path.join(thisDir, "saved", fileName + ".txt"), 'rb') as f:
            return f.read().splitlines()
    except FileNotFoundError:
        return []

def saveTextFile(textArray, fileName):
    try:
        # Create needed directories
        os.mkdir(os.path.join(thisDir, "saved"))
        print("Directory " , os.path.join(thisDir, "saved"), " Created ") 
    except FileExistsError:
        None
    outputFile = open(os.path.join(thisDir, "saved", fileName + ".txt"), "w", encoding='utf-8')
    for item in textArray:
        outputFile.write(item + '\n')
    outputFile.close()


def getAllXMLsPaths():
    dataDir = os.path.join(thisDir, "input", "paper_xml")
    listOfCHIs = os.listdir(dataDir)
    allFiles = list()
    # Iterate over all the entries
    for CHI in listOfCHIs:
        # Create full path
        fullPath = os.path.join(dataDir, CHI)
        if os.path.isdir(fullPath):
            files = [os.path.join(fullPath, filename) for filename in os.listdir(fullPath)]
            allFiles = allFiles + files
        else:
            print("Error! file in CHIs list!")
                
    return allFiles

def writeToCSV(results, filename):
    OUT_FILE = os.path.join(thisDir, 'output', filename + '.csv')
    out_f = open(OUT_FILE, 'w+')
    for result in results:
        out_f.write(str(result["year"]) + ", " + str(result["doi"])  + ", " + str(result["word"]) + ", " + str(result["corrupt"]) +"\n")
    out_f.close()

def getGenderWords():
    with open(os.path.join(thisDir, "input", "genderwords.txt"), 'r', encoding='utf-8') as f:
        return f.read().splitlines()

def getGenderPhrases():
    with open(os.path.join(thisDir, "input", "genderphrases.txt"), 'r', encoding='utf-8') as f:
        return f.read().splitlines()