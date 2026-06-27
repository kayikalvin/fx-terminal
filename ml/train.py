from src.config import FEATURE_COLUMNS

def main():
    print("FX Research Terminal ML")
    print("Features:")
    for feature in FEATURE_COLUMNS:
        print(f"- {feature}")

if __name__ == "__main__":
    main()