import argparse
import json
import csv
import itertools
import math
import tkinter as tk
from tkinter import filedialog
from pathlib import Path
from collections import Counter
from multiprocessing import Pool, cpu_count


MULTIPROCESSING_THRESHOLD = 200


def main():
    parser = argparse.ArgumentParser(description='Script for converting a word bank to an ndle friendly format')
    parser.add_argument('--file-path', help='The path to the file on disk to read from and parse')
    args = parser.parse_args()

    if not args.file_path:
        root = tk.Tk()
        root.withdraw()
        file_path = filedialog.askopenfilename(title="Select a file")
        if file_path:
            print(f"Selected file: {file_path}")
            process_and_write_file(Path(file_path))
            return
        else:
            print("No file selected.")
            return
    else:
        print(f"File path from command line: {args.file_path}")
        process_and_write_file(Path(args.file_path))


def extract_word_list_from_file(file_path: Path) -> list[str]:
    if file_path.name.endswith('csv'):
        with open(file_path, mode='r', newline='') as file:
            reader = csv.reader(file)
            flat_iterator = itertools.chain.from_iterable(reader)
            return [word.strip() for word in flat_iterator]
    elif file_path.name.endswith('json'):
        try:
            with open(file_path, mode='r') as file:
                data = json.load(file)
                return [key.strip() for key in data]
        except json.JSONDecodeError:
            print("Error: The file exists, but it is not valid JSON.")
            return []
    elif file_path.name.endswith('txt'):
        with open(file_path, mode='r') as file:
            return [line.strip() for line in file]
    else:
        print('Unsupported file extension passed. Expected json, txt, or csv')
        return []


def filter_words(word_list: list[str]) -> list[str]:
    filtered_word_list = []
    rules = [
        lambda s: s.isalpha()
    ]

    for word in word_list:
        if all(rule(word) for rule in rules):
            filtered_word_list.append(word)

    return filtered_word_list


def compute_pattern(guess: str, target: str) -> str:
    result = [0] * len(guess)
    pool = Counter(t for g, t in zip(guess, target) if g != t)

    for i, (g, t) in enumerate(zip(guess, target)):
        if g == t:
            result[i] = 2
        elif pool[g] > 0:
            result[i] = 1
            pool[g] -= 1

    return "".join(map(str, result))


def _entropy_for_guess(args: tuple[str, list[str], int]) -> float:
    guess, word_list, N = args
    counts = Counter(compute_pattern(guess, target) for target in word_list)
    return -sum((c / N) * math.log2(c / N) for c in counts.values())


def bits_per_guess(word_list: list[str]) -> float:
    N = len(word_list)
    if N == 0:
        return 1.0

    if N < MULTIPROCESSING_THRESHOLD:
        return sum(_entropy_for_guess((g, word_list, N)) for g in word_list) / N

    args = [(guess, word_list, N) for guess in word_list]
    with Pool(processes=cpu_count()) as pool:
        chunksize = max(1, N // (cpu_count() * 4))
        entropies = pool.map(_entropy_for_guess, args, chunksize=chunksize)

    return sum(entropies) / N


def max_guesses(word_list: list[str], margin: float = 2.0) -> int:
    N = len(word_list)
    if N == 0:
        return 1
    I = bits_per_guess(word_list)
    if I == 0:
        return 1
    return math.ceil(math.log2(N) / I + margin)


def write_word_list(word_list: list[str], output_path: Path):
    sorted_words = sorted(word_list, key=lambda w: (len(w), w.lower()))

    with open(output_path, 'w') as f:
        for length, group in itertools.groupby(sorted_words, key=len):
            words_in_group = list(group)
            G = max_guesses(words_in_group)
            print(f"  Length {length}: {len(words_in_group)} words → {G} guesses")
            f.write(f"#{length},{G}\n")
            for word in words_in_group:
                f.write(word + "\n")


def process_and_write_file(file_path: Path):
    output_dir = Path(__file__).parent / Path("output")
    output_dir.mkdir(parents=True, exist_ok=True)

    word_list = extract_word_list_from_file(file_path)
    if not word_list:
        print('word list could not be extracted from file ' + file_path.name)
        return

    filtered_word_list = filter_words(word_list)
    print(f"Processing {len(filtered_word_list)} words...")
    write_word_list(filtered_word_list, output_dir / (file_path.stem + '.ndl'))
    print("Done.")


if __name__ == "__main__":
    main()