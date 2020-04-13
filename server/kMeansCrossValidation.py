from logisticRegressionScoring import getTrainingVectors
from logisticRegressionScoring import trainLogisticModel
from logisticRegressionScoring import scoreSentenceVectors

from sentenceEmbedding import preprocessText
from sentenceEmbedding import embedSentence

from fileManagement import getTrainingSentences

import time
import math
import random
import sklearn
import numpy as np

def error(text, text2 = "", text3 = ""):
    print("ERROR: ", text, text2, text3)

def info(text, text2 = "", text3 = ""):
    print("INFO: ", text, text2, text3)

k = 10
negToPosRatio = 10 # 0 = use all the data
# modelClass = "log"
modelClass = "ridge"
alpha = 10

def kMeansClassifyLogReg():
    trainingVectors = getTrainingVectors()

    posVectors = []
    negVectors = []

    for i in range(len(trainingVectors[0])):
        if(trainingVectors[1][i] == 0):
            negVectors.append(trainingVectors[0][i])
        else:
            posVectors.append(trainingVectors[0][i])

    # check the confusion matrix on the full training data: 
    model = trainLogisticModel(posVectors + negVectors, [1]*len(posVectors) + [0]*len(negVectors), modelClass, alpha)
    info("Confusion Matrix, full set\n", generateConfusionMatrix(posVectors + negVectors, [1]*len(posVectors) + [0]*len(negVectors), model))

    posSets = vectorsIntoKSets(k, posVectors)
    negSets = vectorsIntoKSets(k, negVectors)

    posSetScores = []
    negSetScores = []
    
    summedMatricies = []
    for currSetIndex in range(k):
        testSetPosVectors = posSets[currSetIndex]
        testSetNegVectors = negSets[currSetIndex]

        # Take everything else for the training data
        posTrainingVectors = [posSets[i] for i in range(k) if i != currSetIndex]
        # Flatten the set
        posTrainingVectors = [vector for subset in posTrainingVectors for vector in subset]

        negTrainingVectors = [negSets[i] for i in range(k) if i != currSetIndex]
        # Flatten the set
        negTrainingVectors = [vector for subset in negTrainingVectors for vector in subset]
        # reduce the negative training data if nessisary
        if(negToPosRatio > 0):
            negTrainingVectors = random.sample(negTrainingVectors, len(posTrainingVectors) * negToPosRatio)

        trainingSetVectors = posTrainingVectors + negTrainingVectors
        trainingSetClasses = [1]*len(posTrainingVectors) + [0]*len(negTrainingVectors)

        model = trainLogisticModel(trainingSetVectors, trainingSetClasses, modelClass, alpha)

        negativeScore = model.score(testSetNegVectors, [0]*len(testSetNegVectors))
        positiveScore = model.score(testSetPosVectors, [1]*len(testSetPosVectors))
        matrix = generateConfusionMatrix(testSetPosVectors + testSetNegVectors, [1]*len(testSetPosVectors) + [0]*len(testSetNegVectors), model)

        info("This positive score", positiveScore)
        info("This negative score", negativeScore)
        print(matrix)

        if(len(summedMatricies) == 0):
            summedMatricies = matrix
        else: 
            summedMatricies = np.add(summedMatricies, matrix)

        posSetScores.append(positiveScore)
        negSetScores.append(negativeScore)
       
    info("Average positive score", np.average(posSetScores))
    info("Average negative score", np.average(negSetScores))
    print(summedMatricies)
    return [np.average(posSetScores), np.average(negSetScores), summedMatricies]

def generateConfusionMatrix(vectors, classes, model):
    return sklearn.metrics.confusion_matrix(model.predict(vectors), classes, [0, 1])

def vectorsIntoKSets(k, vectors):
    sizeOfEachSet = math.ceil(len(vectors) / k)
    return [vectors[x:x+sizeOfEachSet] for x in range(0, len(vectors), sizeOfEachSet)]

def main():
    info("start")
    t0 = time.time()
    
    res = kMeansClassifyLogReg()
    info("Final average results: ", res)

    t1 = time.time()
    time_for_set = t1-t0
    info('Total set: ', time_for_set)

if __name__== "__main__":
  main()
