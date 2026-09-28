"""
Retrain the theme prediction ML model using the CURRENT scikit-learn version.
This fixes the InconsistentVersionWarning that causes incorrect predictions.
"""
import joblib
import os
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
import numpy as np

# ─── Training Data ─────────────────────────────────────────────────────────────
# Expanded dataset for better multi-topic coverage
training_data = [
    # Modern Sleek (clean minimal tech)
    ("modern technology startup app mobile software", "Modern Sleek"),
    ("saas product launch user experience design", "Modern Sleek"),
    ("minimalist clean simple elegant product", "Modern Sleek"),
    ("tech innovation agile development startup growth", "Modern Sleek"),
    ("digital transformation cloud computing scalable", "Modern Sleek"),
    ("user interface design system components", "Modern Sleek"),
    ("machine learning artificial intelligence neural network", "Modern Sleek"),
    ("deep learning transformer model AI", "Modern Sleek"),
    ("data science python analytics pipeline", "Modern Sleek"),
    ("software engineering architecture microservices", "Modern Sleek"),

    # Executive Blue (corporate business)
    ("corporate business strategy consulting management", "Executive Blue"),
    ("executive leadership quarterly report annual review", "Executive Blue"),
    ("enterprise B2B sales operations revenue", "Executive Blue"),
    ("business plan investor pitch market analysis", "Executive Blue"),
    ("project management agile scrum team workflow", "Executive Blue"),
    ("supply chain logistics operations management", "Executive Blue"),
    ("hr human resources talent management training", "Executive Blue"),
    ("compliance legal regulatory governance", "Executive Blue"),
    ("banking finance insurance risk management", "Executive Blue"),
    ("corporate governance stakeholder board director", "Executive Blue"),

    # Royal Gold (finance premium luxury)
    ("finance investment portfolio stock market wealth", "Royal Gold"),
    ("luxury premium brand high end exclusive", "Royal Gold"),
    ("gold silver commodity investment hedge fund", "Royal Gold"),
    ("private equity venture capital IPO funding", "Royal Gold"),
    ("real estate property investment commercial", "Royal Gold"),
    ("wealth management financial planning retirement", "Royal Gold"),
    ("economics macroeconomics GDP inflation interest rate", "Royal Gold"),
    ("cryptocurrency bitcoin blockchain defi web3", "Royal Gold"),
    ("mergers acquisitions M&A deal corporate finance", "Royal Gold"),
    ("stock exchange trading derivatives futures options", "Royal Gold"),

    # Eco Nature (environment green)
    ("nature environment ecology sustainability green", "Eco Nature"),
    ("climate change renewable energy solar wind", "Eco Nature"),
    ("sustainable agriculture organic farming biodiversity", "Eco Nature"),
    ("environmental conservation wildlife ecosystem", "Eco Nature"),
    ("carbon footprint emissions reduction net zero", "Eco Nature"),
    ("ocean marine biology coral reef conservation", "Eco Nature"),
    ("forest deforestation reforestation tree planting", "Eco Nature"),
    ("water resources freshwater pollution treatment", "Eco Nature"),
    ("green energy electric vehicles transportation", "Eco Nature"),
    ("biology botany plants animals natural world", "Eco Nature"),

    # Cyber Future (cybersecurity dark tech)
    ("cybersecurity hacking security firewall network", "Cyber Future"),
    ("ethical hacking penetration testing vulnerability", "Cyber Future"),
    ("dark web encryption anonymity VPN privacy", "Cyber Future"),
    ("robotics automation industry 4.0 manufacturing", "Cyber Future"),
    ("quantum computing qubit superposition entanglement", "Cyber Future"),
    ("space technology NASA SpaceX satellite Mars", "Cyber Future"),
    ("augmented reality virtual reality metaverse", "Cyber Future"),
    ("internet of things IoT sensors embedded systems", "Cyber Future"),
    ("autonomous vehicles self-driving cars drones", "Cyber Future"),
    ("computer science algorithms data structures", "Cyber Future"),

    # Midnight Neon (dark academic creative)
    ("psychology mental health therapy cognitive behavioral", "Midnight Neon"),
    ("philosophy ethics logic metaphysics epistemology", "Midnight Neon"),
    ("literature poetry creative writing storytelling narrative", "Midnight Neon"),
    ("history ancient civilization archaeology culture", "Midnight Neon"),
    ("sociology anthropology society culture community", "Midnight Neon"),
    ("political science government democracy elections", "Midnight Neon"),
    ("arts music painting sculpture gallery", "Midnight Neon"),
    ("film cinema photography cinematography visual media", "Midnight Neon"),
    ("architecture urban planning design cities", "Midnight Neon"),
    ("dark night mystery thriller noir crime detective", "Midnight Neon"),

    # Abstract Glass (future academic research)
    ("research academic journal scientific paper study", "Abstract Glass"),
    ("medical healthcare hospital patient treatment", "Abstract Glass"),
    ("pharmaceutical drug development clinical trial", "Abstract Glass"),
    ("genetics DNA CRISPR genomics biotech biology", "Abstract Glass"),
    ("chemistry biochemistry laboratory experiment", "Abstract Glass"),
    ("physics quantum mechanics relativity particles", "Abstract Glass"),
    ("mathematics calculus statistics probability theorem", "Abstract Glass"),
    ("neuroscience brain cognitive science memory learning", "Abstract Glass"),
    ("education curriculum teaching pedagogy learning", "Abstract Glass"),
    ("innovation research development prototype testing", "Abstract Glass"),

    # Neon Nights (entertainment social media)
    ("gaming esports video games competitive streaming", "Neon Nights"),
    ("social media marketing influencer viral content", "Neon Nights"),
    ("fashion beauty cosmetics lifestyle trends", "Neon Nights"),
    ("music concert festival DJ nightlife entertainment", "Neon Nights"),
    ("sports fitness gym workout training performance", "Neon Nights"),
    ("food restaurant cooking chef culinary gastronomy", "Neon Nights"),
    ("travel tourism adventure travel destinations", "Neon Nights"),
    ("marketing advertising branding campaign digital", "Neon Nights"),
    ("e-commerce retail shopping consumer behavior", "Neon Nights"),
    ("content creation youtube creator audience engagement", "Neon Nights"),
]

