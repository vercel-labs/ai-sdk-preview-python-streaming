import os


class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end_of_word = False
        self.word = None  # Store the complete word at terminating nodes


class Trie:
    def __init__(self):
        self.root = TrieNode()

    def insert(self, word):
        """Insert a word into the trie (converts to lowercase)"""
        word = word.lower().strip()  # Downcase and remove whitespace
        if not word:  # Skip empty words
            return

        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]

        node.is_end_of_word = True
        node.word = word

    def search(self, prefix, max_results=None):
        """
        Search for all words that start with the given prefix.
        Returns a list of all complete words found downstream from the prefix.

        Args:
            prefix: The prefix to search for
            max_results: Maximum number of results to return (None for unlimited)
        """
        prefix = prefix.lower().strip()
        node = self.root

        # Navigate to the prefix node
        for char in prefix:
            if char not in node.children:
                return []  # Prefix not found
            node = node.children[char]

        # Collect all terminating nodes downstream
        return self._collect_words(node, max_results)

    def _collect_words(self, node, max_results=None):
        """
        Recursively collect all words from terminating nodes downstream.

        Args:
            node: The current node to collect words from
            max_results: Maximum number of results to return (None for unlimited)
        """
        words = []

        # If current node is end of word, add it
        if node.is_end_of_word:
            words.append(node.word)
            # Check if we've reached the limit
            if max_results is not None and len(words) >= max_results:
                return words

        # Recursively collect from all children
        for child in node.children.values():
            if max_results is not None and len(words) >= max_results:
                break

            remaining_slots = None if max_results is None else max_results - len(words)
            child_words = self._collect_words(child, remaining_slots)
            words.extend(child_words)

            # Check if we've reached the limit after extending
            if max_results is not None and len(words) >= max_results:
                break

        return words[:max_results] if max_results is not None else words

    def load_from_file(self, filepath):
        """Load words from a file into the trie"""
        try:
            # Expand to absolute path
            absolute_filepath = os.path.abspath(filepath)
            with open(absolute_filepath, "r", encoding="utf-8") as file:
                for line in file:
                    word = line.strip()
                    if word:  # Skip empty lines
                        self.insert(word)
            print(f"Successfully loaded words from {absolute_filepath}")
        except FileNotFoundError:
            print(f"Error: File {absolute_filepath} not found")
        except Exception as e:
            print(f"Error loading file: {e}")

    def get_all_words(self):
        """Get all words stored in the trie"""
        return self._collect_words(self.root)

    def contains(self, word):
        """Check if a word exists in the trie"""
        word = word.lower().strip()
        node = self.root

        for char in word:
            if char not in node.children:
                return False
            node = node.children[char]

        return node.is_end_of_word


# Convenience function to create and load trie from wordlist
def create_trie_from_wordlist(filepath="wordlist.txt"):
    """Create a trie and load it with words from the specified file"""
    trie = Trie()
    trie.load_from_file(filepath)
    return trie


# Example usage
if __name__ == "__main__":
    # Create trie and load wordlist
    trie = create_trie_from_wordlist("wordlist.txt")

    # Example searches
    print("Words starting with 'cat':")
    cat_words = trie.search("cat", 3)
    print(cat_words[:10])  # Show first 3 results

    print(f"\nTotal words starting with 'cat': {len(cat_words)}")

    print("\nWords starting with 'aa':")
    aa_words = trie.search("aa")
    print(aa_words[:10])  # Show first 10 results

    print(f"\nTotal words starting with 'aa': {len(aa_words)}")
