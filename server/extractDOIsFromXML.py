import re
import time
import xml.etree.ElementTree as ET

from fileManagement import getAllXMLsPaths
from fileManagement import saveTextFile

def find_rec(node, element, result):
     for item in node.findall(element):
         result.append(item)
     for item in node:
         find_rec(item, element, result)
     return result

def main():
    t0 = time.time()
    xmlsFilenames = getAllXMLsPaths()
    outFileText = []
    total_files = 0
    for xml in xmlsFilenames:
        print(xml)
        tree = ET.parse(xml)
        root = tree.getroot()
        dois = find_rec(root, 'doi_number', [])
        print("number of papers for this year: ", len(dois))
        total_files = total_files + len(dois)
        for doi in dois:
            outFileText.append(doi.text)

    saveTextFile(outFileText, "doi_extract")

    print("Total files ", total_files)
  
    t1 = time.time()
    time_for_set = t1-t0
    print('Total set: ', time_for_set)
if __name__== "__main__":
  main()
