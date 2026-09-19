import sys
import joblib

model = joblib.load("nlp/model.pkl")
vectorizer = joblib.load("nlp/vectorizer.pkl")

problem = sys.argv[1]

problem_tfidf = vectorizer.transform([problem])

prediction = model.predict(problem_tfidf)

print(prediction[0])