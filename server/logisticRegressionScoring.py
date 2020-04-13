from fileManagement import getTrainingSentences
from fileManagement import getTaggedDOIs
from fileManagement import getPaperText
from fileManagement import getSavedTrainingVectors
from fileManagement import saveTrainingVectors
from fileManagement import saveTextFile
from fileManagement import getSavedTextFile
from fileManagement import saveProcessedPaperText
from fileManagement import getListOfUnfinishedPapers

from sentenceEmbedding import embedSentence
from sentenceEmbedding import preprocessText

import nltk
import time
import random
import numpy as np
from difflib import SequenceMatcher
from sklearn.linear_model import LogisticRegression
from sklearn.linear_model import RidgeClassifier
import sklearn

def error(text, text2 = "", text3 = ""):
    print("ERROR: ", text, text2, text3)

def info(text, text2 = "", text3 = ""):
    print("INFO: ", text, text2, text3)

def similar(a, b):
    return SequenceMatcher(None, a, b).ratio()

def getSentencesForDOIs(dois):
    sentences = []
    notFoundCount = 0
    for doi in dois:
        try:
            text = getPaperText(doi.replace("/", "_") + ".txt")
            sentences = sentences + nltk.tokenize.sent_tokenize(text)
        except FileNotFoundError: 
            notFoundCount = notFoundCount + 1
    if(notFoundCount > 0):
        error(notFoundCount, " tagged files missing")
    return sentences

def getNegativeTrainingSentences():
    negativeSentences = getSavedTextFile("negative_training_sentences")
    if(len(negativeSentences) > 0):
        return negativeSentences
    
    info("No saved negative training sentences, creating")

    dois = getTaggedDOIs()
    textSentences = getSentencesForDOIs(dois)
    positiveSentences = getTrainingSentences()

    # Anything that is close to the training sentences, don't use
    foundSentences = []
    for s1 in textSentences:
        foundSomething = False
        for s2 in positiveSentences:
            # This will trigger a lot of false positives, but really it can't hurt to not 
            # fit to things that are like positive sentences
            if similar(s1, s2) > 0.5:
                foundSomething = True
                foundSentences.append(s2)
                info("Found similair sentence: ", s2)
                info("Will not add to the training set:", s1)
                break
        if(not foundSomething):
            # if no positive sentence is similair to this one, add it to the negative training set
            negativeSentences.append(s1)

    info(len(textSentences) - len(negativeSentences), "sentences were removed")

    notFoundSentences = [s for s in positiveSentences if s not in foundSentences]
    if(len(notFoundSentences) > 0):
        error("The following sentences were not found in at all in the paper data: ", notFoundSentences)

    saveTextFile(negativeSentences, "negative_training_sentences")

    return negativeSentences

def createTrainingVectors(positiveSentences, negativeSentences):
    positiveVectors = []
    negativeVectors = []

    info("Preprocessing sentence text")
    preprocessText(" ".join(positiveSentences) + " ".join(negativeSentences))
    info("Preprocessing complete")
    
    info("Embedding positive sentences")
    for sentence in positiveSentences:
        embedding = embedSentence(sentence)
        if(len(embedding) > 0):
            positiveVectors.append(embedding)
    info("Embedding complete")
    info("Embedding negative sentences")
    for sentence in negativeSentences:
        embedding = embedSentence(sentence)
        if(len(embedding) > 0):
            negativeVectors.append(embedding)
    info("Embedding complete")

    return [positiveVectors + negativeVectors, [1.0] * len(positiveVectors) + [0.0]*len(negativeVectors)]

def getTrainingVectors():
    savedVectors = getSavedTrainingVectors()
    if(len(savedVectors) != 0):
        return savedVectors

    info("No saved training encodings. Creating.")

    positiveSentences = getTrainingSentences()
    negativeSentences = getNegativeTrainingSentences()

    vectors = createTrainingVectors(positiveSentences, negativeSentences)

    saveTrainingVectors(vectors)
    
    return vectors

def trainLogisticModel(vectors, classifications, modelClass = "log", alpha = 10):
    # Very strange bug here where if you don't do this it refuses to recognise as a 2d array
    x = np.array([np.array(vec) for vec in vectors])
    # Another strange bug where it doesn't recognise the type
    y = np.array(classifications).astype("int")
    if(modelClass == "log"):
        scikit_log_reg = LogisticRegression()
    elif(modelClass == "ridge"):
        scikit_log_reg = RidgeClassifier(alpha)
    else:
        error("NOT A VALID MODEL", modelClass)

    model = scikit_log_reg.fit(x, y)
    return model

def scoreSentenceVectors(sentenceVectors, model):
    # This provides distance from plane values, i.e. how far the vector is on the 'yes' or 'no' side of the plane.
    # Negative values are 'not participant sentences', positive values are 'yes participant sentences'
    d = model.decision_function(sentenceVectors)

    # Returns probability values (hopefully)
    return np.exp(d) / (1 + np.exp(d))

