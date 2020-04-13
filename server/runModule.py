import sys
import os
from logisticRegressionScoring import getTrainingVectors
from logisticRegressionScoring import reduceNegativeSample
from logisticRegressionScoring import getTrainingVectors
from logisticRegressionScoring import trainLogisticModel
from logisticRegressionScoring import scoreFile

from sentenceEmbedding import embedSentence
from sentenceEmbedding import preprocessText

from fileManagement import cleanText

thisDir = os.path.abspath(os.path.dirname(sys.argv[0]))

def getSavedTextFile(fileName):
    try:
        with open(os.path.join(thisDir, "text_files", fileName), 'r', errors='ignore') as f:
            return cleanText(f.read()).splitlines()
    except FileNotFoundError:
        return []

filename = sys.argv[1]
sentences = getSavedTextFile(filename)

trainingVectors = getTrainingVectors()
trainingVectors = reduceNegativeSample(trainingVectors)

model = trainLogisticModel(trainingVectors[0], trainingVectors[1])

preprocessText(" ".join(sentences))

scores = scoreFile(" ".join(sentences), model)
res = sorted(scores, key = lambda x: x[1] * -1) 

for r in res:
    print("RESULT: ", str(round(r[1], 3)), r[0])
