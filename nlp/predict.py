import joblib

# Load the trained model and TF-IDF vectorizer
model = joblib.load("model.pkl")
vectorizer = joblib.load("vectorizer.pkl")

# Take input from the user
sentence = input("Describe your vehicle problem: ")

# Convert the sentence into TF-IDF features
sentence_tfidf = vectorizer.transform([sentence])

# Predict the breakdown category
prediction = model.predict(sentence_tfidf)

print("Predicted category:", prediction[0])