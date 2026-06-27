from src.data_loader import DataLoader
from src.preprocess import Preprocessor

DATASET = "data/raw/eurusd_sample.csv"


def main():
    loader = DataLoader(DATASET)

    df = loader.load()

    loader.summary(df)

    preprocessor = Preprocessor()

    processed = preprocessor.fit_transform(df)

    preprocessor.summary(processed)

    print("\nScaled Feature Matrix")
    print(processed.X)

    print("\nTarget")
    print(processed.y)

    preprocessor.save_scaler("models/scaler.pkl")


if __name__ == "__main__":
    main()