texts = [t[0] for t in training_data]
labels = [t[1] for t in training_data]

# ─── Build and Train Model ──────────────────────────────────────────────────────
print("Training theme prediction model...")

model = Pipeline([
    ('tfidf', TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=5000,
        sublinear_tf=True,
        min_df=1,
        analyzer='word',
        strip_accents='unicode',
    )),
    ('clf', LinearSVC(
        C=1.5,
        max_iter=5000,
        class_weight='balanced'
    ))
])

model.fit(texts, labels)

# ─── Test Predictions ───────────────────────────────────────────────────────────
test_cases = [
    ("machine learning deep learning neural network AI", "Modern Sleek"),
    ("business strategy corporate management", "Executive Blue"),
    ("nature environment climate green", "Eco Nature"),
    ("cybersecurity hacking penetration testing", "Cyber Future"),
    ("social media marketing viral content", "Neon Nights"),
    ("finance investment portfolio stock market", "Royal Gold"),
    ("research academic scientific study paper", "Abstract Glass"),
    ("dark night philosophy literature poetry", "Midnight Neon"),
]

print("\nPrediction Tests:")
print("-" * 50)
correct = 0
for text, expected in test_cases:
    predicted = model.predict([text])[0]
    ok = "✓" if predicted == expected else "✗"
    print(f"{ok} Input: '{text[:35]}...'")
    print(f"   Expected: {expected}, Got: {predicted}")
    if predicted == expected:
        correct += 1
print(f"\nAccuracy: {correct}/{len(test_cases)} ({100*correct//len(test_cases)}%)")

# ─── Save Model ─────────────────────────────────────────────────────────────────
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'theme_model.pkl')
joblib.dump(model, output_path)
print(f"\n✅ Model saved to: {output_path}")
print("Rebuild complete! The Flask API will use this new model.")
