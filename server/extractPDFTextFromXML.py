import re
import time
import xml.etree.ElementTree as ET

from fileManagement import getAllXMLsPaths
from fileManagement import saveTextFile
from fileManagement import writePaperTextFile

def rfindAny(arr, text):
    for item in arr:
        loc = text.rfind(item)
        if loc != -1:
            return loc
    return -1
    

def find_rec(node, element, result):
     for item in node.findall(element):
         result.append(item)
     for item in node:
         find_rec(item, element, result)
     return result

def main():
    t0 = time.time()
    xmlsPaths = getAllXMLsPaths()
    total_articles = 0
    bad_articles = 0
    bad_articles_file_text = []
    for xml in xmlsPaths:
        print(xml)
        tree = ET.parse(xml)
        root = tree.getroot()
        articles = find_rec(root, 'article_rec', [])
        print("total articles: ", len(articles))
        total_articles = total_articles + len(articles)
        bad_articles_for = 0
        empty_articles = 0
        referenceWords = ["REFERENCES", "BIBLIOGRAPHY", "REFERENCE", "REFERINCES", "Bibliography", "References", "Reference"]
        for article in articles:
            doi = find_rec(article, 'doi_number', [])
            if len(doi) > 1:
                print("Multiple DOIs????????")
            doi = doi[0].text
            text = find_rec(article, 'ft_body', [])
            if len(text) > 1:
                print("Multiple texts????????")
            if len(text) == 0:
                text = ""
            else:
                text = text[0].text
            
            if not text.strip():
                empty_articles = empty_articles + 1
                bad_articles = bad_articles + 1
                bad_articles_file_text.append(doi)
            else:
                referenceLocation = rfindAny(referenceWords, text)
                if referenceLocation == -1:
                    bad_articles_file_text.append(doi)
                    bad_articles_file_text.append(text)
                    bad_articles = bad_articles + 1
                    bad_articles_for = bad_articles_for + 1
                else:
                    writePaperTextFile(doi.replace('/', '_'), text[0:referenceLocation])
        
        print("empty articles ", empty_articles)
        print("bad articles ", bad_articles_for)
        print("presumably good articles ", len(articles) - empty_articles - bad_articles_for) 
    saveTextFile(bad_articles_file_text, "bad_file_text")

    print("Total articles ", total_articles)
    print("bad articles ", bad_articles)
  
    t1 = time.time()
    time_for_set = t1-t0
    print('Total set: ', time_for_set)
if __name__== "__main__":
  main()