def scoreFile(text, model):
    sentences = nltk.tokenize.sent_tokenize(text)

    sentencesWithVectors = []
    sentenceVectors = []
    for sentence in sentences:
        sentenceVector = embedSentence(sentence)
        if len(sentenceVector) == 0:
            error("No vector for ", sentence)
            continue
        sentencesWithVectors.append(sentence)
        sentenceVectors.append(sentenceVector)

    scores = scoreSentenceVectors(sentenceVectors, model)
    return zip(sentencesWithVectors, scores)

def reduceNegativeSample(trainingVectors, ratio = 1):
    posVectors = []
    negVectors = []

    for i in range(len(trainingVectors[0])):
        if(trainingVectors[1][i] == 0):
            negVectors.append(trainingVectors[0][i])
        else:
            posVectors.append(trainingVectors[0][i])

    negVectors = random.sample(negVectors, len(posVectors) * ratio)
    testSetVectors = posVectors + negVectors
    testSetClasses = [1]*len(posVectors) + [0]*len(negVectors)

    return [testSetVectors, testSetClasses]

def scoreAllPapers():
    listOfPapers = getListOfUnfinishedPapers("output_scores_log")

    trainingVectors = getTrainingVectors()
    info("Got", len(trainingVectors[0]),"Training vectors")
    trainingVectors = reduceNegativeSample(trainingVectors)
    
    info("Training model")
    model = trainLogisticModel(trainingVectors[0], trainingVectors[1])

    counter = 0
    batches = 10
    currTexts = []
    currPapers = []
    for paper in listOfPapers:
        currPapers.append(paper)
        currTexts.append(getPaperText(paper))
        counter = counter + 1
        if(counter % batches == 0 or counter == len(listOfPapers)):
            info("Preprocessing another", batches, "papers")
            preprocessText(" ".join(currTexts))

            for i in range(len(currPapers)):
                paper = currPapers[i]
                text = currTexts[i]
                info("Scoring ", paper)
                
                scores = scoreFile(text, model)
                res = sorted(scores, key = lambda x: x[1] * -1) 

                saveProcessedPaperText(paper, res, "output_scores_log")

                info("#############################################")
                info("Paper Complete")
                info("#############################################")

            currTexts.clear()
            currPapers.clear()
            info("Done", counter, "papers")


def scoreSampleText():

    sampleText = """
        We recruited 18 participants from a university campus. 
        The mean age was 24 years, ranging from 19 to 31 years (sd = 3.2). 
        Eight were female, ten were male. 
        Their sight was normal or corrected-to-normal, and they reported no motor or neural disorders.
        The experiment was a within-subjects design with one independent variable, ID, with four levels: 1.2, 1.6, 2.0 and 2.4.
        Sixty trials were carried out in each ID condition by each participant, each trial consisting of two interface designs. 
        Participants performed eight target acquisition tasks in each interface design per trial. 
        A trial consisted of two successive sub-trials followed by a rating task in which the participant rated which interface design (the former or the latter, or Trial 1 or Trial 2) resulted in a better perceived performance.
        As evidenced in the results section, T1 was unique in her approach. 
        While this has implications to generalizability, it can also shed some light into a particular population. 
        T1 is a white, female teacher with 22 years of experience teaching grades 1-3. 
        On a scale from 1 to 10 of technological confidence, she defined herself as an 8+. 
        She employs at least seven different technologies in her teaching, including code.org, Khan Academy, and blogs. 
        Twelve teachers, from 4 different schools, scheduled one session each for their classes. 
        Classes had 25-40 students, with 8 classes from 3rd, 3 from 4th and 1 from 5th grade.
        Five teachers opted to have additional facilitators (parents, administrators, or teacher interns) in their sessions. 
        Three researchers travelled to the school one day before the study to set up the system, but only two remained to oversee the study. 
        The room was arranged in a semi-circle with a total of 5 stations, as shown in Fig. 2. 
        """
    
    trainingVectors = getTrainingVectors()
    info("Got", len(trainingVectors[0]),"Training vectors")
    trainingVectors = reduceNegativeSample(trainingVectors)
    
    info("Training model")
    model = trainLogisticModel(trainingVectors[0], trainingVectors[1])

    preprocessText(sampleText)

    scores = scoreFile(sampleText, model)
    res = sorted(scores, key = lambda x: x[1] * -1) 
    for r in res:
        print(r[0])

    for r in res:
        print(str(round(r[1], 3)))

def main():
    info("start")
    t0 = time.time()

    scoreAllPapers()

    t1 = time.time()
    time_for_set = t1-t0
    info('Total set: ', time_for_set)

if __name__== "__main__":
  main()
