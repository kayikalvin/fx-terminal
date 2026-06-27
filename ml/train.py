from src.data_loader import DataLoader

DATASET = "data/raw/eurusd_sample.csv"


def main():

    loader = DataLoader(DATASET)

    df = loader.load()

    loader.summary(df)


if __name__ == "__main__":
    main()