import pandas as pd
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

# Load dataset
data = pd.read_csv("dataset.csv")

# Separate text and labels
X = data["text"]
y = data["label"]

# Create TF-IDF vectorizer
vectorizer = TfidfVectorizer()

# Convert text into numbers
X_tfidf = vectorizer.fit_transform(X)

print("Number of sentences:", len(X))
print("TF-IDF shape:", X_tfidf.shape)

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X_tfidf,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# Create ML model
model = LogisticRegression()

# Train model
model.fit(X_train, y_train)

# Predict
y_pred = model.predict(X_test)

# Calculate accuracy
accuracy = accuracy_score(y_test, y_pred)

print("Accuracy:", accuracy)

# Test the model with new sentences
new_sentences = [
    "My bike has a flat rear tyre",
    "My car won't start and I hear clicking",
    "I have run out of petrol",
    "My engine is getting very hot",
    "My car needs to be towed"
]

# Convert new sentences using the same TF-IDF vectorizer
new_tfidf = vectorizer.transform(new_sentences)

# Predict categories
predictions = model.predict(new_tfidf)

# Display results
for sentence, prediction in zip(new_sentences, predictions):
    print(sentence, "->", prediction)

# Save the model and vectorizer
joblib.dump(model, "model.pkl")
joblib.dump(vectorizer, "vectorizer.pkl")

print("Model saved successfully!")